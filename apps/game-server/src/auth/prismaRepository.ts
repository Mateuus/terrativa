import type { DatabaseClient } from "@terrativa/database";
import type { RegisterRequest, UpdateProfileRequest } from "@terrativa/protocol";
import {
  type AuthRepository,
  type AuthUserRecord,
  DuplicateIdentityError,
  type NewAuthSession,
  type RotateRefreshResult,
} from "./types.js";

interface PrismaUserShape {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly role: "USER" | "MODERATOR" | "ADMIN";
  readonly status: "ACTIVE" | "SUSPENDED" | "DELETED";
  readonly emailVerifiedAt: Date | null;
  readonly profile: {
    readonly displayName: string;
    readonly avatarKey: string | null;
    readonly locale: string;
  } | null;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.database.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    return user ? mapUser(user) : null;
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    const user = await this.database.user.findUnique({
      where: { username },
      include: { profile: true },
    });
    return user ? mapUser(user) : null;
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.database.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    return user ? mapUser(user) : null;
  }

  async createUser(
    input: RegisterRequest & { readonly id: string; readonly passwordHash: string },
  ): Promise<AuthUserRecord> {
    try {
      const user = await this.database.user.create({
        data: {
          id: input.id,
          email: input.email,
          username: input.username.toLowerCase(),
          passwordHash: input.passwordHash,
          profile: {
            create: {
              displayName: input.displayName,
              locale: "pt-BR",
            },
          },
        },
        include: { profile: true },
      });
      return mapUser(user);
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateIdentityError();
      }
      throw error;
    }
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<AuthUserRecord> {
    const profileData: {
      displayName?: string;
      avatarKey?: string | null;
      locale?: string;
    } = {};
    if (input.displayName !== undefined) {
      profileData.displayName = input.displayName;
    }
    if (input.avatarKey !== undefined) {
      profileData.avatarKey = input.avatarKey;
    }
    if (input.locale !== undefined) {
      profileData.locale = input.locale;
    }

    const user = await this.database.user.update({
      where: { id: userId },
      data: { profile: { update: profileData } },
      include: { profile: true },
    });
    return mapUser(user);
  }

  async createSession(session: NewAuthSession): Promise<void> {
    await this.database.userSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        tokenFamilyId: session.tokenFamilyId,
        userAgentHash: session.userAgentHash,
        ipHash: session.ipHash,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
    });
  }

  async rotateRefresh(
    currentTokenHash: string,
    nextSession: NewAuthSession,
    now: Date,
  ): Promise<RotateRefreshResult> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.userSession.findUnique({
        where: { tokenHash: currentTokenHash },
        include: { user: { include: { profile: true } } },
      });
      if (!current || current.expiresAt <= now) {
        return { kind: "invalid" };
      }
      if (current.rotatedAt || current.revokedAt) {
        await transaction.userSession.updateMany({
          where: { tokenFamilyId: current.tokenFamilyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: "reused" };
      }

      const consumed = await transaction.userSession.updateMany({
        where: {
          id: current.id,
          rotatedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { rotatedAt: now },
      });
      if (consumed.count !== 1) {
        await transaction.userSession.updateMany({
          where: { tokenFamilyId: current.tokenFamilyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: "reused" };
      }

      await transaction.userSession.create({
        data: {
          id: nextSession.id,
          userId: current.userId,
          tokenHash: nextSession.tokenHash,
          tokenFamilyId: current.tokenFamilyId,
          userAgentHash: nextSession.userAgentHash,
          ipHash: nextSession.ipHash,
          expiresAt: nextSession.expiresAt,
          createdAt: nextSession.createdAt,
        },
      });
      return { kind: "rotated", user: mapUser(current.user) };
    });
  }

  async revokeFamilyBySessionId(sessionId: string, now: Date): Promise<void> {
    const session = await this.database.userSession.findUnique({ where: { id: sessionId } });
    if (session) {
      await this.database.userSession.updateMany({
        where: { tokenFamilyId: session.tokenFamilyId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
  }

  async revokeFamilyByTokenHash(tokenHash: string, now: Date): Promise<void> {
    const session = await this.database.userSession.findUnique({ where: { tokenHash } });
    if (session) {
      await this.database.userSession.updateMany({
        where: { tokenFamilyId: session.tokenFamilyId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
  }
}

function mapUser(user: PrismaUserShape): AuthUserRecord {
  if (!user.profile) {
    throw new Error("User profile invariant violated");
  }
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    displayName: user.profile.displayName,
    avatarKey: user.profile.avatarKey,
    locale: user.profile.locale,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
