import { randomUUID } from "node:crypto";
import { type BoardContent, officialModules, toEngineBoard } from "@terrativa/board-content";
import type { DatabaseClient } from "@terrativa/database";
import {
  calculateNetWorth,
  createGame,
  type GameState,
  type InitialPlayer,
  validateGameState,
} from "@terrativa/game-engine";
import { cloneGameState, stateChecksum } from "./serialization.js";
import type {
  GameAcknowledgement,
  GameRepository,
  GameStartResult,
  PersistedCommand,
  StoredGame,
} from "./types.js";
import { GameServerError } from "./types.js";

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly database: DatabaseClient) {}

  async createFromRoom(roomCode: string, now: Date, seed: string): Promise<GameStartResult> {
    const room = await this.database.room.findUnique({
      where: { code: roomCode },
      include: {
        members: {
          where: { leftAt: null, role: { not: "SPECTATOR" } },
          orderBy: { joinedAt: "asc" },
          include: { user: { include: { profile: true } } },
        },
        game: true,
      },
    });
    if (!room || (room.status !== "STARTING" && room.status !== "STARTED")) {
      throw new GameServerError("ROOM_NOT_FOUND", "game.startingRoomNotFound");
    }
    if (room.game) {
      const stored = await this.load(room.game.id);
      if (!stored) throw new GameServerError("INTERNAL_ERROR", "game.snapshotUnavailable");
      return { gameId: room.game.id, roomCode, state: stored.state };
    }
    const content = findBoardContent(room.boardId);
    if (!content) {
      throw new GameServerError("BOARD_NOT_FOUND", "game.moduleNotLoaded");
    }
    const gameId = randomUUID();
    const players: InitialPlayer[] = room.members.map((member, turnOrder) => ({
      id: randomUUID(),
      userId: member.userId,
      displayName: member.user.profile?.displayName ?? member.user.username,
      pawnKey: requiredSelection(member.pawnKey, "pawn"),
      colorKey: requiredSelection(member.colorKey, "color"),
      turnOrder,
    }));
    const state = createGame({
      gameId,
      board: toEngineBoard(content),
      mode: room.mode,
      players,
      seed,
      startedAt: now.getTime(),
      turnDurationSeconds: room.turnDurationSeconds,
    });
    const checksum = stateChecksum(state);

    await this.database.$transaction(async (transaction) => {
      const current = await transaction.room.findUnique({
        where: { id: room.id },
        include: { game: true },
      });
      if (!current || current.game || current.status !== "STARTING") {
        throw new GameServerError("CONFLICT", "game.alreadyCreated");
      }
      await transaction.game.create({
        data: {
          id: gameId,
          roomId: room.id,
          boardId: room.boardId,
          boardVersion: state.board.version,
          mode: room.mode,
          status: "ACTIVE",
          stateVersion: state.version,
          currentPlayerId: state.currentPlayerId,
          round: state.round,
          startedAt: now,
          players: {
            create: players.map((player) => ({
              id: player.id,
              userId: player.userId,
              turnOrder: player.turnOrder,
              pawnKey: player.pawnKey,
              colorKey: player.colorKey,
            })),
          },
          snapshots: {
            create: {
              id: randomUUID(),
              version: state.version,
              stateJson: cloneGameState(state) as never,
              checksum,
              reason: "INITIAL",
              createdAt: now,
            },
          },
        },
      });
      await transaction.room.update({
        where: { id: room.id },
        data: { status: "STARTED" },
      });
    });
    return { gameId, roomCode, state };
  }

  async load(gameId: string): Promise<StoredGame | null> {
    const game = await this.database.game.findUnique({
      where: { id: gameId },
      include: {
        players: { select: { id: true, userId: true } },
        snapshots: { orderBy: { version: "desc" }, take: 20 },
      },
    });
    if (!game) return null;
    for (const snapshot of game.snapshots) {
      const state = snapshot.stateJson as unknown as GameState;
      if (stateChecksum(state) !== snapshot.checksum) continue;
      validateGameState(state);
      if (state.version !== game.stateVersion) {
        continue;
      }
      return {
        state: cloneGameState(state),
        players: game.players.map((player) => ({
          playerId: player.id,
          userId: player.userId,
        })),
      };
    }
    throw new GameServerError("INTERNAL_ERROR", "game.validSnapshotUnavailable");
  }

  async findByRoomCode(roomCode: string): Promise<string | null> {
    const room = await this.database.room.findUnique({
      where: { code: roomCode },
      select: { game: { select: { id: true } } },
    });
    return room?.game?.id ?? null;
  }

  async findAcknowledgement(
    gameId: string,
    commandId: string,
  ): Promise<GameAcknowledgement | null> {
    const command = await this.database.gameCommand.findUnique({
      where: { gameId_commandId: { gameId, commandId } },
      select: { acknowledgementJson: true },
    });
    return (command?.acknowledgementJson as unknown as GameAcknowledgement | undefined) ?? null;
  }

  async persistCommand(input: PersistedCommand): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const duplicate = await transaction.gameCommand.findUnique({
        where: { gameId_commandId: { gameId: input.gameId, commandId: input.commandId } },
        select: { id: true },
      });
      if (duplicate) return;
      const game = await transaction.game.findUnique({
        where: { id: input.gameId },
        select: { stateVersion: true, startedAt: true },
      });
      if (!game) throw new GameServerError("ROOM_NOT_FOUND", "game.notFound");
      if (input.acknowledgement.accepted && game.stateVersion !== input.expectedStateVersion) {
        throw new GameServerError("STATE_VERSION_MISMATCH", "game.stateVersionMismatch", true);
      }
      const commandId = randomUUID();
      await transaction.gameCommand.create({
        data: {
          id: commandId,
          gameId: input.gameId,
          commandId: input.commandId,
          actorPlayerId: input.actorPlayerId,
          commandType: input.commandType,
          expectedStateVersion: input.expectedStateVersion,
          accepted: input.acknowledgement.accepted,
          resultingStateVersion: input.acknowledgement.stateVersion,
          acknowledgementJson: input.acknowledgement as never,
          createdAt: input.now,
        },
      });
      if (!input.acknowledgement.accepted) return;

      const sequence = await transaction.gameEvent.aggregate({
        where: { gameId: input.gameId },
        _max: { sequence: true },
      });
      let nextSequence = (sequence._max.sequence ?? 0) + 1;
      for (const event of input.events) {
        await transaction.gameEvent.create({
          data: {
            id: randomUUID(),
            gameId: input.gameId,
            gameCommandId: commandId,
            version: input.state.version,
            sequence: nextSequence,
            eventType: event.type,
            actorPlayerId: event.actorPlayerId,
            payloadJson: event.payload as never,
            createdAt: input.now,
          },
        });
        nextSequence += 1;
      }
      await transaction.gameSnapshot.create({
        data: {
          id: randomUUID(),
          gameId: input.gameId,
          version: input.state.version,
          stateJson: cloneGameState(input.state) as never,
          checksum: stateChecksum(input.state),
          reason: input.snapshotReason,
          createdAt: input.now,
        },
      });
      const finished = input.state.status === "FINISHED";
      await transaction.game.update({
        where: { id: input.gameId },
        data: {
          status: finished ? "FINISHED" : "ACTIVE",
          stateVersion: input.state.version,
          currentPlayerId: input.state.currentPlayerId,
          round: input.state.round,
          winnerPlayerId: input.state.winnerPlayerId,
          finishReason: input.state.finishReason,
          finishedAt: finished ? input.now : null,
        },
      });
      if (finished) {
        for (const standing of input.state.finalStandings) {
          const player = input.state.players[standing.playerId];
          await transaction.gamePlayer.update({
            where: { id: standing.playerId },
            data: {
              finalPosition: standing.placement,
              finalBalance: player?.balance ?? 0,
              finalNetWorth: standing.netWorth,
              status: standing.status === "BANKRUPT" ? "BANKRUPT" : "ACTIVE",
              bankruptAt: standing.status === "BANKRUPT" ? input.now : null,
            },
          });
        }
        await transaction.gameResult.upsert({
          where: { gameId: input.gameId },
          create: {
            id: randomUUID(),
            gameId: input.gameId,
            winnerPlayerId: input.state.winnerPlayerId,
            durationSeconds: Math.max(
              0,
              Math.floor(
                (input.now.getTime() - (game.startedAt?.getTime() ?? input.now.getTime())) / 1_000,
              ),
            ),
            rounds: input.state.round,
            summaryJson: {
              standings: input.state.finalStandings,
              netWorth: Object.fromEntries(
                input.state.playerOrder.map((playerId) => [
                  playerId,
                  calculateNetWorth(input.state, playerId),
                ]),
              ),
            } as never,
          },
          update: {},
        });
      }
    });
  }

  async markDisconnected(gameId: string, playerId: string, now: Date): Promise<void> {
    await this.database.gamePlayer.updateMany({
      where: { id: playerId, gameId, status: "ACTIVE" },
      data: { status: "DISCONNECTED", disconnectedAt: now },
    });
  }

  async markConnected(gameId: string, playerId: string): Promise<void> {
    await this.database.gamePlayer.updateMany({
      where: { id: playerId, gameId, status: "DISCONNECTED" },
      data: { status: "ACTIVE", disconnectedAt: null },
    });
  }
}

function findBoardContent(boardId: string): BoardContent | null {
  for (const module of officialModules) {
    const board = module.boards.find((candidate) => candidate.id === boardId);
    if (board) return board;
  }
  return null;
}

function requiredSelection(value: string | null, label: string): string {
  if (!value) throw new GameServerError("PLAYER_NOT_READY", `game.${label}Required`);
  return value;
}
