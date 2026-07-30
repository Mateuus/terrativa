import type { RegisterRequest, UpdateProfileRequest } from "@terrativa/protocol";
import {
  type AuthRepository,
  type AuthSessionRecord,
  type AuthUserRecord,
  DuplicateIdentityError,
  type NewAuthSession,
  type RotateRefreshResult,
} from "./types.js";

export class MemoryAuthRepository implements AuthRepository {
  readonly #users = new Map<string, AuthUserRecord>();
  readonly #sessions = new Map<string, AuthSessionRecord>();

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return [...this.#users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    return [...this.#users.values()].find((user) => user.username === username) ?? null;
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    return this.#users.get(id) ?? null;
  }

  async createUser(
    input: RegisterRequest & { readonly id: string; readonly passwordHash: string },
  ): Promise<AuthUserRecord> {
    if (
      (await this.findUserByEmail(input.email)) ||
      (await this.findUserByUsername(input.username.toLowerCase()))
    ) {
      throw new DuplicateIdentityError();
    }

    const user: AuthUserRecord = {
      id: input.id,
      email: input.email,
      username: input.username.toLowerCase(),
      passwordHash: input.passwordHash,
      role: "USER",
      status: "ACTIVE",
      emailVerifiedAt: null,
      displayName: input.displayName,
      avatarKey: null,
      locale: "pt-BR",
    };
    this.#users.set(user.id, user);
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<AuthUserRecord> {
    const user = this.#users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updated: AuthUserRecord = {
      ...user,
      displayName: input.displayName ?? user.displayName,
      avatarKey: input.avatarKey === undefined ? user.avatarKey : input.avatarKey,
      locale: input.locale ?? user.locale,
    };
    this.#users.set(userId, updated);
    return updated;
  }

  async createSession(session: NewAuthSession): Promise<void> {
    this.#sessions.set(session.id, {
      ...session,
      rotatedAt: null,
      revokedAt: null,
    });
  }

  async rotateRefresh(
    currentTokenHash: string,
    nextSession: NewAuthSession,
    now: Date,
  ): Promise<RotateRefreshResult> {
    const current = [...this.#sessions.values()].find(
      (session) => session.tokenHash === currentTokenHash,
    );
    if (!current || current.expiresAt <= now) {
      return { kind: "invalid" };
    }
    if (current.rotatedAt || current.revokedAt) {
      this.#revokeFamily(current.tokenFamilyId, now);
      return { kind: "reused" };
    }

    this.#sessions.set(current.id, { ...current, rotatedAt: now });
    await this.createSession({
      ...nextSession,
      userId: current.userId,
      tokenFamilyId: current.tokenFamilyId,
    });
    const user = this.#users.get(current.userId);
    return user ? { kind: "rotated", user } : { kind: "invalid" };
  }

  async revokeFamilyBySessionId(sessionId: string, now: Date): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session) {
      this.#revokeFamily(session.tokenFamilyId, now);
    }
  }

  async revokeFamilyByTokenHash(tokenHash: string, now: Date): Promise<void> {
    const session = [...this.#sessions.values()].find((item) => item.tokenHash === tokenHash);
    if (session) {
      this.#revokeFamily(session.tokenFamilyId, now);
    }
  }

  #revokeFamily(tokenFamilyId: string, now: Date): void {
    for (const session of this.#sessions.values()) {
      if (session.tokenFamilyId === tokenFamilyId && !session.revokedAt) {
        this.#sessions.set(session.id, { ...session, revokedAt: now });
      }
    }
  }
}
