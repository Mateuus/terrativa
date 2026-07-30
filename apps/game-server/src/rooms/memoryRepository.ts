import { randomUUID } from "node:crypto";
import type { RoomStatus, UpdateRoomSettings } from "@terrativa/protocol";
import type { CreateRoomRecord, RoomMemberRecord, RoomRecord, RoomRepository } from "./types.js";
import { RoomError } from "./types.js";

export class MemoryRoomRepository implements RoomRepository {
  readonly #rooms = new Map<string, RoomRecord>();

  constructor(private readonly boardIds = new Set<string>()) {}

  addBoard(boardId: string): void {
    this.boardIds.add(boardId);
  }

  async boardExists(boardId: string): Promise<boolean> {
    return this.boardIds.has(boardId);
  }

  async create(input: CreateRoomRecord): Promise<RoomRecord> {
    if ([...this.#rooms.values()].some((room) => room.code === input.code)) {
      throw new RoomError("CONFLICT", 409, "room.codeCollision", true);
    }
    const room: RoomRecord = {
      ...input,
      boardId: input.boardId as string,
      boardName: "Baixada Santista",
      status: "OPEN",
      members: [
        {
          id: randomUUID(),
          userId: input.ownerUserId,
          displayName: input.ownerDisplayName,
          role: "HOST",
          pawnKey: null,
          colorKey: null,
          ready: false,
          joinedAt: input.createdAt,
          leftAt: null,
        },
      ],
    };
    this.#rooms.set(room.id, room);
    return room;
  }

  async listPublic(now: Date): Promise<readonly RoomRecord[]> {
    this.#expire(now);
    return [...this.#rooms.values()]
      .filter((room) => room.visibility === "PUBLIC" && room.status === "OPEN")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async findByCode(code: string): Promise<RoomRecord | null> {
    return [...this.#rooms.values()].find((room) => room.code === code) ?? null;
  }

  async join(
    roomId: string,
    userId: string,
    displayName: string,
    role: "PLAYER" | "SPECTATOR",
    now: Date,
  ): Promise<RoomRecord> {
    return this.#change(roomId, (room) => {
      const current = room.members.find((member) => member.userId === userId);
      const members = current
        ? room.members.map((member) =>
            member.userId === userId
              ? { ...member, displayName, role, ready: false, leftAt: null, joinedAt: now }
              : member,
          )
        : [
            ...room.members,
            {
              id: randomUUID(),
              userId,
              displayName,
              role,
              pawnKey: null,
              colorKey: null,
              ready: false,
              joinedAt: now,
              leftAt: null,
            },
          ];
      return { ...room, members };
    });
  }

  async leave(roomId: string, userId: string, now: Date): Promise<RoomRecord> {
    return this.#change(roomId, (room) => {
      const members = room.members.map((member) =>
        member.userId === userId
          ? { ...member, ready: false, pawnKey: null, colorKey: null, leftAt: now }
          : member,
      );
      const active = members.filter((member) => !member.leftAt);
      if (active.length === 0) {
        return { ...room, members, status: "CLOSED" };
      }
      if (room.ownerUserId === userId) {
        const nextHost = [...active].sort(
          (left, right) => left.joinedAt.getTime() - right.joinedAt.getTime(),
        )[0] as RoomMemberRecord;
        return {
          ...room,
          ownerUserId: nextHost.userId,
          members: members.map((member) => ({
            ...member,
            role: member.userId === nextHost.userId ? "HOST" : member.role,
          })),
        };
      }
      return { ...room, members };
    });
  }

  async updateMember(
    roomId: string,
    userId: string,
    changes: { readonly ready?: boolean; readonly pawnKey?: string; readonly colorKey?: string },
  ): Promise<RoomRecord> {
    return this.#change(roomId, (room) => ({
      ...room,
      members: room.members.map((member) =>
        member.userId === userId ? { ...member, ...changes } : member,
      ),
    }));
  }

  async updateSettings(roomId: string, settings: UpdateRoomSettings): Promise<RoomRecord> {
    return this.#change(roomId, (room) => ({
      ...room,
      name: settings.name ?? room.name,
      minPlayers: settings.minPlayers ?? room.minPlayers,
      maxPlayers: settings.maxPlayers ?? room.maxPlayers,
      turnDurationSeconds: settings.turnDurationSeconds ?? room.turnDurationSeconds,
      allowSpectators: settings.allowSpectators ?? room.allowSpectators,
      presentationMode: settings.presentationMode ?? room.presentationMode,
    }));
  }

  async transferHost(roomId: string, fromUserId: string, toUserId: string): Promise<RoomRecord> {
    return this.#change(roomId, (room) => ({
      ...room,
      ownerUserId: toUserId,
      members: room.members.map((member) => ({
        ...member,
        role:
          member.userId === toUserId
            ? "HOST"
            : member.userId === fromUserId
              ? "PLAYER"
              : member.role,
      })),
    }));
  }

  async kick(roomId: string, userId: string, now: Date): Promise<RoomRecord> {
    return this.leave(roomId, userId, now);
  }

  async setStatus(roomId: string, status: RoomStatus): Promise<RoomRecord> {
    return this.#change(roomId, (room) => ({ ...room, status }));
  }

  #change(roomId: string, change: (room: RoomRecord) => RoomRecord): RoomRecord {
    const room = this.#rooms.get(roomId);
    if (!room) {
      throw new RoomError("ROOM_NOT_FOUND", 404, "room.notFound");
    }
    const updated = change(room);
    this.#rooms.set(roomId, updated);
    return updated;
  }

  #expire(now: Date): void {
    for (const [id, room] of this.#rooms) {
      if (room.status === "OPEN" && room.expiresAt <= now) {
        this.#rooms.set(id, { ...room, status: "EXPIRED" });
      }
    }
  }
}
