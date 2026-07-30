import { describe, expect, it } from "vitest";
import { AccessTokenService, ArgonPasswordHasher } from "./security.js";

describe("authentication cryptography", () => {
  it("hashes passwords with Argon2id and verifies without exposing the password", async () => {
    const hasher = new ArgonPasswordHasher();
    const passwordHash = await hasher.hash("uma-senha-longa");

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain("uma-senha-longa");
    await expect(hasher.verify(passwordHash, "uma-senha-longa")).resolves.toBe(true);
    await expect(hasher.verify(passwordHash, "senha-incorreta")).resolves.toBe(false);
  });

  it("signs and validates constrained access-token claims", async () => {
    const tokens = new AccessTokenService("test-access-secret-that-is-long-enough", 900);
    const principal = {
      userId: "55b0a06a-eb99-4917-b036-c3d2aeb671c0",
      sessionId: "c68b1646-b1c9-4d06-82db-c3e3695d1636",
      role: "USER" as const,
    };

    const token = await tokens.issue(principal, new Date());
    await expect(tokens.verify(token)).resolves.toEqual(principal);
    await expect(tokens.verify(`${token}tampered`)).rejects.toThrow();
  });
});
