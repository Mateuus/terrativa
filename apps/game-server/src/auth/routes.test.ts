import type { AuthResponse } from "@terrativa/protocol";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../config.js";
import { buildHttpApp } from "../http.js";
import { MemoryAuthRepository } from "./memoryRepository.js";
import { AccessTokenService, type PasswordHasher } from "./security.js";
import { AuthService } from "./service.js";

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

async function createApp() {
  const authService = new AuthService(
    new MemoryAuthRepository(),
    new FastPasswordHasher(),
    new AccessTokenService(config.ACCESS_TOKEN_SECRET, config.ACCESS_TOKEN_TTL_SECONDS),
    {
      accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
      refreshTokenPepper: config.REFRESH_TOKEN_PEPPER,
    },
  );
  const app = await buildHttpApp(config, { authService });
  apps.push(app);
  return app;
}

describe("authentication routes", () => {
  it("registers, protects the profile and rotates with double-submit CSRF", async () => {
    const app = await createApp();
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "player@example.com",
        username: "player_01",
        displayName: "Jogador Um",
        password: "uma-senha-longa",
      },
    });

    expect(registration.statusCode).toBe(201);
    const auth = registration.json<AuthResponse>();
    const cookies = readSetCookies(registration.headers["set-cookie"]);
    expect(cookies.header).toContain("terrativa_refresh=");
    expect(cookies.header).not.toContain(auth.accessToken);

    const profile = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({ displayName: "Jogador Um" });

    const updatedProfile = await app.inject({
      method: "PATCH",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { displayName: "Explorador da Baixada", locale: "pt-BR" },
    });
    expect(updatedProfile.statusCode).toBe(200);
    expect(updatedProfile.json()).toMatchObject({ displayName: "Explorador da Baixada" });

    const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/me" });
    expect(unauthenticated.statusCode).toBe(401);

    const missingCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: cookies.header },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: cookies.header,
        "x-csrf-token": cookies.csrf,
      },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json<AuthResponse>().accessToken).not.toBe(auth.accessToken);
  });

  it("returns the same generic login error for unknown identity and wrong password", async () => {
    const app = await createApp();
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "player@example.com",
        username: "player_01",
        displayName: "Jogador Um",
        password: "uma-senha-longa",
      },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "unknown@example.com", password: "uma-senha-incorreta" },
    });
    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "player@example.com", password: "outra-senha-incorreta" },
    });

    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.json().error.messageKey).toBe("auth.invalidCredentials");
    expect(wrongPassword.json().error.messageKey).toBe("auth.invalidCredentials");
  });
});

function readSetCookies(value: string | string[] | undefined): {
  header: string;
  csrf: string;
} {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const pairs = values.map((cookie) => cookie.split(";", 1)[0] ?? "");
  const csrfPair = pairs.find((cookie) => cookie.startsWith("terrativa_csrf="));
  if (!csrfPair) {
    throw new Error("CSRF cookie missing");
  }
  return {
    header: pairs.join("; "),
    csrf: decodeURIComponent(csrfPair.slice("terrativa_csrf=".length)),
  };
}
