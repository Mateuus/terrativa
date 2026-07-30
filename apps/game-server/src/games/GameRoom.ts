import { type Client, Room } from "@colyseus/core";
import { Encoder, MapSchema, Schema, type } from "@colyseus/schema";
import {
  commandEnvelopeSchema,
  type GameJoinOptions,
  gameJoinOptionsSchema,
} from "@terrativa/protocol";
import type { AccessPrincipal } from "../auth/types.js";
import type { RoomAuthenticator } from "../rooms/LobbyRoom.js";
import type { GameService } from "./service.js";
import { GameServerError } from "./types.js";

Encoder.BUFFER_SIZE = 256 * 1024;

export interface GamePrincipal extends AccessPrincipal {
  readonly gameId: string;
  readonly playerId: string;
}

export class GameConnectionState extends Schema {
  @type("string") playerId = "";
  @type("boolean") connected = false;
}

export class GameRoomState extends Schema {
  @type("string") gameId = "";
  @type("string") status = "ACTIVE";
  @type("string") phase = "AWAITING_ROLL";
  @type("number") version = 0;
  @type("number") round = 1;
  @type("string") currentPlayerId = "";
  @type("number") turnDeadlineAt = 0;
  @type("string") snapshotJson = "{}";
  @type({ map: GameConnectionState }) connections = new MapSchema<GameConnectionState>();
}

export class GameRoom extends Room<{ state: GameRoomState }> {
  override maxClients = 6;
  override state = new GameRoomState();
  protected gameService!: GameService;
  #gameId = "";

  override async onCreate(options: GameJoinOptions): Promise<void> {
    const parsed = gameJoinOptionsSchema.parse(options);
    const gameId = await this.gameService.resolveGameId(parsed);
    if (!gameId) throw new Error("Game id is required");
    this.#gameId = gameId;
    this.autoDispose = true;
    await this.#sync(await this.gameService.state(gameId));

    this.onMessage("GAME_COMMAND", (client, payload: unknown) => {
      void this.#handleCommand(client, payload);
    });
    this.onMessage("REQUEST_SYNC", (client) => {
      void this.#sendSync(client, true);
    });
    this.setSimulationInterval(() => {
      void this.#processTimeout();
    }, 1_000);
  }

  override async onJoin(
    client: Client,
    _options: GameJoinOptions,
    principal: GamePrincipal,
  ): Promise<void> {
    await this.gameService.markConnected(this.#gameId, principal.userId);
    this.#setConnection(principal.playerId, true);
    await this.#sendSync(client, false);
  }

  override onDrop(client: Client): void {
    const principal = client.auth as GamePrincipal;
    this.#setConnection(principal.playerId, false);
    void this.gameService.markDisconnected(this.#gameId, principal.userId);
    void this.allowReconnection(client, 120).catch(() => undefined);
  }

  override onReconnect(client: Client): void {
    const principal = client.auth as GamePrincipal;
    this.#setConnection(principal.playerId, true);
    void this.gameService.markConnected(this.#gameId, principal.userId);
    void this.#sendSync(client, true);
  }

  override onLeave(client: Client): void {
    const principal = client.auth as GamePrincipal;
    this.#setConnection(principal.playerId, false);
    void this.gameService.markDisconnected(this.#gameId, principal.userId);
  }

  async #handleCommand(client: Client, payload: unknown): Promise<void> {
    const parsed = commandEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      client.send("GAME_ERROR", {
        code: "INVALID_PAYLOAD",
        messageKey: "request.invalidPayload",
      });
      return;
    }
    const principal = client.auth as GamePrincipal;
    try {
      const result = await this.gameService.execute(this.#gameId, principal.userId, parsed.data);
      client.send("GAME_ACK", result.acknowledgement);
      if (!result.acknowledgement.accepted || result.acknowledgement.duplicate) return;
      await this.#sync(result.state);
      const visible = this.gameService.visibleEvents(result.events, principal.playerId);
      for (const event of visible.publicEvents) {
        this.broadcast("GAME_EVENT", {
          stateVersion: result.state.version,
          ...event,
        });
      }
      for (const target of this.clients) {
        const targetPrincipal = target.auth as GamePrincipal;
        const privateEvents = this.gameService.visibleEvents(
          result.events,
          targetPrincipal.playerId,
        ).privateEvents;
        for (const event of privateEvents) {
          target.send("GAME_PRIVATE_EVENT", {
            stateVersion: result.state.version,
            ...event,
          });
        }
        this.#sendPrivateState(target, result.state);
      }
    } catch (error) {
      if (error instanceof GameServerError) {
        client.send("GAME_ERROR", {
          code: error.code,
          messageKey: error.messageKey,
          retryable: error.retryable,
        });
        return;
      }
      client.send("GAME_ERROR", {
        code: "INTERNAL_ERROR",
        messageKey: "server.internalError",
        retryable: true,
      });
    }
  }

  async #processTimeout(): Promise<void> {
    const result = await this.gameService.processTimeout(this.#gameId);
    if (!result) return;
    await this.#sync(result.state);
    for (const event of this.gameService.visibleEvents(result.events, "").publicEvents) {
      this.broadcast("GAME_EVENT", {
        stateVersion: result.state.version,
        ...event,
      });
    }
    for (const client of this.clients) {
      const principal = client.auth as GamePrincipal;
      for (const event of this.gameService.visibleEvents(result.events, principal.playerId)
        .privateEvents) {
        client.send("GAME_PRIVATE_EVENT", {
          stateVersion: result.state.version,
          ...event,
        });
      }
      this.#sendPrivateState(client, result.state);
    }
  }

  async #sendSync(client: Client, resynced: boolean): Promise<void> {
    const state = await this.gameService.state(this.#gameId);
    await this.#sync(state);
    client.send(resynced ? "STATE_RESYNCED" : "GAME_STATE", {
      stateVersion: state.version,
      state: this.gameService.publicState(state),
    });
    this.#sendPrivateState(client, state);
  }

  #sendPrivateState(client: Client, state: Awaited<ReturnType<GameService["state"]>>): void {
    const principal = client.auth as GamePrincipal;
    client.send("GAME_PRIVATE_STATE", this.gameService.privateState(state, principal.playerId));
  }

  async #sync(state: Awaited<ReturnType<GameService["state"]>>): Promise<void> {
    this.state.gameId = state.gameId;
    this.state.status = state.status;
    this.state.phase = state.phase;
    this.state.version = state.version;
    this.state.round = state.round;
    this.state.currentPlayerId = state.currentPlayerId ?? "";
    this.state.turnDeadlineAt = state.turnDeadlineAt;
    this.state.snapshotJson = JSON.stringify(this.gameService.publicState(state));
  }

  #setConnection(playerId: string, connected: boolean): void {
    const connection = this.state.connections.get(playerId) ?? new GameConnectionState();
    connection.playerId = playerId;
    connection.connected = connected;
    this.state.connections.set(playerId, connection);
  }
}

export function createAuthenticatedGameRoom(
  authenticate: RoomAuthenticator,
  gameService: GameService,
): typeof GameRoom {
  return class AuthenticatedGameRoom extends GameRoom {
    protected override gameService = gameService;

    static override async onAuth(
      accessToken: string,
      options: GameJoinOptions,
    ): Promise<GamePrincipal> {
      if (!accessToken) throw new Error("Access token is required");
      const parsed = gameJoinOptionsSchema.parse(options);
      const principal = await authenticate(accessToken);
      const authorized = await gameService.authorize(principal.userId, parsed);
      return { ...principal, ...authorized };
    }
  };
}
