import type {
  AuthResponse,
  ErrorCode,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfile,
} from "@terrativa/protocol";

export interface AuthUserRecord {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly role: UserProfile["role"];
  readonly status: UserProfile["status"];
  readonly emailVerifiedAt: Date | null;
  readonly displayName: string;
  readonly avatarKey: string | null;
  readonly locale: string;
}

export interface AuthSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly tokenFamilyId: string;
  readonly userAgentHash: string | null;
  readonly ipHash: string | null;
  readonly expiresAt: Date;
  readonly rotatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewAuthSession {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly tokenFamilyId: string;
  readonly userAgentHash: string | null;
  readonly ipHash: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export type RotateRefreshResult =
  | { readonly kind: "rotated"; readonly user: AuthUserRecord }
  | { readonly kind: "reused" }
  | { readonly kind: "invalid" };

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserByUsername(username: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  createUser(
    input: RegisterRequest & { readonly id: string; readonly passwordHash: string },
  ): Promise<AuthUserRecord>;
  updateProfile(userId: string, input: UpdateProfileRequest): Promise<AuthUserRecord>;
  createSession(session: NewAuthSession): Promise<void>;
  rotateRefresh(
    currentTokenHash: string,
    nextSession: NewAuthSession,
    now: Date,
  ): Promise<RotateRefreshResult>;
  revokeFamilyBySessionId(sessionId: string, now: Date): Promise<void>;
  revokeFamilyByTokenHash(tokenHash: string, now: Date): Promise<void>;
}

export interface RequestFingerprint {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export interface AccessPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly role: UserProfile["role"];
}

export interface AuthResult {
  readonly response: AuthResponse;
  readonly refreshToken: string;
  readonly csrfToken: string;
}

export class DuplicateIdentityError extends Error {
  constructor() {
    super("The normalized email or username is already registered");
    this.name = "DuplicateIdentityError";
  }
}

export class AuthError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly statusCode: number,
    readonly messageKey: string,
    readonly retryable = false,
  ) {
    super(messageKey);
    this.name = "AuthError";
  }
}
