import { randomUUID } from "node:crypto";
import { type Client, Room } from "@colyseus/core";
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { lobbyCommandSchema, type RoomDetails } from "@terrativa/protocol";
import type { AccessPrincipal } from "../auth/types.js";
import type { GameStarter, LobbyCoordinator, LobbyPrincipal } from "./types.js";
import { RoomError } from "./types.js";

export class LobbyMemberState extends Schema {
  @type("string") userId = "";
  @type("string") displayName = "";
  @type("string") role = "PLAYER";
  @type("string") pawnKey = "";
  @type("string") colorKey = "";
  @type("boolean") ready = false;
  @type("boolean") connected = false;
}

export class LobbyChatState extends Schema {
  @type("string") id = "";
  @type("string") userId = "";
  @type("string") displayName = "";
  @type("string") text = "";
  @type("number") sentAt = 0;
}

export class LobbyState extends Schema {
  @type("string") phase = "LOBBY";
  @type("string") roomCode = "";
  @type("string") roomName = "";
  @type("string") boardName = "";
  @type("string") mode = "CASUAL";
  @type("string") presentationMode = "BOARD";
  @type("string") ownerUserId = "";
  @type("string") status = "OPEN";
  @type("number") minPlayers = 2;
  @type("number") maxPlayers = 6;
  @type("number") turnDurationSeconds = 60;
  @type("boolean") allowSpectators = false;
  @type({ map: LobbyMemberState }) members = new MapSchema<LobbyMemberState>();
  @type([LobbyChatState]) chat = new ArraySchema<LobbyChatState>();
}

export interface LobbyJoinOptions {
  readonly roomCode?: string;
}

export class LobbyRoom extends Room<{ state: LobbyState }> {
  override maxClients = 6;
  override state = new LobbyState();
  protected coordinator!: LobbyCoordinator;
  protected gameStarter: GameStarter | null = null;
  readonly #chatWindows = new Map<string, number[]>();

  override async onCreate(options: LobbyJoinOptions): Promise<void> {
    if (!options.roomCode) {
      throw new Error("Room code is required");
    }
    this.autoDispose = true;
    this.onMessage("LOBBY_COMMAND", (client, payload: unknown) => {
      void this.#handleCommand(client, payload);
    });
  }

  override async onJoin(
    _client: Client,
    _options: LobbyJoinOptions,
    principal: LobbyPrincipal,
  ): Promise<void> {
    const room = await this.coordinator.getDetails(principal.roomCode);
    this.maxClients = room.maxPlayers + (room.allowSpectators ? 20 : 0);
    this.#sync(room);
    this.#markConnections();
  }

  override onLeave(): void {
    this.#markConnections();
  }

  #sync(room: RoomDetails): void {
    this.state.roomCode = room.code;
    this.state.roomName = room.name;
    this.state.boardName = room.boardName;
    this.state.mode = room.mode;
    this.state.presentationMode = room.presentationMode;
    this.state.ownerUserId = room.ownerUserId;
    this.state.status = room.status;
    this.state.minPlayers = room.minPlayers;
    this.state.maxPlayers = room.maxPlayers;
    this.state.turnDurationSeconds = room.turnDurationSeconds;
    this.state.allowSpectators = room.allowSpectators;

    const activeIds = new Set(room.members.map((member) => member.userId));
    for (const userId of this.state.members.keys()) {
      if (!activeIds.has(userId)) {
        this.state.members.delete(userId);
      }
    }
    for (const member of room.members) {
      const state = this.state.members.get(member.userId) ?? new LobbyMemberState();
      state.userId = member.userId;
      state.displayName = member.displayName;
      state.role = member.role;
      state.pawnKey = member.pawnKey ?? "";
      state.colorKey = member.colorKey ?? "";
      state.ready = member.ready;
      this.state.members.set(member.userId, state);
    }
    this.#markConnections();
  }

  #markConnections(): void {
    const connected = new Set(
      this.clients.map((client) => (client.auth as LobbyPrincipal | undefined)?.userId),
    );
    for (const member of this.state.members.values()) {
      member.connected = connected.has(member.userId);
    }
  }

  async #handleCommand(client: Client, payload: unknown): Promise<void> {
    const principal = client.auth as LobbyPrincipal;
    const parsed = lobbyCommandSchema.safeParse(payload);
    if (!parsed.success) {
      client.send("LOBBY_ERROR", {
        code: "INVALID_PAYLOAD",
        messageKey: "request.invalidPayload",
      });
      return;
    }

    try {
      const command = parsed.data;
      let room: RoomDetails | null = null;
      switch (command.type) {
        case "SET_READY":
          room = await this.coordinator.setReady(
            principal.roomCode,
            principal.userId,
            command.ready,
          );
          break;
        case "SET_PAWN":
          room = await this.coordinator.setPawn(
            principal.roomCode,
            principal.userId,
            command.pawnKey,
          );
          break;
        case "SET_COLOR":
          room = await this.coordinator.setColor(
            principal.roomCode,
            principal.userId,
            command.colorKey,
          );
          break;
        case "UPDATE_ROOM_SETTINGS":
          room = await this.coordinator.updateSettings(
            principal.roomCode,
            principal.userId,
            command.settings,
          );
          break;
        case "TRANSFER_HOST":
          room = await this.coordinator.transferHost(
            principal.roomCode,
            principal.userId,
            command.userId,
          );
          break;
        case "KICK_PLAYER":
          room = await this.coordinator.kick(principal.roomCode, principal.userId, command.userId);
          this.clients
            .find(
              (candidate) =>
                (candidate.auth as LobbyPrincipal | undefined)?.userId === command.userId,
            )
            ?.leave(4000, "removed-by-host");
          break;
        case "SEND_LOBBY_CHAT":
          this.#sendChat(principal, command.text);
          break;
        case "START_GAME": {
          room = await this.coordinator.startGame(principal.roomCode, principal.userId);
          const game = this.gameStarter
            ? await this.gameStarter.createFromRoom(principal.roomCode)
            : null;
          await this.lock();
          this.broadcast("GAME_START_PENDING", {
            roomCode: principal.roomCode,
            gameId: game?.gameId,
            roomName: "game",
            presentationMode: room.presentationMode,
          });
          break;
        }
      }
      if (room) {
        this.#sync(room);
      }
    } catch (error) {
      const handled =
        error instanceof RoomError
          ? error
          : new RoomError("INTERNAL_ERROR", 500, "server.internalError", true);
      client.send("LOBBY_ERROR", {
        code: handled.code,
        messageKey: handled.messageKey,
        retryable: handled.retryable,
      });
    }
  }

  #sendChat(principal: LobbyPrincipal, text: string): void {
    const now = Date.now();
    const recent = (this.#chatWindows.get(principal.userId) ?? []).filter(
      (timestamp) => timestamp > now - 10_000,
    );
    if (recent.length >= 5) {
      throw new RoomError("RATE_LIMITED", 429, "room.chatRateLimited", true);
    }
    recent.push(now);
    this.#chatWindows.set(principal.userId, recent);

    const member = this.state.members.get(principal.userId);
    if (!member) {
      throw new RoomError("FORBIDDEN", 403, "room.membershipRequired");
    }
    const message = new LobbyChatState();
    message.id = randomUUID();
    message.userId = principal.userId;
    message.displayName = member.displayName;
    message.text = text;
    message.sentAt = now;
    this.state.chat.push(message);
    while (this.state.chat.length > 50) {
      this.state.chat.shift();
    }
  }
}

export type RoomAuthenticator = (accessToken: string) => Promise<AccessPrincipal>;

export function createAuthenticatedLobbyRoom(
  authenticate: RoomAuthenticator,
  coordinator: LobbyCoordinator,
  gameStarter: GameStarter | null = null,
): typeof LobbyRoom {
  return class AuthenticatedLobbyRoom extends LobbyRoom {
    protected override coordinator = coordinator;
    protected override gameStarter = gameStarter;

    static override async onAuth(
      accessToken: string,
      options: LobbyJoinOptions,
    ): Promise<LobbyPrincipal> {
      if (!accessToken || !options.roomCode) {
        throw new Error("Access token and room code are required");
      }
      const principal = await authenticate(accessToken);
      const roomCode = options.roomCode.trim().toUpperCase();
      await coordinator.authorize(principal.userId, roomCode);
      return { ...principal, roomCode };
    }
  };
}
