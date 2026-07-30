import { afterEach, describe, expect, it } from "vitest";
import { buildHttpApp } from "./http.js";

const apps: Awaited<ReturnType<typeof buildHttpApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health endpoints", () => {
  it("reports a valid health response", async () => {
    const app = await buildHttpApp({
      NODE_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GAME_SERVER_HOST: "127.0.0.1",
      GAME_SERVER_PORT: 2567,
      LOG_LEVEL: "silent",
      ACCESS_TOKEN_SECRET: "test-access-secret-that-is-long-enough",
      REFRESH_TOKEN_PEPPER: "test-refresh-pepper-that-is-long-enough",
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "game-server",
      version: "0.1.0",
    });
  });

  it("permite o cabeçalho CSRF usado pelo cliente web", async () => {
    const app = await buildHttpApp({
      NODE_ENV: "test",
      APP_ORIGIN: "http://localhost:5173",
      GAME_SERVER_HOST: "127.0.0.1",
      GAME_SERVER_PORT: 2567,
      LOG_LEVEL: "silent",
      ACCESS_TOKEN_SECRET: "test-access-secret-that-is-long-enough",
      REFRESH_TOKEN_PEPPER: "test-refresh-pepper-that-is-long-enough",
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    apps.push(app);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/auth/refresh",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-csrf-token",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-headers"]?.toLowerCase()).toContain(
      "x-csrf-token",
    );
  });
});
