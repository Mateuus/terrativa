import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

export const staticMeshMaterialOverrideSchema = z
  .object({
    baseColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    metallic: z.number().min(0).max(1),
    roughness: z.number().min(0).max(1),
    emissiveColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    baseColorTextureUrl: z.string().max(1_024),
  })
  .strict();

export const staticMeshSettingsSchema = z
  .object({
    collision: z.enum(["none", "box", "mesh"]),
    castShadow: z.boolean(),
    receiveShadow: z.boolean(),
    materialOverride: staticMeshMaterialOverrideSchema.optional(),
  })
  .strict();

export const worldAssetManifestSchema = z
  .object({
    id: z.string().min(1).max(160),
    kind: z.enum(["model", "texture", "audio", "script", "data"]),
    url: z.string().min(1).max(1_024),
    license: z.string().min(1).max(160),
    modelType: z.literal("static-mesh").optional(),
    staticMesh: staticMeshSettingsSchema.optional(),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.kind !== "model" && (asset.modelType || asset.staticMesh)) {
      context.addIssue({
        code: "custom",
        message: "static mesh settings are only valid for model assets",
      });
    }
  });

export const worldScriptManifestSchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.js$/i),
    execution: z.literal("sandbox-required"),
  })
  .strict();

export const worldServerManifestSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    authority: z.literal("server"),
    roomType: z.literal("terrativa-world"),
    maxPlayers: z.int().min(2).max(100),
    tickRate: z.int().min(5).max(60),
    region: z.enum(["auto", "sa-east"]),
    sharding: z.literal("room"),
    scriptRuntime: z.literal("sandbox-required"),
    worldId: z.string().min(1).max(160),
    boardSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    stateSchema: z.literal("terrativa.world-state.v1"),
    routes: z.int().nonnegative().max(10_000),
    assets: z.array(worldAssetManifestSchema).max(5_000),
    scripts: z.array(worldScriptManifestSchema).max(500),
  })
  .strict();

export const worldPackageSchema = z
  .object({
    schemaVersion: z.literal(2),
    generatedAt: z.iso.datetime(),
    world: z
      .object({
        id: z.string().min(1).max(160),
        name: z.string().min(2).max(120),
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        scene: z
          .object({
            boardSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          })
          .passthrough(),
      })
      .passthrough(),
    serverManifest: worldServerManifestSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.world.slug !== value.world.scene.boardSlug ||
      value.world.slug !== value.serverManifest.boardSlug ||
      value.world.id !== value.serverManifest.worldId
    ) {
      context.addIssue({
        code: "custom",
        message: "world and server manifest identity must match",
      });
    }
  });

export type WorldPackage = z.infer<typeof worldPackageSchema>;

export const errorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_CREDENTIALS",
  "ACCOUNT_UNAVAILABLE",
  "CONFLICT",
  "CSRF_INVALID",
  "INVALID_PAYLOAD",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_ALREADY_STARTED",
  "INVALID_ROOM_PASSWORD",
  "PLAYER_NOT_READY",
  "PAWN_UNAVAILABLE",
  "COLOR_UNAVAILABLE",
  "BOARD_NOT_FOUND",
  "NOT_YOUR_TURN",
  "INVALID_GAME_PHASE",
  "DECISION_EXPIRED",
  "INSUFFICIENT_BALANCE",
  "PROPERTY_UNAVAILABLE",
  "INVALID_UPGRADE",
  "INVALID_TRADE",
  "INVALID_CARD",
  "PLAYER_UNAVAILABLE",
  "RANKING_UNAVAILABLE",
  "STATE_VERSION_MISMATCH",
  "DUPLICATE_COMMAND",
  "RATE_LIMITED",
  "SERVER_BUSY",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const userRoleSchema = z.enum(["USER", "MODERATOR", "ADMIN"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);

export const registerRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(320).email(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[a-zA-Z0-9_]+$/),
    displayName: z.string().trim().min(2).max(80),
    password: z.string().min(12).max(128),
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(320).email(),
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userProfileSchema = z
  .object({
    id: z.uuid(),
    email: z.string().email(),
    username: z.string(),
    role: userRoleSchema,
    status: userStatusSchema,
    displayName: z.string(),
    avatarKey: z.string().nullable(),
    locale: z.string(),
    emailVerified: z.boolean(),
  })
  .strict();

export type UserProfile = z.infer<typeof userProfileSchema>;

export const authResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    expiresInSeconds: z.int().positive(),
    user: userProfileSchema,
  })
  .strict();

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const updateProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    avatarKey: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9/_-]+$/)
      .nullable()
      .optional(),
    locale: z.enum(["pt-BR", "en-US", "es-419"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        messageKey: z.string().min(1),
        requestId: z.string().min(1),
        retryable: z.boolean(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;

export const roomVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const matchModeSchema = z.enum(["CASUAL", "RANKED"]);
export const presentationModeSchema = z.enum(["BOARD", "CITY_3D"]);
export const roomStatusSchema = z.enum(["OPEN", "STARTING", "STARTED", "CLOSED", "EXPIRED"]);
export const roomMemberRoleSchema = z.enum(["HOST", "PLAYER", "SPECTATOR"]);
export type RoomVisibility = z.infer<typeof roomVisibilitySchema>;
export type MatchMode = z.infer<typeof matchModeSchema>;
export type PresentationMode = z.infer<typeof presentationModeSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type RoomMemberRole = z.infer<typeof roomMemberRoleSchema>;

export const createRoomRequestSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    boardId: z.uuid().optional(),
    mode: matchModeSchema.default("CASUAL"),
    presentationMode: presentationModeSchema.default("BOARD"),
    visibility: roomVisibilitySchema.default("PUBLIC"),
    password: z.string().min(4).max(64).optional(),
    minPlayers: z.int().min(2).max(6).default(2),
    maxPlayers: z.int().min(2).max(6).default(6),
    turnDurationSeconds: z
      .union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)])
      .default(60),
    allowSpectators: z.boolean().default(false),
  })
  .strict()
  .refine((value) => value.minPlayers <= value.maxPlayers, {
    message: "minPlayers must not exceed maxPlayers",
    path: ["minPlayers"],
  })
  .refine((value) => value.visibility !== "PRIVATE" || Boolean(value.password), {
    message: "Private rooms require a password",
    path: ["password"],
  });

export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export const joinRoomRequestSchema = z
  .object({
    password: z.string().min(4).max(64).optional(),
    asSpectator: z.boolean().default(false),
  })
  .strict();

export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;

export const roomMemberSchema = z
  .object({
    userId: z.uuid(),
    displayName: z.string().min(1).max(80),
    role: roomMemberRoleSchema,
    pawnKey: z.string().max(80).nullable(),
    colorKey: z.string().max(40).nullable(),
    ready: z.boolean(),
    connected: z.boolean().optional(),
  })
  .strict();

export type RoomMember = z.infer<typeof roomMemberSchema>;

export const roomSummarySchema = z
  .object({
    id: z.uuid(),
    code: z.string().regex(/^[A-Z2-9]{6}$/),
    name: z.string().min(3).max(100),
    boardId: z.uuid(),
    boardName: z.string().min(1).max(120),
    mode: matchModeSchema,
    presentationMode: presentationModeSchema,
    visibility: roomVisibilitySchema,
    hasPassword: z.boolean(),
    minPlayers: z.int().min(2).max(6),
    maxPlayers: z.int().min(2).max(6),
    playerCount: z.int().nonnegative(),
    spectatorCount: z.int().nonnegative(),
    turnDurationSeconds: z.int().min(30).max(120),
    allowSpectators: z.boolean(),
    status: roomStatusSchema,
    expiresAt: z.iso.datetime(),
  })
  .strict();

export type RoomSummary = z.infer<typeof roomSummarySchema>;

export const roomDetailsSchema = roomSummarySchema
  .extend({
    ownerUserId: z.uuid(),
    members: z.array(roomMemberSchema),
  })
  .strict();

export type RoomDetails = z.infer<typeof roomDetailsSchema>;

export const roomEntryResponseSchema = z
  .object({
    room: roomDetailsSchema,
    realtime: z
      .object({
        roomName: z.literal("lobby"),
        roomCode: z.string().regex(/^[A-Z2-9]{6}$/),
      })
      .strict(),
  })
  .strict();

export type RoomEntryResponse = z.infer<typeof roomEntryResponseSchema>;

export const rankingPeriodSchema = z.enum(["DAY", "WEEK", "MONTH", "SEASON"]);
export type RankingPeriod = z.infer<typeof rankingPeriodSchema>;

export const rankingEntrySchema = z
  .object({
    position: z.int().positive(),
    userId: z.uuid(),
    displayName: z.string().min(1).max(80),
    rating: z.int(),
    periodPoints: z.int(),
    ratingDelta: z.int(),
    gamesPlayed: z.int().nonnegative(),
    wins: z.int().nonnegative(),
    bankruptcies: z.int().nonnegative(),
    averagePlacement: z.number().nonnegative(),
  })
  .strict();

export const rankingResponseSchema = z
  .object({
    season: z
      .object({
        id: z.uuid(),
        name: z.string().min(1).max(120),
        endsAt: z.iso.datetime(),
      })
      .strict(),
    period: rankingPeriodSchema,
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    entries: z.array(rankingEntrySchema),
  })
  .strict();

export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type RankingResponse = z.infer<typeof rankingResponseSchema>;

export const updateRoomSettingsSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    minPlayers: z.int().min(2).max(6).optional(),
    maxPlayers: z.int().min(2).max(6).optional(),
    turnDurationSeconds: z
      .union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)])
      .optional(),
    allowSpectators: z.boolean().optional(),
    presentationMode: presentationModeSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one room setting is required");

export type UpdateRoomSettings = z.infer<typeof updateRoomSettingsSchema>;

export const lobbyCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_READY"), ready: z.boolean() }).strict(),
  z.object({ type: z.literal("SET_PAWN"), pawnKey: z.string().trim().min(1).max(80) }).strict(),
  z.object({ type: z.literal("SET_COLOR"), colorKey: z.string().trim().min(1).max(40) }).strict(),
  z
    .object({ type: z.literal("UPDATE_ROOM_SETTINGS"), settings: updateRoomSettingsSchema })
    .strict(),
  z.object({ type: z.literal("TRANSFER_HOST"), userId: z.uuid() }).strict(),
  z.object({ type: z.literal("KICK_PLAYER"), userId: z.uuid() }).strict(),
  z
    .object({ type: z.literal("SEND_LOBBY_CHAT"), text: z.string().trim().min(1).max(300) })
    .strict(),
  z.object({ type: z.literal("START_GAME") }).strict(),
]);

export type LobbyCommand = z.infer<typeof lobbyCommandSchema>;

export const gameCommandTypeSchema = z.enum([
  "ROLL_DICE",
  "BUY_PROPERTY",
  "DECLINE_PROPERTY",
  "BUILD_UPGRADE",
  "SELL_UPGRADE",
  "MORTGAGE_PROPERTY",
  "UNMORTGAGE_PROPERTY",
  "CREATE_TRADE",
  "ACCEPT_TRADE",
  "REJECT_TRADE",
  "CANCEL_TRADE",
  "USE_CARD",
  "PAY_INSPECTION_FEE",
  "DECLARE_BANKRUPTCY",
  "END_TURN",
]);

export type GameCommandType = z.infer<typeof gameCommandTypeSchema>;

export const commandEnvelopeSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    commandId: z.uuid(),
    type: gameCommandTypeSchema,
    expectedStateVersion: z.int().nonnegative(),
    sentAt: z.iso.datetime(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

export const gameJoinOptionsSchema = z
  .object({
    gameId: z.uuid().optional(),
    roomCode: z
      .string()
      .regex(/^[A-Z2-9]{6}$/)
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.gameId || value.roomCode), {
    message: "gameId or roomCode is required",
  });

export type GameJoinOptions = z.infer<typeof gameJoinOptionsSchema>;

export const gameAcknowledgementSchema = z
  .object({
    commandId: z.uuid(),
    accepted: z.boolean(),
    stateVersion: z.int().nonnegative(),
    duplicate: z.boolean(),
    error: z
      .object({
        code: errorCodeSchema,
        messageKey: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export type GameAcknowledgement = z.infer<typeof gameAcknowledgementSchema>;

export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
    service: z.literal("game-server"),
    version: z.string(),
    timestamp: z.iso.datetime(),
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;
