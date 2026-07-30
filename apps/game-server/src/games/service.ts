import { randomBytes, randomUUID } from "node:crypto";
import {
  executeCommand,
  type GameCommand,
  type GameEvent,
  GameRuleError,
  type GameState,
  processTimeouts,
} from "@terrativa/game-engine";
import type { CommandEnvelope, ErrorCode } from "@terrativa/protocol";
import { z } from "zod";
import { SerialGameQueue } from "./queue.js";
import type {
  GameAcknowledgement,
  GamePlayerIdentity,
  GameRepository,
  GameStartResult,
  StoredGame,
} from "./types.js";
import { GameServerError } from "./types.js";

const emptyPayloadSchema = z.object({}).strict();
const propertyPayloadSchema = z.object({ propertyId: z.uuid() }).strict();
const tradeIdPayloadSchema = z.object({ tradeId: z.uuid() }).strict();
const cardPayloadSchema = z.object({ cardId: z.uuid() }).strict();
const tradeAssetsSchema = z
  .object({
    cash: z.int().nonnegative(),
    propertyIds: z.array(z.uuid()).max(64),
    cardIds: z.array(z.uuid()).max(64),
  })
  .strict();
const createTradePayloadSchema = z
  .object({
    tradeId: z.uuid(),
    toPlayerId: z.uuid(),
    offered: tradeAssetsSchema,
    requested: tradeAssetsSchema,
  })
  .strict();

interface CachedGame extends StoredGame {
  readonly playerByUserId: ReadonlyMap<string, string>;
}

export interface GameCommandResult {
  readonly acknowledgement: GameAcknowledgement;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface RankedGameFinalizer {
  finalizeRankedGame(
    gameId: string,
    standings: GameState["finalStandings"],
    now?: Date,
  ): Promise<unknown>;
}

export class GameService {
  readonly #games = new Map<string, CachedGame>();
  readonly #queue = new SerialGameQueue();

  constructor(
    private readonly repository: GameRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly ranking?: RankedGameFinalizer,
  ) {}

  async createFromRoom(roomCode: string): Promise<GameStartResult> {
    const existingId = await this.repository.findByRoomCode(roomCode);
    if (existingId) {
      const existing = await this.#load(existingId);
      return { gameId: existingId, roomCode, state: existing.state };
    }
    const result = await this.repository.createFromRoom(
      roomCode,
      this.now(),
      randomBytes(32).toString("hex"),
    );
    await this.#load(result.gameId, true);
    return result;
  }

  async authorize(
    userId: string,
    options: { gameId?: string | undefined; roomCode?: string | undefined },
  ): Promise<{
    readonly gameId: string;
    readonly playerId: string;
  }> {
    const gameId =
      options.gameId ??
      (options.roomCode ? await this.repository.findByRoomCode(options.roomCode) : null);
    if (!gameId) {
      throw new GameServerError("ROOM_NOT_FOUND", "game.notFound");
    }
    const game = await this.#load(gameId);
    const playerId = game.playerByUserId.get(userId);
    if (!playerId) {
      throw new GameServerError("FORBIDDEN", "game.playerRequired");
    }
    return { gameId, playerId };
  }

  async resolveGameId(options: {
    gameId?: string | undefined;
    roomCode?: string | undefined;
  }): Promise<string | null> {
    return (
      options.gameId ??
      (options.roomCode ? await this.repository.findByRoomCode(options.roomCode) : null)
    );
  }

  async state(gameId: string): Promise<GameState> {
    return (await this.#load(gameId)).state;
  }

  async execute(
    gameId: string,
    userId: string,
    envelope: CommandEnvelope,
  ): Promise<GameCommandResult> {
    return this.#queue.run(gameId, async () => {
      const game = await this.#load(gameId);
      const playerId = this.#requiredPlayer(game, userId);
      const duplicate = await this.repository.findAcknowledgement(gameId, envelope.commandId);
      if (duplicate) {
        return {
          acknowledgement: { ...duplicate, duplicate: true },
          state: game.state,
          events: [],
        };
      }

      let command: GameCommand;
      try {
        command = toEngineCommand(envelope, playerId);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new GameServerError("INVALID_PAYLOAD", "request.invalidPayload");
        }
        throw error;
      }
      try {
        const result = executeCommand(game.state, command, { now: this.now().getTime() });
        const acknowledgement: GameAcknowledgement = {
          commandId: envelope.commandId,
          accepted: true,
          stateVersion: result.state.version,
          duplicate: false,
        };
        await this.repository.persistCommand({
          gameId,
          commandId: envelope.commandId,
          actorPlayerId: playerId,
          commandType: envelope.type,
          expectedStateVersion: envelope.expectedStateVersion,
          acknowledgement,
          state: result.state,
          events: result.events,
          snapshotReason: snapshotReason(result.state, result.events),
          now: this.now(),
        });
        this.#replace(gameId, result.state, game.players);
        await this.#finalizeRanking(result.state);
        return { acknowledgement, state: result.state, events: result.events };
      } catch (error) {
        if (!(error instanceof GameRuleError)) {
          throw error;
        }
        const acknowledgement: GameAcknowledgement = {
          commandId: envelope.commandId,
          accepted: false,
          stateVersion: game.state.version,
          duplicate: false,
          error: {
            code: protocolErrorCode(error.code),
            messageKey: `game.${camelCase(error.code)}`,
          },
        };
        await this.repository.persistCommand({
          gameId,
          commandId: envelope.commandId,
          actorPlayerId: playerId,
          commandType: envelope.type,
          expectedStateVersion: envelope.expectedStateVersion,
          acknowledgement,
          state: game.state,
          events: [],
          snapshotReason: "REJECTED_COMMAND",
          now: this.now(),
        });
        return { acknowledgement, state: game.state, events: [] };
      }
    });
  }

  async processTimeout(gameId: string): Promise<GameCommandResult | null> {
    return this.#queue.run(gameId, async () => {
      const game = await this.#load(gameId);
      const result = processTimeouts(game.state, { now: this.now().getTime() });
      if (result.state === game.state || result.events.length === 0) {
        return null;
      }
      const commandId = randomUUID();
      const playerId = game.state.currentPlayerId ?? game.players[0]?.playerId;
      if (!playerId) {
        throw new GameServerError("INTERNAL_ERROR", "game.playerUnavailable");
      }
      const acknowledgement: GameAcknowledgement = {
        commandId,
        accepted: true,
        stateVersion: result.state.version,
        duplicate: false,
      };
      await this.repository.persistCommand({
        gameId,
        commandId,
        actorPlayerId: playerId,
        commandType: "SYSTEM_TIMEOUT",
        expectedStateVersion: game.state.version,
        acknowledgement,
        state: result.state,
        events: result.events,
        snapshotReason: "TIMEOUT",
        now: this.now(),
      });
      this.#replace(gameId, result.state, game.players);
      await this.#finalizeRanking(result.state);
      return { acknowledgement, state: result.state, events: result.events };
    });
  }

  async markDisconnected(gameId: string, userId: string): Promise<void> {
    const game = await this.#load(gameId);
    await this.repository.markDisconnected(gameId, this.#requiredPlayer(game, userId), this.now());
  }

  async markConnected(gameId: string, userId: string): Promise<void> {
    const game = await this.#load(gameId);
    await this.repository.markConnected(gameId, this.#requiredPlayer(game, userId));
  }

  publicState(state: GameState): Record<string, unknown> {
    return {
      ...state,
      players: Object.fromEntries(
        Object.entries(state.players).map(([id, player]) => [
          id,
          { ...player, heldCardIds: player.heldCardIds.map(() => "PRIVATE") },
        ]),
      ),
      decks: Object.fromEntries(
        Object.entries(state.decks).map(([key, deck]) => [
          key,
          { cursor: deck.cursor, remaining: deck.cardIds.length - deck.cursor },
        ]),
      ),
      rngState: undefined,
      processedCommandIds: undefined,
    };
  }

  privateState(state: GameState, playerId: string): Record<string, unknown> {
    return {
      gameId: state.gameId,
      stateVersion: state.version,
      playerId,
      heldCardIds: state.players[playerId]?.heldCardIds ?? [],
    };
  }

  visibleEvents(
    events: readonly GameEvent[],
    playerId: string,
  ): { readonly publicEvents: readonly GameEvent[]; readonly privateEvents: readonly GameEvent[] } {
    const heldCardActors = new Set(
      events
        .filter((event) => event.type === "CARD_HELD")
        .map((event) => event.actorPlayerId)
        .filter((actor): actor is string => Boolean(actor)),
    );
    return {
      publicEvents: events
        .filter((event) => event.type !== "CARD_HELD")
        .map((event) =>
          event.type === "CARD_DRAWN_PUBLIC" &&
          event.actorPlayerId &&
          heldCardActors.has(event.actorPlayerId)
            ? { ...event, payload: { hidden: true } }
            : event,
        ),
      privateEvents: events.filter(
        (event) =>
          event.actorPlayerId === playerId &&
          (event.type === "CARD_HELD" ||
            (event.type === "CARD_DRAWN_PUBLIC" && heldCardActors.has(playerId))),
      ),
    };
  }

  async #load(gameId: string, force = false): Promise<CachedGame> {
    const cached = !force ? this.#games.get(gameId) : undefined;
    if (cached) return cached;
    const stored = await this.repository.load(gameId);
    if (!stored) throw new GameServerError("ROOM_NOT_FOUND", "game.notFound");
    return this.#replace(gameId, stored.state, stored.players);
  }

  #replace(gameId: string, state: GameState, players: readonly GamePlayerIdentity[]): CachedGame {
    const cached = {
      state,
      players,
      playerByUserId: new Map(players.map((player) => [player.userId, player.playerId])),
    };
    this.#games.set(gameId, cached);
    return cached;
  }

  #requiredPlayer(game: CachedGame, userId: string): string {
    const playerId = game.playerByUserId.get(userId);
    if (!playerId) throw new GameServerError("FORBIDDEN", "game.playerRequired");
    return playerId;
  }

  async #finalizeRanking(state: GameState): Promise<void> {
    if (state.status === "FINISHED" && state.mode === "RANKED" && this.ranking) {
      await this.ranking
        .finalizeRankedGame(state.gameId, state.finalStandings, this.now())
        .catch(() => undefined);
    }
  }
}

function toEngineCommand(envelope: CommandEnvelope, playerId: string): GameCommand {
  const base = {
    commandId: envelope.commandId,
    actorPlayerId: playerId,
    expectedStateVersion: envelope.expectedStateVersion,
  };
  switch (envelope.type) {
    case "ROLL_DICE":
    case "BUY_PROPERTY":
    case "DECLINE_PROPERTY":
    case "PAY_INSPECTION_FEE":
    case "DECLARE_BANKRUPTCY":
    case "END_TURN":
      return { ...base, type: envelope.type, payload: emptyPayloadSchema.parse(envelope.payload) };
    case "BUILD_UPGRADE":
    case "SELL_UPGRADE":
    case "MORTGAGE_PROPERTY":
    case "UNMORTGAGE_PROPERTY":
      return {
        ...base,
        type: envelope.type,
        payload: propertyPayloadSchema.parse(envelope.payload),
      };
    case "CREATE_TRADE":
      return {
        ...base,
        type: envelope.type,
        payload: createTradePayloadSchema.parse(envelope.payload),
      };
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CANCEL_TRADE":
      return {
        ...base,
        type: envelope.type,
        payload: tradeIdPayloadSchema.parse(envelope.payload),
      };
    case "USE_CARD":
      return { ...base, type: envelope.type, payload: cardPayloadSchema.parse(envelope.payload) };
    default:
      throw new GameServerError("INVALID_PAYLOAD", "request.invalidPayload");
  }
}

function protocolErrorCode(code: string): ErrorCode {
  const supported = new Set<ErrorCode>([
    "NOT_YOUR_TURN",
    "INVALID_GAME_PHASE",
    "DECISION_EXPIRED",
    "INSUFFICIENT_BALANCE",
    "PROPERTY_UNAVAILABLE",
    "INVALID_UPGRADE",
    "INVALID_TRADE",
    "INVALID_CARD",
    "PLAYER_UNAVAILABLE",
    "STATE_VERSION_MISMATCH",
    "DUPLICATE_COMMAND",
  ]);
  return supported.has(code as ErrorCode) ? (code as ErrorCode) : "INTERNAL_ERROR";
}

function camelCase(value: string): string {
  return value.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function snapshotReason(state: GameState, events: readonly GameEvent[]): string {
  if (state.status === "FINISHED") return "GAME_FINISHED";
  if (events.some((event) => event.type === "TURN_STARTED")) return "TURN_BOUNDARY";
  return "ACCEPTED_COMMAND";
}
