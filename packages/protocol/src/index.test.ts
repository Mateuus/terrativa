import { describe, expect, it } from "vitest";
import {
  commandEnvelopeSchema,
  createRoomRequestSchema,
  lobbyCommandSchema,
  loginRequestSchema,
  PROTOCOL_VERSION,
  rankingResponseSchema,
  registerRequestSchema,
  roomEntryResponseSchema,
  staticMeshSettingsSchema,
  updateProfileRequestSchema,
  worldAssetManifestSchema,
} from "./index.js";

describe("commandEnvelopeSchema", () => {
  it("accepts a valid versioned command", () => {
    const result = commandEnvelopeSchema.safeParse({
      protocolVersion: PROTOCOL_VERSION,
      commandId: "c358c956-9489-4d86-8228-873f85959e9d",
      type: "ROLL_DICE",
      expectedStateVersion: 4,
      sentAt: "2026-07-26T20:00:00.000Z",
      payload: {},
    });

    expect(result.success).toBe(true);
  });

  it("rejects identity fields smuggled into the envelope", () => {
    const result = commandEnvelopeSchema.safeParse({
      protocolVersion: PROTOCOL_VERSION,
      commandId: "c358c956-9489-4d86-8228-873f85959e9d",
      type: "ROLL_DICE",
      expectedStateVersion: 4,
      sentAt: "2026-07-26T20:00:00.000Z",
      payload: {},
      userId: "forged",
    });

    expect(result.success).toBe(false);
  });
});

describe("static mesh contracts", () => {
  it("accepts material and collision settings for a model asset", () => {
    expect(
      worldAssetManifestSchema.safeParse({
        id: "content/props/bridge.glb",
        kind: "model",
        url: "/content/props/bridge.glb",
        license: "project",
        modelType: "static-mesh",
        staticMesh: {
          collision: "mesh",
          castShadow: true,
          receiveShadow: true,
          materialOverride: {
            baseColor: "#c77b52",
            metallic: 0.1,
            roughness: 0.78,
            emissiveColor: "#000000",
            baseColorTextureUrl: "/content/textures/wood.png",
          },
        },
      }).success,
    ).toBe(true);
  });

  it("rejects static mesh settings on non-model assets and invalid ranges", () => {
    expect(
      worldAssetManifestSchema.safeParse({
        id: "content/textures/wood.png",
        kind: "texture",
        url: "/content/textures/wood.png",
        license: "project",
        modelType: "static-mesh",
      }).success,
    ).toBe(false);

    expect(
      staticMeshSettingsSchema.safeParse({
        collision: "box",
        castShadow: true,
        receiveShadow: true,
        materialOverride: {
          baseColor: "#ffffff",
          metallic: 2,
          roughness: 0.5,
          emissiveColor: "#000000",
          baseColorTextureUrl: "",
        },
      }).success,
    ).toBe(false);
  });
});

describe("room protocol", () => {
  it("normalizes room creation defaults and enforces private passwords", () => {
    expect(createRoomRequestSchema.parse({ name: "Rota pública" })).toMatchObject({
      mode: "CASUAL",
      visibility: "PUBLIC",
      minPlayers: 2,
      maxPlayers: 6,
      turnDurationSeconds: 60,
      allowSpectators: false,
    });
    expect(
      createRoomRequestSchema.safeParse({ name: "Rota privada", visibility: "PRIVATE" }).success,
    ).toBe(false);
  });

  it("validates a period leaderboard response", () => {
    expect(
      rankingResponseSchema.safeParse({
        season: {
          id: "aaea3605-337a-4dfe-9ef1-a92f8732c527",
          name: "Temporada 1",
          endsAt: "2026-12-31T23:59:59.999Z",
        },
        period: "WEEK",
        from: "2026-07-20T00:00:00.000Z",
        to: "2026-07-26T23:59:59.999Z",
        entries: [
          {
            position: 1,
            userId: "d0c6d752-a03a-4f4f-a720-4bf5d671fd13",
            displayName: "Exploradora",
            rating: 1042,
            periodPoints: 185,
            ratingDelta: 42,
            gamesPlayed: 2,
            wins: 1,
            bankruptcies: 0,
            averagePlacement: 1.5,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("validates lobby commands and rejects oversized chat", () => {
    expect(lobbyCommandSchema.parse({ type: "SET_READY", ready: true })).toEqual({
      type: "SET_READY",
      ready: true,
    });
    expect(
      lobbyCommandSchema.safeParse({ type: "SEND_LOBBY_CHAT", text: "x".repeat(301) }).success,
    ).toBe(false);
  });

  it("keeps room entry responses versionable and explicit", () => {
    expect(
      roomEntryResponseSchema.safeParse({
        room: {
          id: "d0c6d752-a03a-4f4f-a720-4bf5d671fd13",
          code: "ABC234",
          name: "Sala teste",
          boardId: "9b835496-1969-49f4-8aef-1d11da39c6ab",
          boardName: "Baixada Santista",
          mode: "RANKED",
          presentationMode: "BOARD",
          visibility: "PUBLIC",
          hasPassword: false,
          minPlayers: 2,
          maxPlayers: 6,
          playerCount: 1,
          spectatorCount: 0,
          turnDurationSeconds: 60,
          allowSpectators: false,
          status: "OPEN",
          expiresAt: "2026-07-26T18:00:00.000Z",
          ownerUserId: "d0c6d752-a03a-4f4f-a720-4bf5d671fd13",
          members: [],
        },
        realtime: { roomName: "lobby", roomCode: "ABC234" },
      }).success,
    ).toBe(true);
  });
});

describe("authentication contracts", () => {
  it("normalizes a valid registration email", () => {
    const input = registerRequestSchema.parse({
      email: "  PLAYER@Example.COM ",
      username: "player_01",
      displayName: "Jogador Um",
      password: "uma-senha-longa",
    });

    expect(input.email).toBe("player@example.com");
  });

  it("rejects short passwords and unknown login fields", () => {
    expect(
      registerRequestSchema.safeParse({
        email: "player@example.com",
        username: "player_01",
        displayName: "Jogador Um",
        password: "curta",
      }).success,
    ).toBe(false);

    expect(
      loginRequestSchema.safeParse({
        email: "player@example.com",
        password: "uma-senha-longa",
        userId: "forged",
      }).success,
    ).toBe(false);
  });

  it("rejects empty profile patches and unsafe avatar keys", () => {
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({ avatarKey: "<script>" }).success).toBe(false);
  });
});
