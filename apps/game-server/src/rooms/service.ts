import { randomBytes, randomUUID } from "node:crypto";
import { isCharacterPawnKey } from "@terrativa/board-content/characters";
import type {
  CreateRoomRequest,
  JoinRoomRequest,
  RoomDetails,
  RoomEntryResponse,
  RoomMember,
  RoomSummary,
  UpdateRoomSettings,
} from "@terrativa/protocol";
import type { PasswordHasher } from "../auth/security.js";
import type { RoomMemberRecord, RoomRecord, RoomRepository } from "./types.js";
import { RoomError } from "./types.js";

export const FOUNDATION_BOARD_ID = "9b835496-1969-49f4-8aef-1d11da39c6ab";
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LEGACY_PAWN_KEYS = new Set([
  "explorer",
  "capybara",
  "schooner",
  "tram",
  "lighthouse",
  "mountain",
]);

export interface RoomActor {
  readonly userId: string;
  readonly displayName: string;
}

export interface RoomServiceOptions {
  readonly now?: () => Date;
  readonly roomLifetimeHours?: number;
}

export class RoomService {
  readonly #now: () => Date;
  readonly #roomLifetimeMs: number;

  constructor(
    private readonly repository: RoomRepository,
    private readonly passwordHasher: PasswordHasher,
    options: RoomServiceOptions = {},
  ) {
    this.#now = options.now ?? (() => new Date());
    this.#roomLifetimeMs = (options.roomLifetimeHours ?? 6) * 3_600_000;
  }

  async create(
    actor: RoomActor,
    input: CreateRoomRequest,
    source: "CUSTOM" | "OFFICIAL_QUEUE" = "CUSTOM",
  ): Promise<RoomEntryResponse> {
    if (input.mode === "RANKED" && source !== "OFFICIAL_QUEUE") {
      throw new RoomError("FORBIDDEN", 403, "ranking.officialQueueRequired");
    }
    if (
      source === "OFFICIAL_QUEUE" &&
      (input.mode !== "RANKED" || input.visibility !== "PUBLIC" || input.password)
    ) {
      throw new RoomError("INVALID_PAYLOAD", 400, "ranking.invalidOfficialRoom");
    }
    const boardId = input.boardId ?? FOUNDATION_BOARD_ID;
    if (!(await this.repository.boardExists(boardId))) {
      throw new RoomError("BOARD_NOT_FOUND", 409, "room.boardSeedRequired");
    }
    const now = this.#now();
    const passwordHash =
      input.visibility === "PRIVATE" && input.password
        ? await this.passwordHasher.hash(input.password)
        : null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const room = await this.repository.create({
          id: randomUUID(),
          code: createRoomCode(),
          name: input.name,
          boardId,
          mode: input.mode ?? "CASUAL",
          presentationMode: input.presentationMode ?? "BOARD",
          visibility: input.visibility ?? "PUBLIC",
          minPlayers: input.minPlayers ?? 2,
          maxPlayers: input.maxPlayers ?? 6,
          turnDurationSeconds: input.turnDurationSeconds ?? 60,
          allowSpectators: input.allowSpectators ?? false,
          ownerUserId: actor.userId,
          ownerDisplayName: actor.displayName,
          passwordHash,
          createdAt: now,
          expiresAt: new Date(now.getTime() + this.#roomLifetimeMs),
        });
        return entry(room);
      } catch (error) {
        if (!(error instanceof RoomError) || error.messageKey !== "room.codeCollision") {
          throw error;
        }
      }
    }
    throw new RoomError("SERVER_BUSY", 503, "room.codeUnavailable", true);
  }

  async listPublic(): Promise<readonly RoomSummary[]> {
    return (await this.repository.listPublic(this.#now())).map(summary);
  }

  async getDetails(roomCode: string): Promise<RoomDetails> {
    return details(await this.#activeRoom(roomCode));
  }

  async join(
    actor: RoomActor,
    roomCode: string,
    input: JoinRoomRequest,
  ): Promise<RoomEntryResponse> {
    const room = await this.#activeRoom(roomCode);
    const existing = activeMembers(room).find((member) => member.userId === actor.userId);
    if (!existing && room.passwordHash) {
      if (
        !input.password ||
        !(await this.passwordHasher.verify(room.passwordHash, input.password))
      ) {
        throw new RoomError("INVALID_ROOM_PASSWORD", 403, "room.invalidPassword");
      }
    }

    const role = input.asSpectator ? "SPECTATOR" : "PLAYER";
    if (role === "SPECTATOR" && !room.allowSpectators) {
      throw new RoomError("FORBIDDEN", 403, "room.spectatorsDisabled");
    }
    if (
      role === "PLAYER" &&
      !existing &&
      activeMembers(room).filter((member) => member.role !== "SPECTATOR").length >= room.maxPlayers
    ) {
      throw new RoomError("ROOM_FULL", 409, "room.full");
    }

    const joined = existing
      ? room
      : await this.repository.join(room.id, actor.userId, actor.displayName, role, this.#now());
    return entry(joined);
  }

  async leave(roomCode: string, userId: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#member(room, userId);
    return details(await this.repository.leave(room.id, userId, this.#now()));
  }

  async authorize(userId: string, roomCode: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#member(room, userId);
    return details(room);
  }

  getDetailsForLobby(roomCode: string): Promise<RoomDetails> {
    return this.getDetails(roomCode);
  }

  async setReady(roomCode: string, userId: string, ready: boolean): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    const member = this.#member(room, userId);
    if (member.role === "SPECTATOR") {
      throw new RoomError("FORBIDDEN", 403, "room.spectatorCannotReady");
    }
    return details(await this.repository.updateMember(room.id, userId, { ready }));
  }

  async setPawn(roomCode: string, userId: string, pawnKey: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#playingMember(room, userId);
    if (!isCharacterPawnKey(pawnKey) && !LEGACY_PAWN_KEYS.has(pawnKey)) {
      throw new RoomError("INVALID_PAYLOAD", 400, "room.invalidPawn");
    }
    if (
      activeMembers(room).some((member) => member.userId !== userId && member.pawnKey === pawnKey)
    ) {
      throw new RoomError("PAWN_UNAVAILABLE", 409, "room.pawnUnavailable");
    }
    return details(await this.repository.updateMember(room.id, userId, { pawnKey, ready: false }));
  }

  async setColor(roomCode: string, userId: string, colorKey: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#playingMember(room, userId);
    if (
      activeMembers(room).some((member) => member.userId !== userId && member.colorKey === colorKey)
    ) {
      throw new RoomError("COLOR_UNAVAILABLE", 409, "room.colorUnavailable");
    }
    return details(await this.repository.updateMember(room.id, userId, { colorKey, ready: false }));
  }

  async updateSettings(
    roomCode: string,
    userId: string,
    settings: UpdateRoomSettings,
  ): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#host(room, userId);
    const minPlayers = settings.minPlayers ?? room.minPlayers;
    const maxPlayers = settings.maxPlayers ?? room.maxPlayers;
    const playerCount = activeMembers(room).filter((member) => member.role !== "SPECTATOR").length;
    if (minPlayers > maxPlayers || playerCount > maxPlayers) {
      throw new RoomError("INVALID_PAYLOAD", 400, "room.invalidCapacity");
    }
    return details(await this.repository.updateSettings(room.id, settings));
  }

  async transferHost(roomCode: string, userId: string, targetUserId: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#host(room, userId);
    const target = this.#member(room, targetUserId);
    if (target.role === "SPECTATOR" || target.userId === userId) {
      throw new RoomError("INVALID_PAYLOAD", 400, "room.invalidHostTarget");
    }
    return details(await this.repository.transferHost(room.id, userId, targetUserId));
  }

  async kick(roomCode: string, userId: string, targetUserId: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#host(room, userId);
    this.#member(room, targetUserId);
    if (targetUserId === userId) {
      throw new RoomError("INVALID_PAYLOAD", 400, "room.hostCannotKickSelf");
    }
    return details(await this.repository.kick(room.id, targetUserId, this.#now()));
  }

  async startGame(roomCode: string, userId: string): Promise<RoomDetails> {
    const room = await this.#activeRoom(roomCode);
    this.#host(room, userId);
    const players = activeMembers(room).filter((member) => member.role !== "SPECTATOR");
    if (
      players.length < room.minPlayers ||
      players.some((member) => !member.ready || !member.pawnKey || !member.colorKey)
    ) {
      throw new RoomError("PLAYER_NOT_READY", 409, "room.playersNotReady");
    }
    return details(await this.repository.setStatus(room.id, "STARTING"));
  }

  #member(room: RoomRecord, userId: string): RoomMemberRecord {
    const member = activeMembers(room).find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new RoomError("FORBIDDEN", 403, "room.membershipRequired");
    }
    return member;
  }

  #playingMember(room: RoomRecord, userId: string): RoomMemberRecord {
    const member = this.#member(room, userId);
    if (member.role === "SPECTATOR") {
      throw new RoomError("FORBIDDEN", 403, "room.spectatorCannotSelect");
    }
    return member;
  }

  #host(room: RoomRecord, userId: string): void {
    if (this.#member(room, userId).role !== "HOST" || room.ownerUserId !== userId) {
      throw new RoomError("FORBIDDEN", 403, "room.hostRequired");
    }
  }

  async #activeRoom(roomCode: string): Promise<RoomRecord> {
    const room = await this.repository.findByCode(roomCode.toUpperCase());
    if (!room) {
      throw new RoomError("ROOM_NOT_FOUND", 404, "room.notFound");
    }
    if (room.expiresAt <= this.#now() || room.status === "EXPIRED" || room.status === "CLOSED") {
      throw new RoomError("ROOM_NOT_FOUND", 404, "room.notFound");
    }
    if (room.status !== "OPEN") {
      throw new RoomError("ROOM_ALREADY_STARTED", 409, "room.alreadyStarted");
    }
    return room;
  }
}

function activeMembers(room: RoomRecord): readonly RoomMemberRecord[] {
  return room.members.filter((member) => !member.leftAt);
}

function summary(room: RoomRecord): RoomSummary {
  const members = activeMembers(room);
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    boardId: room.boardId,
    boardName: room.boardName,
    mode: room.mode,
    presentationMode: room.presentationMode,
    visibility: room.visibility,
    hasPassword: Boolean(room.passwordHash),
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    playerCount: members.filter((member) => member.role !== "SPECTATOR").length,
    spectatorCount: members.filter((member) => member.role === "SPECTATOR").length,
    turnDurationSeconds: room.turnDurationSeconds,
    allowSpectators: room.allowSpectators,
    status: room.status,
    expiresAt: room.expiresAt.toISOString(),
  };
}

function details(room: RoomRecord): RoomDetails {
  return {
    ...summary(room),
    ownerUserId: room.ownerUserId,
    members: activeMembers(room).map(
      (member): RoomMember => ({
        userId: member.userId,
        displayName: member.displayName,
        role: member.role,
        pawnKey: member.pawnKey,
        colorKey: member.colorKey,
        ready: member.ready,
      }),
    ),
  };
}

function entry(room: RoomRecord): RoomEntryResponse {
  return {
    room: details(room),
    realtime: { roomName: "lobby", roomCode: room.code },
  };
}

function createRoomCode(): string {
  const bytes = randomBytes(6);
  return [...bytes]
    .map((byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length] as string)
    .join("");
}
