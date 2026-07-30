import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PasswordHasher } from "../auth/security.js";
import { MemoryRoomRepository } from "./memoryRepository.js";
import { FOUNDATION_BOARD_ID, RoomService } from "./service.js";
import type { RoomError } from "./types.js";

class FastPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test:${password}`;
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return passwordHash === `test:${password}`;
  }
}

function setup(now = new Date("2026-07-26T12:00:00.000Z")) {
  const repository = new MemoryRoomRepository(new Set([FOUNDATION_BOARD_ID]));
  const service = new RoomService(repository, new FastPasswordHasher(), { now: () => now });
  return { repository, service };
}

const host = { userId: randomUUID(), displayName: "Anfitriã" };
const player = { userId: randomUUID(), displayName: "Explorador" };
const other = { userId: randomUUID(), displayName: "Navegadora" };

describe("room service", () => {
  it("creates and lists public rooms with the host reserved", async () => {
    const { service } = setup();
    const created = await service.create(host, {
      name: "Rota da Baixada",
      mode: "CASUAL",
      presentationMode: "BOARD",
      visibility: "PUBLIC",
      minPlayers: 2,
      maxPlayers: 4,
      turnDurationSeconds: 60,
      allowSpectators: true,
    });

    expect(created.room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.room.members).toEqual([
      expect.objectContaining({ userId: host.userId, role: "HOST" }),
    ]);
    expect(await service.listPublic()).toEqual([
      expect.objectContaining({ id: created.room.id, playerCount: 1 }),
    ]);
  });

  it("protects private rooms and reserves player capacity", async () => {
    const { service } = setup();
    const created = await service.create(host, {
      name: "Expedição privada",
      mode: "CASUAL",
      presentationMode: "BOARD",
      visibility: "PRIVATE",
      password: "segredo-local",
      minPlayers: 2,
      maxPlayers: 2,
      turnDurationSeconds: 60,
      allowSpectators: false,
    });

    await expect(
      service.join(player, created.room.code, { password: "incorreta", asSpectator: false }),
    ).rejects.toMatchObject({ code: "INVALID_ROOM_PASSWORD" });
    await service.join(player, created.room.code, {
      password: "segredo-local",
      asSpectator: false,
    });
    await expect(
      service.join(other, created.room.code, {
        password: "segredo-local",
        asSpectator: false,
      }),
    ).rejects.toMatchObject({ code: "ROOM_FULL" });
  });

  it("keeps pawn and color unique and only starts with prepared players", async () => {
    const { service } = setup();
    const created = await service.create(host, {
      name: "Partida preparada",
      mode: "CASUAL",
      presentationMode: "BOARD",
      visibility: "PUBLIC",
      minPlayers: 2,
      maxPlayers: 4,
      turnDurationSeconds: 60,
      allowSpectators: false,
    });
    await service.join(player, created.room.code, { asSpectator: false });
    await service.setPawn(created.room.code, host.userId, "tram");
    await service.setColor(created.room.code, host.userId, "ocean");

    await expect(service.setPawn(created.room.code, player.userId, "tram")).rejects.toMatchObject({
      code: "PAWN_UNAVAILABLE",
    });
    await service.setPawn(created.room.code, player.userId, "capybara");
    await service.setColor(created.room.code, player.userId, "mangrove");
    await service.setReady(created.room.code, host.userId, true);
    await expect(service.startGame(created.room.code, host.userId)).rejects.toMatchObject({
      code: "PLAYER_NOT_READY",
    });
    await service.setReady(created.room.code, player.userId, true);

    expect(await service.startGame(created.room.code, host.userId)).toMatchObject({
      status: "STARTING",
    });
  });

  it("transfers host ownership when the host leaves", async () => {
    const { service } = setup();
    const created = await service.create(host, {
      name: "Troca de anfitrião",
      mode: "CASUAL",
      presentationMode: "BOARD",
      visibility: "PUBLIC",
      minPlayers: 2,
      maxPlayers: 4,
      turnDurationSeconds: 60,
      allowSpectators: false,
    });
    await service.join(player, created.room.code, { asSpectator: false });

    const room = await service.leave(created.room.code, host.userId);

    expect(room.ownerUserId).toBe(player.userId);
    expect(room.members).toEqual([
      expect.objectContaining({ userId: player.userId, role: "HOST" }),
    ]);
  });

  it("returns a domain error when the foundation board has not been seeded", async () => {
    const service = new RoomService(new MemoryRoomRepository(), new FastPasswordHasher());

    await expect(
      service.create(host, {
        name: "Sem mapa",
        mode: "CASUAL",
        presentationMode: "BOARD",
        visibility: "PUBLIC",
        minPlayers: 2,
        maxPlayers: 6,
        turnDurationSeconds: 60,
        allowSpectators: false,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RoomError>>({
        code: "BOARD_NOT_FOUND",
        messageKey: "room.boardSeedRequired",
      }),
    );
  });

  it("allows ranked rooms only through the official queue", async () => {
    const { service } = setup();
    const input = {
      name: "Competitiva oficial",
      mode: "RANKED" as const,
      presentationMode: "BOARD" as const,
      visibility: "PUBLIC" as const,
      minPlayers: 2,
      maxPlayers: 4,
      turnDurationSeconds: 60 as const,
      allowSpectators: true,
    };

    await expect(service.create(host, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
      messageKey: "ranking.officialQueueRequired",
    });
    await expect(service.create(host, input, "OFFICIAL_QUEUE")).resolves.toMatchObject({
      room: { mode: "RANKED", visibility: "PUBLIC" },
    });
  });
});
