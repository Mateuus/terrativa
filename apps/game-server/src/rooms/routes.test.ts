import type { AuthResponse, RoomEntryResponse } from "@terrativa/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryAuthRepository } from "../auth/memoryRepository.js";
import { AccessTokenService, type PasswordHasher } from "../auth/security.js";
import { AuthService } from "../auth/service.js";
import type { RuntimeConfig } from "../config.js";
import { buildHttpApp } from "../http.js";
import { MemoryRoomRepository } from "./memoryRepository.js";
import { FOUNDATION_BOARD_ID, RoomService } from "./service.js";

const config: RuntimeConfig = {
  NODE_ENV: "test",
  APP_ORIGIN: "http://localhost:5173",
  GAME_SERVER_HOST: "127.0.0.1",
  GAME_SERVER_PORT: 2567,
  LOG_LEVEL: "silent",
  ACCESS_TOKEN_SECRET: "test-access-secret-that-is-long-enough",
  REFRESH_TOKEN_PEPPER: "test-refresh-pepper-that-is-long-enough",
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 30,
};

class FastPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test:${password}`;
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return passwordHash === `test:${password}`;
  }
}

const apps: Awaited<ReturnType<typeof buildHttpApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("room routes", () => {
  it("creates, lists, joins and leaves through authenticated REST endpoints", async () => {
    const passwordHasher = new FastPasswordHasher();
    const authService = new AuthService(
      new MemoryAuthRepository(),
      passwordHasher,
      new AccessTokenService(config.ACCESS_TOKEN_SECRET, config.ACCESS_TOKEN_TTL_SECONDS),
      {
        accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
        refreshTokenPepper: config.REFRESH_TOKEN_PEPPER,
      },
    );
    const roomService = new RoomService(
      new MemoryRoomRepository(new Set([FOUNDATION_BOARD_ID])),
      passwordHasher,
    );
    const app = await buildHttpApp(config, { authService, roomService });
    apps.push(app);
    const host = await register(app, "host");
    const guest = await register(app, "guest");

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/rooms",
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: {
        name: "Sala REST",
        visibility: "PUBLIC",
        minPlayers: 2,
        maxPlayers: 4,
        turnDurationSeconds: 60,
        allowSpectators: false,
      },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<RoomEntryResponse>();

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/rooms",
      headers: { authorization: `Bearer ${guest.accessToken}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().rooms).toEqual([
      expect.objectContaining({ code: created.room.code, playerCount: 1 }),
    ]);

    const joined = await app.inject({
      method: "POST",
      url: `/api/v1/rooms/${created.room.code}/join`,
      headers: { authorization: `Bearer ${guest.accessToken}` },
      payload: { asSpectator: false },
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().room.members).toHaveLength(2);

    const left = await app.inject({
      method: "POST",
      url: `/api/v1/rooms/${created.room.code}/leave`,
      headers: { authorization: `Bearer ${host.accessToken}` },
      payload: {},
    });
    expect(left.statusCode).toBe(200);
    expect(left.json()).toMatchObject({ ownerUserId: guest.user.id });
  });
});

async function register(
  app: Awaited<ReturnType<typeof buildHttpApp>>,
  identity: string,
): Promise<AuthResponse> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email: `${identity}@example.com`,
      username: `${identity}_player`,
      displayName: identity,
      password: "uma-senha-longa",
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<AuthResponse>();
}
