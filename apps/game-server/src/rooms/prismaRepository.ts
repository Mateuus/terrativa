import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@terrativa/database";
import type { RoomMemberRole, RoomStatus, UpdateRoomSettings } from "@terrativa/protocol";
import type { CreateRoomRecord, RoomRecord, RoomRepository } from "./types.js";
import { RoomError } from "./types.js";

const roomInclude = {
  board: { select: { name: true } },
  members: {
    include: {
      user: {
        include: { profile: true },
      },
    },
  },
} as const;

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly database: DatabaseClient) {}

  async boardExists(boardId: string): Promise<boolean> {
    return (
      (await this.database.board.count({
        where: { id: boardId, deletedAt: null },
      })) === 1
    );
  }

  async create(input: CreateRoomRecord): Promise<RoomRecord> {
    try {
      const room = await this.database.room.create({
        data: {
          id: input.id,
          code: input.code,
          name: input.name,
          ownerUserId: input.ownerUserId,
          boardId: input.boardId as string,
          mode: input.mode,
          presentationMode: input.presentationMode,
          visibility: input.visibility,
          passwordHash: input.passwordHash,
          minPlayers: input.minPlayers,
          maxPlayers: input.maxPlayers,
          turnDurationSeconds: input.turnDurationSeconds,
          allowSpectators: input.allowSpectators,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
          members: {
            create: {
              id: randomUUID(),
              userId: input.ownerUserId,
              role: "HOST",
              joinedAt: input.createdAt,
            },
          },
        },
        include: roomInclude,
      });
      return mapRoom(room);
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new RoomError("CONFLICT", 409, "room.codeCollision", true);
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new RoomError("BOARD_NOT_FOUND", 409, "room.boardSeedRequired");
      }
      throw error;
    }
  }

  async listPublic(now: Date): Promise<readonly RoomRecord[]> {
    await this.database.room.updateMany({
      where: { status: "OPEN", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    const rooms = await this.database.room.findMany({
      where: { visibility: "PUBLIC", status: "OPEN", expiresAt: { gt: now } },
      include: roomInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rooms.map(mapRoom);
  }

  async findByCode(code: string): Promise<RoomRecord | null> {
    const room = await this.database.room.findUnique({
      where: { code },
      include: roomInclude,
    });
    return room ? mapRoom(room) : null;
  }

  async join(
    roomId: string,
    userId: string,
    _displayName: string,
    role: Exclude<RoomMemberRole, "HOST">,
    now: Date,
  ): Promise<RoomRecord> {
    await this.database.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: {
        id: randomUUID(),
        roomId,
        userId,
        role,
        joinedAt: now,
      },
      update: {
        role,
        ready: false,
        joinedAt: now,
        leftAt: null,
      },
    });
    return this.#required(roomId);
  }

  async leave(roomId: string, userId: string, now: Date): Promise<RoomRecord> {
    await this.database.$transaction(async (transaction) => {
      await transaction.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: { ready: false, pawnKey: null, colorKey: null, leftAt: now },
      });
      const room = await transaction.room.findUnique({
        where: { id: roomId },
        include: { members: { where: { leftAt: null }, orderBy: { joinedAt: "asc" } } },
      });
      if (!room) {
        throw new RoomError("ROOM_NOT_FOUND", 404, "room.notFound");
      }
      const nextHost = room.members[0];
      if (!nextHost) {
        await transaction.room.update({ where: { id: roomId }, data: { status: "CLOSED" } });
      } else if (room.ownerUserId === userId) {
        await transaction.room.update({
          where: { id: roomId },
          data: { ownerUserId: nextHost.userId },
        });
        await transaction.roomMember.update({
          where: { id: nextHost.id },
          data: { role: "HOST" },
        });
      }
    });
    return this.#required(roomId);
  }

  async updateMember(
    roomId: string,
    userId: string,
    changes: { readonly ready?: boolean; readonly pawnKey?: string; readonly colorKey?: string },
  ): Promise<RoomRecord> {
    await this.database.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: changes,
    });
    return this.#required(roomId);
  }

  async updateSettings(roomId: string, settings: UpdateRoomSettings): Promise<RoomRecord> {
    const data: {
      name?: string;
      minPlayers?: number;
      maxPlayers?: number;
      turnDurationSeconds?: number;
      allowSpectators?: boolean;
      presentationMode?: "BOARD" | "CITY_3D";
    } = {};
    if (settings.name !== undefined) data.name = settings.name;
    if (settings.minPlayers !== undefined) data.minPlayers = settings.minPlayers;
    if (settings.maxPlayers !== undefined) data.maxPlayers = settings.maxPlayers;
    if (settings.turnDurationSeconds !== undefined) {
      data.turnDurationSeconds = settings.turnDurationSeconds;
    }
    if (settings.allowSpectators !== undefined) {
      data.allowSpectators = settings.allowSpectators;
    }
    if (settings.presentationMode !== undefined) {
      data.presentationMode = settings.presentationMode;
    }
    await this.database.room.update({ where: { id: roomId }, data });
    return this.#required(roomId);
  }

  async transferHost(roomId: string, fromUserId: string, toUserId: string): Promise<RoomRecord> {
    await this.database.$transaction([
      this.database.room.update({ where: { id: roomId }, data: { ownerUserId: toUserId } }),
      this.database.roomMember.update({
        where: { roomId_userId: { roomId, userId: fromUserId } },
        data: { role: "PLAYER" },
      }),
      this.database.roomMember.update({
        where: { roomId_userId: { roomId, userId: toUserId } },
        data: { role: "HOST" },
      }),
    ]);
    return this.#required(roomId);
  }

  async kick(roomId: string, userId: string, now: Date): Promise<RoomRecord> {
    await this.database.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { ready: false, pawnKey: null, colorKey: null, leftAt: now },
    });
    return this.#required(roomId);
  }

  async setStatus(roomId: string, status: RoomStatus): Promise<RoomRecord> {
    await this.database.room.update({ where: { id: roomId }, data: { status } });
    return this.#required(roomId);
  }

  async #required(roomId: string): Promise<RoomRecord> {
    const room = await this.database.room.findUnique({
      where: { id: roomId },
      include: roomInclude,
    });
    if (!room) {
      throw new RoomError("ROOM_NOT_FOUND", 404, "room.notFound");
    }
    return mapRoom(room);
  }
}

interface RoomShape {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly boardId: string;
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
  readonly board: { readonly name: string };
  readonly members: readonly {
    readonly id: string;
    readonly userId: string;
    readonly role: RoomMemberRole;
    readonly pawnKey: string | null;
    readonly colorKey: string | null;
    readonly ready: boolean;
    readonly joinedAt: Date;
    readonly leftAt: Date | null;
    readonly user: { readonly profile: { readonly displayName: string } | null };
  }[];
}

function mapRoom(room: RoomShape): RoomRecord {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    ownerUserId: room.ownerUserId,
    boardId: room.boardId,
    boardName: room.board.name,
    mode: room.mode,
    presentationMode: room.presentationMode,
    visibility: room.visibility,
    passwordHash: room.passwordHash,
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    turnDurationSeconds: room.turnDurationSeconds,
    allowSpectators: room.allowSpectators,
    status: room.status,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    members: room.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      displayName: member.user.profile?.displayName ?? "Jogador",
      role: member.role,
      pawnKey: member.pawnKey,
      colorKey: member.colorKey,
      ready: member.ready,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
    })),
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
