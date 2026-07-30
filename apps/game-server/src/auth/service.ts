import { randomUUID } from "node:crypto";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfile,
} from "@terrativa/protocol";
import {
  type AccessTokenService,
  createOpaqueToken,
  hashSensitiveValue,
  type PasswordHasher,
} from "./security.js";
import { LoginThrottle } from "./throttle.js";
import {
  type AccessPrincipal,
  AuthError,
  type AuthRepository,
  type AuthResult,
  type AuthUserRecord,
  DuplicateIdentityError,
  type NewAuthSession,
  type RequestFingerprint,
} from "./types.js";

const UNKNOWN_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$dGVycmF0aXZhLWR1bW15ISE$FldpPL8q71wckekLTKG8ahmgCQY7igbccKuuY6C4w8Q";

export interface AuthServiceOptions {
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlDays: number;
  readonly refreshTokenPepper: string;
  readonly now?: () => Date;
}

export class AuthService {
  readonly #now: () => Date;
  readonly #throttle = new LoginThrottle();

  constructor(
    private readonly repository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly options: AuthServiceOptions,
  ) {
    this.#now = options.now ?? (() => new Date());
  }

  async register(input: RegisterRequest, fingerprint: RequestFingerprint): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const username = input.username.toLowerCase();
    if (
      (await this.repository.findUserByEmail(email)) ||
      (await this.repository.findUserByUsername(username))
    ) {
      throw new AuthError("CONFLICT", 409, "auth.identityUnavailable");
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    let user: AuthUserRecord;
    try {
      user = await this.repository.createUser({
        ...input,
        email,
        username,
        id: randomUUID(),
        passwordHash,
      });
    } catch (error) {
      if (error instanceof DuplicateIdentityError) {
        throw new AuthError("CONFLICT", 409, "auth.identityUnavailable");
      }
      throw error;
    }

    return this.#createSessionResult(user, randomUUID(), fingerprint);
  }

  async login(input: LoginRequest, fingerprint: RequestFingerprint): Promise<AuthResult> {
    const now = this.#now();
    const key = this.#loginKey(input.email, fingerprint.ip);
    this.#throttle.assertAllowed(key, now);

    const user = await this.repository.findUserByEmail(input.email.toLowerCase());
    const validPassword = await this.passwordHasher.verify(
      user?.passwordHash ?? UNKNOWN_PASSWORD_HASH,
      input.password,
    );

    if (!user || !validPassword || user.status !== "ACTIVE") {
      this.#throttle.recordFailure(key, now);
      throw new AuthError("INVALID_CREDENTIALS", 401, "auth.invalidCredentials");
    }

    this.#throttle.recordSuccess(key);
    return this.#createSessionResult(user, randomUUID(), fingerprint);
  }

  async refresh(refreshToken: string, fingerprint: RequestFingerprint): Promise<AuthResult> {
    const now = this.#now();
    const nextToken = createOpaqueToken();
    const nextSessionId = randomUUID();
    const nextSession: NewAuthSession = {
      id: nextSessionId,
      userId: "",
      tokenHash: this.#hashRefresh(nextToken),
      tokenFamilyId: "",
      userAgentHash: this.#hashFingerprint(fingerprint.userAgent, "user-agent"),
      ipHash: this.#hashFingerprint(fingerprint.ip, "ip"),
      expiresAt: this.#refreshExpiry(now),
      createdAt: now,
    };

    const rotation = await this.repository.rotateRefresh(
      this.#hashRefresh(refreshToken),
      nextSession,
      now,
    );
    if (rotation.kind !== "rotated" || rotation.user.status !== "ACTIVE") {
      throw new AuthError("UNAUTHENTICATED", 401, "auth.sessionExpired");
    }

    return this.#buildResult(rotation.user, nextSessionId, nextToken);
  }

  async authenticate(accessToken: string): Promise<AccessPrincipal> {
    let principal: AccessPrincipal;
    try {
      principal = await this.accessTokens.verify(accessToken);
    } catch {
      throw new AuthError("UNAUTHENTICATED", 401, "auth.accessTokenInvalid");
    }

    const user = await this.repository.findUserById(principal.userId);
    if (user?.status !== "ACTIVE" || user.role !== principal.role) {
      throw new AuthError("UNAUTHENTICATED", 401, "auth.accessTokenInvalid");
    }
    return principal;
  }

  async getProfile(principal: AccessPrincipal): Promise<UserProfile> {
    const user = await this.repository.findUserById(principal.userId);
    if (user?.status !== "ACTIVE") {
      throw new AuthError("UNAUTHENTICATED", 401, "auth.accountUnavailable");
    }
    return this.#toProfile(user);
  }

  async updateProfile(
    principal: AccessPrincipal,
    input: UpdateProfileRequest,
  ): Promise<UserProfile> {
    const user = await this.repository.updateProfile(principal.userId, input);
    return this.#toProfile(user);
  }

  async logout(principal: AccessPrincipal, refreshToken: string | undefined): Promise<void> {
    const now = this.#now();
    if (refreshToken) {
      await this.repository.revokeFamilyByTokenHash(this.#hashRefresh(refreshToken), now);
      return;
    }
    await this.repository.revokeFamilyBySessionId(principal.sessionId, now);
  }

  async #createSessionResult(
    user: AuthUserRecord,
    familyId: string,
    fingerprint: RequestFingerprint,
  ): Promise<AuthResult> {
    const now = this.#now();
    const refreshToken = createOpaqueToken();
    const sessionId = randomUUID();
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: this.#hashRefresh(refreshToken),
      tokenFamilyId: familyId,
      userAgentHash: this.#hashFingerprint(fingerprint.userAgent, "user-agent"),
      ipHash: this.#hashFingerprint(fingerprint.ip, "ip"),
      expiresAt: this.#refreshExpiry(now),
      createdAt: now,
    });
    return this.#buildResult(user, sessionId, refreshToken);
  }

  async #buildResult(
    user: AuthUserRecord,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthResult> {
    const response: AuthResponse = {
      accessToken: await this.accessTokens.issue(
        { userId: user.id, sessionId, role: user.role },
        this.#now(),
      ),
      expiresInSeconds: this.options.accessTokenTtlSeconds,
      user: this.#toProfile(user),
    };
    return { response, refreshToken, csrfToken: createOpaqueToken() };
  }

  #toProfile(user: AuthUserRecord): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
      avatarKey: user.avatarKey,
      locale: user.locale,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  #hashRefresh(token: string): string {
    return hashSensitiveValue(token, this.options.refreshTokenPepper, "refresh-token");
  }

  #hashFingerprint(value: string | null, purpose: string): string | null {
    return value ? hashSensitiveValue(value, this.options.refreshTokenPepper, purpose) : null;
  }

  #refreshExpiry(now: Date): Date {
    return new Date(now.getTime() + this.options.refreshTokenTtlDays * 86_400_000);
  }

  #loginKey(email: string, ip: string | null): string {
    return hashSensitiveValue(
      `${email.toLowerCase()}\0${ip ?? "unknown"}`,
      this.options.refreshTokenPepper,
      "login-throttle",
    );
  }
}
