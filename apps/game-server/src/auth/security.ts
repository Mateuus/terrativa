import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { argon2id, hash, verify } from "argon2";
import { jwtVerify, SignJWT } from "jose";
import type { AccessPrincipal } from "./types.js";

const JWT_ISSUER = "terrativa";
const JWT_AUDIENCE = "baixada-game-client";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export class ArgonPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSensitiveValue(value: string, pepper: string, purpose: string): string {
  return createHmac("sha256", pepper).update(purpose).update("\0").update(value).digest("hex");
}

export class AccessTokenService {
  readonly #key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.#key = new TextEncoder().encode(secret);
  }

  async issue(principal: AccessPrincipal, now: Date): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    return new SignJWT({ role: principal.role, sid: principal.sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setSubject(principal.userId)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.ttlSeconds)
      .sign(this.#key);
  }

  async verify(token: string): Promise<AccessPrincipal> {
    const { payload } = await jwtVerify(token, this.#key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    const { sub, sid, role } = payload as typeof payload & {
      readonly sid?: unknown;
      readonly role?: unknown;
    };

    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      !["USER", "MODERATOR", "ADMIN"].includes(String(role))
    ) {
      throw new Error("Invalid access token claims");
    }

    return {
      userId: sub,
      sessionId: sid,
      role: role as AccessPrincipal["role"],
    };
  }
}
