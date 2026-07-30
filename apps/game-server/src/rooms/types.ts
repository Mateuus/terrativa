import type {
  ErrorCode,
  RoomDetails,
  RoomMemberRole,
  RoomStatus,
  UpdateRoomSettings,
} from "@terrativa/protocol";

export interface RoomMemberRecord {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly role: RoomMemberRole;
  readonly pawnKey: string | null;
  readonly colorKey: string | null;
  readonly ready: boolean;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

export interface RoomRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly boardId: string;
  readonly boardName: string;
  readonly mode: "CASUAL" | "RANKED";
  readonly presentationMode: "BOARD" | "CITY_3D";
  readonly visibility: "PUBLIC" | "PRIVATE";
  readonly passwordHash: string | null;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly turnDurationSeconds: number;
  readonly allowSpectators: boolean;
  readonly status: RoomStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly members: readonly RoomMemberRecord[];
}

export interface CreateRoomRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly boardId: string;
  readonly mode: "CASUAL" | "RANKED";
  readonly presentationMode: "BOARD" | "CITY_3D";
  readonly visibility: "PUBLIC" | "PRIVATE";
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly turnDurationSeconds: number;
  readonly allowSpectators: boolean;
  readonly ownerUserId: string;
  readonly ownerDisplayName: string;
  readonly passwordHash: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface RoomRepository {
  boardExists(boardId: string): Promise<boolean>;
  create(input: CreateRoomRecord): Promise<RoomRecord>;
  listPublic(now: Date): Promise<readonly RoomRecord[]>;
  findByCode(code: string): Promise<RoomRecord | null>;
  join(
    roomId: string,
    userId: string,
    displayName: string,
    role: Exclude<RoomMemberRole, "HOST">,
    now: Date,
  ): Promise<RoomRecord>;
  leave(roomId: string, userId: string, now: Date): Promise<RoomRecord>;
  updateMember(
    roomId: string,
    userId: string,
    changes: { readonly ready?: boolean; readonly pawnKey?: string; readonly colorKey?: string },
  ): Promise<RoomRecord>;
  updateSettings(roomId: string, settings: UpdateRoomSettings): Promise<RoomRecord>;
  transferHost(roomId: string, fromUserId: string, toUserId: string): Promise<RoomRecord>;
  kick(roomId: string, userId: string, now: Date): Promise<RoomRecord>;
  setStatus(roomId: string, status: RoomStatus): Promise<RoomRecord>;
}

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly statusCode: number,
    readonly messageKey: string,
    readonly retryable = false,
  ) {
    super(messageKey);
    this.name = "RoomError";
  }
}

export interface LobbyPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly role: "USER" | "MODERATOR" | "ADMIN";
  readonly roomCode: string;
}

export interface LobbyCoordinator {
  authorize(userId: string, roomCode: string): Promise<RoomDetails>;
  getDetails(roomCode: string): Promise<RoomDetails>;
  setReady(roomCode: string, userId: string, ready: boolean): Promise<RoomDetails>;
  setPawn(roomCode: string, userId: string, pawnKey: string): Promise<RoomDetails>;
  setColor(roomCode: string, userId: string, colorKey: string): Promise<RoomDetails>;
  updateSettings(
    roomCode: string,
    userId: string,
    settings: UpdateRoomSettings,
  ): Promise<RoomDetails>;
  transferHost(roomCode: string, userId: string, targetUserId: string): Promise<RoomDetails>;
  kick(roomCode: string, userId: string, targetUserId: string): Promise<RoomDetails>;
  startGame(roomCode: string, userId: string): Promise<RoomDetails>;
}

export interface GameStarter {
  createFromRoom(roomCode: string): Promise<{ readonly gameId: string }>;
}
