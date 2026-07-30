import { randomUUID } from "node:crypto";
import { baixadaSantistaContent, toEngineBoard } from "@terrativa/board-content";
import { createGame } from "@terrativa/game-engine";
import type { CommandEnvelope } from "@terrativa/protocol";
import { describe, expect, it } from "vitest";
import { MemoryGameRepository } from "./memoryRepository.js";
import { GameService } from "./service.js";

function setup(now = new Date("2026-07-26T12:00:00.000Z")) {
  const gameId = randomUUID();
  const firstPlayerId = randomUUID();
  const secondPlayerId = randomUUID();
  const firstUserId = randomUUID();
  const secondUserId = randomUUID();
  const state = createGame({
    gameId,
    board: toEngineBoard(baixadaSantistaContent),
    mode: "CASUAL",
    players: [
      {
        id: firstPlayerId,
        userId: firstUserId,
        displayName: "Ana",
        pawnKey: "quaternius-women-01",
        colorKey: "ocean",
        turnOrder: 0,
      },
      {
        id: secondPlayerId,
        userId: secondUserId,
        displayName: "Beto",
        pawnKey: "quaternius-men-01",
        colorKey: "mangrove",
        turnOrder: 1,
      },
    ],
    seed: "phase-7-test",
    startedAt: now.getTime(),
    turnDurationSeconds: 60,
  });
  const repository = new MemoryGameRepository();
  repository.seed("ABC234", state, [
    { playerId: firstPlayerId, userId: firstUserId },
    { playerId: secondPlayerId, userId: secondUserId },
  ]);
  const service = new GameService(repository, () => now);
  return {
    gameId,
    firstPlayerId,
    firstUserId,
    repository,
    service,
    state,
  };
}

function envelope(
  type: CommandEnvelope["type"],
  expectedStateVersion = 0,
  commandId = randomUUID(),
): CommandEnvelope {
  return {
    protocolVersion: 1,
    commandId,
    type,
    expectedStateVersion,
    sentAt: "2026-07-26T12:00:00.000Z",
    payload: {},
  };
}

describe("game service phase 7", () => {
  it("returns the persisted acknowledgement without applying a duplicate command twice", async () => {
    const { gameId, firstUserId, service } = setup();
    const command = envelope("ROLL_DICE");

    const first = await service.execute(gameId, firstUserId, command);
    const duplicate = await service.execute(gameId, firstUserId, command);

    expect(first.acknowledgement).toMatchObject({
      accepted: true,
      duplicate: false,
      stateVersion: 1,
    });
    expect(duplicate.acknowledgement).toMatchObject({
      accepted: true,
      duplicate: true,
      stateVersion: 1,
    });
    expect((await service.state(gameId)).version).toBe(1);
  });

  it("serializes concurrent commands and rejects the stale state version", async () => {
    const { gameId, firstUserId, service } = setup();

    const results = await Promise.all([
      service.execute(gameId, firstUserId, envelope("ROLL_DICE")),
      service.execute(gameId, firstUserId, envelope("ROLL_DICE")),
    ]);

    expect(results.filter((result) => result.acknowledgement.accepted)).toHaveLength(1);
    expect(
      results.find((result) => !result.acknowledgement.accepted)?.acknowledgement.error,
    ).toEqual(expect.objectContaining({ code: "STATE_VERSION_MISMATCH" }));
  });

  it("recovers the latest checksummed snapshot in a new service instance", async () => {
    const { gameId, firstUserId, repository, service } = setup();
    await service.execute(gameId, firstUserId, envelope("ROLL_DICE"));

    const recovered = new GameService(repository);

    expect(await recovered.state(gameId)).toEqual(await service.state(gameId));
  });

  it("marks a dropped player and restores the reservation on reconnect", async () => {
    const { firstPlayerId, firstUserId, gameId, repository, service } = setup();

    await service.markDisconnected(gameId, firstUserId);
    expect(repository.isDisconnected(gameId, firstPlayerId)).toBe(true);

    await service.markConnected(gameId, firstUserId);
    expect(repository.isDisconnected(gameId, firstPlayerId)).toBe(false);
  });

  it("refuses recovery when the snapshot checksum has been corrupted", async () => {
    const { gameId, repository } = setup();
    repository.corruptSnapshot(gameId);

    await expect(new GameService(repository).state(gameId)).rejects.toThrow(
      "Snapshot checksum mismatch",
    );
  });

  it("persists an automatic turn timeout as a versioned server command", async () => {
    const base = new Date("2026-07-26T12:00:00.000Z");
    const context = setup(base);
    const repository = new MemoryGameRepository();
    repository.seed("TIME23", context.state, [
      { playerId: context.firstPlayerId, userId: context.firstUserId },
      {
        playerId: context.state.playerOrder[1] as string,
        userId: context.state.players[context.state.playerOrder[1] as string]?.userId as string,
      },
    ]);
    const service = new GameService(repository, () => new Date(base.getTime() + 61_000));

    const timeout = await service.processTimeout(context.gameId);

    expect(timeout?.state.version).toBe(1);
    expect(timeout?.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "TURN_TIMEOUT_APPLIED" })]),
    );
  });
});
