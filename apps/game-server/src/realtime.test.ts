import type { AddressInfo } from "node:net";
import { Client } from "@colyseus/sdk";
import { baixadaSantistaContent, toEngineBoard } from "@terrativa/board-content";
import { createGame } from "@terrativa/game-engine";
import { afterEach, describe, expect, it } from "vitest";
import { ArgonPasswordHasher } from "./auth/security.js";
import type { GameRoomState } from "./games/GameRoom.js";
import { MemoryGameRepository } from "./games/memoryRepository.js";
import { GameService } from "./games/service.js";
import { buildHttpApp } from "./http.js";
import { buildRealtimeServer } from "./realtime.js";
import type { LobbyState } from "./rooms/LobbyRoom.js";
import { MemoryRoomRepository } from "./rooms/memoryRepository.js";
import { FOUNDATION_BOARD_ID, RoomService } from "./rooms/service.js";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

describe("shared Fastify and Colyseus server", () => {
  it("serves REST, Colyseus health and matchmaking on one port", async () => {
    const app = await buildHttpApp({
      NODE_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GAME_SERVER_HOST: "127.0.0.1",
      GAME_SERVER_PORT: 0,
      LOG_LEVEL: "silent",
      ACCESS_TOKEN_SECRET: "test-access-secret-that-is-long-enough",
      REFRESH_TOKEN_PEPPER: "test-refresh-pepper-that-is-long-enough",
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    await app.ready();

    const roomRepository = new MemoryRoomRepository(new Set([FOUNDATION_BOARD_ID]));
    const roomService = new RoomService(roomRepository, new ArgonPasswordHasher());
    const created = await roomService.create(
      { userId: "test-user", displayName: "Jogador teste" },
      {
        name: "Sala de teste",
        mode: "CASUAL",
        presentationMode: "BOARD",
        visibility: "PUBLIC",
        minPlayers: 2,
        maxPlayers: 6,
        turnDurationSeconds: 60,
        allowSpectators: false,
      },
    );
    const gameServer = buildRealtimeServer(
      app.server,
      async () => ({
        userId: "test-user",
        sessionId: "test-session",
        role: "USER",
      }),
      roomService,
      "http://localhost:5173",
    );
    await gameServer.listen(0, "127.0.0.1");
    cleanup.push(async () => {
      await gameServer.gracefullyShutdown(false);
      await app.close();
    });

    const { port } = app.server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${port}`;

    const [health, colyseusHealth, matchmaking] = await Promise.all([
      fetch(`${origin}/health`),
      fetch(`${origin}/__healthcheck`),
      fetch(`${origin}/matchmake/create/lobby`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-access-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ roomCode: created.room.code }),
      }),
    ]);

    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok", service: "game-server" });
    expect(colyseusHealth.status).toBe(200);
    expect(await colyseusHealth.text()).toBe("OK");
    expect(matchmaking.status).toBe(200);
    expect(await matchmaking.json()).toMatchObject({ name: "lobby" });
  });

  it("keeps two authenticated clients in one coherent lobby", async () => {
    const app = await buildHttpApp({
      NODE_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GAME_SERVER_HOST: "127.0.0.1",
      GAME_SERVER_PORT: 0,
      LOG_LEVEL: "silent",
      ACCESS_TOKEN_SECRET: "test-access-secret-that-is-long-enough",
      REFRESH_TOKEN_PEPPER: "test-refresh-pepper-that-is-long-enough",
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    await app.ready();

    const hostId = "d0c6d752-a03a-4f4f-a720-4bf5d671fd13";
    const guestId = "6a43e5f5-d73d-41ed-a8aa-79613203b80f";
    const roomService = new RoomService(
      new MemoryRoomRepository(new Set([FOUNDATION_BOARD_ID])),
      new ArgonPasswordHasher(),
    );
    const created = await roomService.create(
      { userId: hostId, displayName: "Anfitrião" },
      {
        name: "Lobby sincronizado",
        mode: "CASUAL",
        presentationMode: "BOARD",
        visibility: "PUBLIC",
        minPlayers: 2,
        maxPlayers: 6,
        turnDurationSeconds: 60,
        allowSpectators: false,
      },
    );
    await roomService.join({ userId: guestId, displayName: "Convidada" }, created.room.code, {
      asSpectator: false,
    });

    const gameServer = buildRealtimeServer(
      app.server,
      async (token) => ({
        userId: token === "host-token" ? hostId : guestId,
        sessionId: token,
        role: "USER",
      }),
      roomService,
      "http://localhost:5173",
    );
    await gameServer.listen(0, "127.0.0.1");

    const { port } = app.server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${port}`;
    const hostClient = new Client(endpoint, {
      headers: { origin: "http://localhost:5173" },
    });
    const guestClient = new Client(endpoint, {
      headers: { origin: "http://localhost:5173" },
    });
    hostClient.auth.token = "host-token";
    guestClient.auth.token = "guest-token";
    const hostRoom = await hostClient.joinOrCreate<LobbyState>("lobby", {
      roomCode: created.room.code,
    });
    const guestRoom = await guestClient.joinOrCreate<LobbyState>("lobby", {
      roomCode: created.room.code,
    });

    try {
      expect(guestRoom.roomId).toBe(hostRoom.roomId);
      await waitUntil(() => hostRoom.state.members.size === 2);
      expect(
        [...hostRoom.state.members.values()].map((member) => member.displayName).sort(),
      ).toEqual(["Anfitrião", "Convidada"].sort());

      guestRoom.send("LOBBY_COMMAND", { type: "SET_PAWN", pawnKey: "capybara" });
      guestRoom.send("LOBBY_COMMAND", { type: "SET_COLOR", colorKey: "mangrove" });
      guestRoom.send("LOBBY_COMMAND", { type: "SET_READY", ready: true });
      await waitUntil(() => hostRoom.state.members.get(guestId)?.ready === true);
      expect(hostRoom.state.members.get(guestId)).toMatchObject({
        pawnKey: "capybara",
        colorKey: "mangrove",
        ready: true,
      });
    } finally {
      await hostRoom.leave();
      await guestRoom.leave();
      await gameServer.gracefullyShutdown(false);
      await app.close();
    }
  });

  it("keeps game commands idempotent and reconnects a dropped player", async () => {
    const app = await buildHttpApp({
      NODE_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GAME_SERVER_HOST: "127.0.0.1",
      GAME_SERVER_PORT: 0,
      LOG_LEVEL: "silent",
      ACCESS_TOKEN_SECRET: "test-access-secret-that-is-long-enough",
      REFRESH_TOKEN_PEPPER: "test-refresh-pepper-that-is-long-enough",
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    await app.ready();
    const firstUserId = "9e836b4c-361c-4e49-895f-57dc946488ae";
    const secondUserId = "6004db87-c746-45b5-a221-a0b9b35395ed";
    const firstPlayerId = "145a0eb9-4da4-42d0-b53d-7418e55f4422";
    const secondPlayerId = "5808e2b5-cf3c-4c55-ae50-022d1341f32b";
    const gameId = "bd2a7f60-3cd0-46d9-aa3c-f5b9ee628703";
    const gameState = createGame({
      gameId,
      board: toEngineBoard(baixadaSantistaContent),
      mode: "CASUAL",
      players: [
        {
          id: firstPlayerId,
          userId: firstUserId,
          displayName: "Ana",
          pawnKey: "quaternius-women-01",
          colorKey: "ocean",
          turnOrder: 0,
        },
        {
          id: secondPlayerId,
          userId: secondUserId,
          displayName: "Beto",
          pawnKey: "quaternius-men-01",
          colorKey: "mangrove",
          turnOrder: 1,
        },
      ],
      seed: "realtime-phase-7",
      startedAt: Date.now(),
      turnDurationSeconds: 60,
    });
    const gameRepository = new MemoryGameRepository();
    gameRepository.seed("GAME23", gameState, [
      { playerId: firstPlayerId, userId: firstUserId },
      { playerId: secondPlayerId, userId: secondUserId },
    ]);
    const gameService = new GameService(gameRepository);
    const roomService = new RoomService(
      new MemoryRoomRepository(new Set([FOUNDATION_BOARD_ID])),
      new ArgonPasswordHasher(),
    );
    const gameServer = buildRealtimeServer(
      app.server,
      async () => ({ userId: firstUserId, sessionId: "game-session", role: "USER" }),
      roomService,
      "http://localhost:5173",
      gameService,
    );
    await gameServer.listen(0, "127.0.0.1");
    const { port } = app.server.address() as AddressInfo;
    const client = new Client(`http://127.0.0.1:${port}`, {
      headers: { origin: "http://localhost:5173" },
    });
    client.auth.token = "game-token";
    const room = await client.joinOrCreate<GameRoomState>("game", { gameId });

    try {
      const commandId = "45b6841e-0bee-4b92-8587-89024a109449";
      const command = {
        protocolVersion: 1,
        commandId,
        type: "ROLL_DICE",
        expectedStateVersion: 0,
        sentAt: new Date().toISOString(),
        payload: {},
      };
      room.send("GAME_COMMAND", command);
      await waitUntil(() => room.state.version === 1);
      room.send("GAME_COMMAND", command);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(room.state.version).toBe(1);

      room.reconnection.minUptime = 0;
      const reconnected = new Promise<void>((resolve) => room.onReconnect(resolve));
      room.connection.close(4010, "network-change");
      await reconnected;
      await waitUntil(() => !gameRepository.isDisconnected(gameId, firstPlayerId));
      expect(room.state.version).toBe(1);
    } finally {
      await room.leave();
      await gameServer.gracefullyShutdown(false);
      await app.close();
    }
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for synchronized lobby state");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
