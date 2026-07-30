import type { LoginRequest, RegisterRequest } from "@terrativa/protocol";
import { describe, expect, it } from "vitest";
import { MemoryAuthRepository } from "./memoryRepository.js";
import { AccessTokenService, type PasswordHasher } from "./security.js";
import { AuthService } from "./service.js";
import type { RequestFingerprint } from "./types.js";

const fingerprint: RequestFingerprint = {
  ip: "127.0.0.1",
  userAgent: "vitest",
};

const registration: RegisterRequest = {
  email: "player@example.com",
  username: "player_01",
  displayName: "Jogador Um",
  password: "uma-senha-longa",
};

class FastPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test:${password}`;
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return passwordHash === `test:${password}`;
  }
}

function createService(): AuthService {
  return new AuthService(
    new MemoryAuthRepository(),
    new FastPasswordHasher(),
    new AccessTokenService("test-access-secret-that-is-long-enough", 900),
    {
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      refreshTokenPepper: "test-refresh-pepper-that-is-long-enough",
    },
  );
}

describe("AuthService", () => {
  it("registers, authenticates and returns the profile", async () => {
    const service = createService();
    const result = await service.register(registration, fingerprint);
    const principal = await service.authenticate(result.response.accessToken);

    expect(principal.userId).toBe(result.response.user.id);
    await expect(service.getProfile(principal)).resolves.toMatchObject({
      email: "player@example.com",
      username: "player_01",
      emailVerified: false,
    });
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const service = createService();
    const initial = await service.register(registration, fingerprint);
    const rotated = await service.refresh(initial.refreshToken, fingerprint);

    await expect(service.refresh(initial.refreshToken, fingerprint)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(service.refresh(rotated.refreshToken, fingerprint)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("uses generic conflicts and progressively blocks repeated login failures", async () => {
    const service = createService();
    await service.register(registration, fingerprint);
    await expect(service.register(registration, fingerprint)).rejects.toMatchObject({
      code: "CONFLICT",
      messageKey: "auth.identityUnavailable",
    });

    const invalidLogin: LoginRequest = {
      email: registration.email,
      password: "senha-incorreta",
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.login(invalidLogin, fingerprint)).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expect(service.login(invalidLogin, fingerprint)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("revokes the active family on logout", async () => {
    const service = createService();
    const result = await service.register(registration, fingerprint);
    const principal = await service.authenticate(result.response.accessToken);

    await service.logout(principal, result.refreshToken);
    await expect(service.refresh(result.refreshToken, fingerprint)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});
