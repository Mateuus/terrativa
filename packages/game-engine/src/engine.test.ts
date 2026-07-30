import { describe, expect, it } from "vitest";
import {
  calculateRankedRatingChanges,
  createGame,
  executeCommand,
  processTimeouts,
  randomInteger,
  validateGameState,
} from "./index.js";
import { command, testBoard, testPlayers } from "./testFixtures.js";
import type { GameCommand, GameState } from "./types.js";

const startedAt = 1_000_000;

describe("deterministic game engine", () => {
  it("produces the same state and events for the same seed and command", () => {
    const first = newGame("repeatable-seed");
    const second = newGame("repeatable-seed");
    const firstResult = executeCommand(first, command(first, "ROLL_DICE", {}), {
      now: startedAt + 1_000,
    });
    const secondResult = executeCommand(second, command(second, "ROLL_DICE", {}), {
      now: startedAt + 1_000,
    });

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.events[0]).toMatchObject({ type: "DICE_ROLLED" });
  });

  it("purchases property and charges authoritative rent", () => {
    const game = newGame(seedForDiceTotal(2));
    const landed = executeCommand(game, command(game, "ROLL_DICE", {}), {
      now: startedAt + 1_000,
    }).state;
    expect(landed).toMatchObject({
      phase: "AWAITING_PURCHASE",
      activeDecision: { propertyId: "p1" },
    });

    const bought = executeCommand(landed, command(landed, "BUY_PROPERTY", {}), {
      now: startedAt + 2_000,
    }).state;
    expect(bought.properties["p1"]).toMatchObject({ ownerPlayerId: "player-1" });
    expect(bought.players["player-1"]?.balance).toBe(1_400);

    const rentSetup: GameState = {
      ...bought,
      currentPlayerId: "player-2",
      phase: "AWAITING_ROLL",
      rngState: rngStateForDiceTotal(2),
      players: {
        ...bought.players,
        "player-2": {
          ...(bought.players["player-2"] as NonNullable<(typeof bought.players)["player-2"]>),
          position: 0,
        },
      },
    };
    const rented = executeCommand(rentSetup, command(rentSetup, "ROLL_DICE", {}), {
      now: startedAt + 3_000,
    });

    expect(rented.events).toContainEqual(
      expect.objectContaining({
        type: "RENT_PAID",
        payload: expect.objectContaining({ amount: 10, creditorPlayerId: "player-1" }),
      }),
    );
    expect(rented.state.players["player-1"]?.balance).toBe(1_410);
    expect(rented.state.players["player-2"]?.balance).toBe(1_490);
  });

  it("enforces balanced upgrades and mortgage prerequisites", () => {
    let state = managementState({
      p1: { ownerPlayerId: "player-1", level: 0, mortgaged: false },
      p2: { ownerPlayerId: "player-1", level: 0, mortgaged: false },
    });
    state = execute(state, "BUILD_UPGRADE", { propertyId: "p1" }, startedAt + 1_000);
    expect(() =>
      execute(state, "BUILD_UPGRADE", { propertyId: "p1" }, startedAt + 2_000),
    ).toThrowError(expect.objectContaining({ code: "INVALID_UPGRADE" }));
    state = execute(state, "BUILD_UPGRADE", { propertyId: "p2" }, startedAt + 2_000);
    state = execute(state, "SELL_UPGRADE", { propertyId: "p1" }, startedAt + 3_000);
    expect(() =>
      execute(state, "MORTGAGE_PROPERTY", { propertyId: "p1" }, startedAt + 4_000),
    ).toThrowError(expect.objectContaining({ code: "INVALID_UPGRADE" }));
    state = execute(state, "SELL_UPGRADE", { propertyId: "p2" }, startedAt + 4_000);
    state = execute(state, "MORTGAGE_PROPERTY", { propertyId: "p1" }, startedAt + 5_000);

    expect(state.properties["p1"]).toMatchObject({ mortgaged: true, level: 0 });
  });

  it("enters debt resolution and finishes when the debtor declares bankruptcy", () => {
    const base = newGame("debt");
    const state: GameState = {
      ...base,
      currentPlayerId: "player-2",
      phase: "AWAITING_ROLL",
      rngState: rngStateForDiceTotal(2),
      properties: {
        ...base.properties,
        p1: { propertyId: "p1", ownerPlayerId: "player-1", level: 4, mortgaged: false },
        p2: { propertyId: "p2", ownerPlayerId: "player-1", level: 3, mortgaged: false },
      },
      players: {
        ...base.players,
        "player-2": {
          ...(base.players["player-2"] as NonNullable<(typeof base.players)["player-2"]>),
          balance: 5,
          position: 0,
        },
      },
    };
    const indebted = executeCommand(state, command(state, "ROLL_DICE", {}), {
      now: startedAt + 1_000,
    }).state;
    expect(indebted).toMatchObject({
      phase: "DEBT_RESOLUTION",
      pendingDebt: {
        debtorPlayerId: "player-2",
        creditorPlayerId: "player-1",
        amount: 250,
      },
    });

    const finished = executeCommand(indebted, command(indebted, "DECLARE_BANKRUPTCY", {}), {
      now: startedAt + 2_000,
    }).state;

    expect(finished).toMatchObject({
      status: "FINISHED",
      phase: "FINISHED",
      winnerPlayerId: "player-1",
      finishReason: "LAST_SOLVENT",
    });
    expect(finished.finalStandings).toEqual([
      expect.objectContaining({ playerId: "player-1", placement: 1 }),
      expect.objectContaining({ playerId: "player-2", placement: 2 }),
    ]);
  });

  it("executes a revalidated trade atomically", () => {
    let state = managementState({
      p1: { ownerPlayerId: "player-1", level: 0, mortgaged: false },
      p3: { ownerPlayerId: "player-2", level: 0, mortgaged: false },
    });
    state = executeCommand(
      state,
      command(
        state,
        "CREATE_TRADE",
        {
          tradeId: "trade-1",
          toPlayerId: "player-2",
          offered: { cash: 100, propertyIds: ["p1"], cardIds: [] },
          requested: { cash: 50, propertyIds: ["p3"], cardIds: [] },
        },
        "player-1",
      ),
      { now: startedAt + 1_000 },
    ).state;
    state = executeCommand(
      state,
      command(state, "ACCEPT_TRADE", { tradeId: "trade-1" }, "player-2"),
      { now: startedAt + 2_000 },
    ).state;

    expect(state.trades["trade-1"]?.status).toBe("ACCEPTED");
    expect(state.properties["p1"]?.ownerPlayerId).toBe("player-2");
    expect(state.properties["p3"]?.ownerPlayerId).toBe("player-1");
    expect(state.players["player-1"]?.balance).toBe(1_450);
    expect(state.players["player-2"]?.balance).toBe(1_550);
  });

  it("expires mandatory purchase decisions without trusting the client clock", () => {
    const game = newGame(seedForDiceTotal(2));
    const landed = executeCommand(game, command(game, "ROLL_DICE", {}), {
      now: startedAt + 1_000,
    }).state;
    const expired = processTimeouts(landed, {
      now: (landed.activeDecision?.expiresAt ?? 0) + 1,
    });

    expect(expired.state.phase).toBe("MANAGING");
    expect(expired.state.activeDecision).toBeNull();
    expect(expired.events).toContainEqual(expect.objectContaining({ type: "DECISION_EXPIRED" }));
  });

  it("applies deterministic cards and inspection release rules", () => {
    const base = newGame("cards");
    const cardState: GameState = {
      ...base,
      rngState: rngStateForDiceTotal(4),
      decks: {
        ...base.decks,
        REGIONAL_EVENT: {
          cardIds: ["event-receive", "event-pay", "event-move"],
          cursor: 0,
        },
      },
    };
    const afterCard = executeCommand(cardState, command(cardState, "ROLL_DICE", {}), {
      now: startedAt + 1_000,
    });
    expect(afterCard.events).toContainEqual(
      expect.objectContaining({
        type: "CARD_DRAWN_PUBLIC",
        payload: expect.objectContaining({ cardId: "event-receive" }),
      }),
    );
    expect(afterCard.state.players["player-1"]?.balance).toBe(1_580);

    const inspectionState: GameState = {
      ...afterCard.state,
      phase: "AWAITING_ROLL",
      currentPlayerId: "player-1",
      players: {
        ...afterCard.state.players,
        "player-1": {
          ...(afterCard.state.players["player-1"] as NonNullable<
            (typeof afterCard.state.players)["player-1"]
          >),
          position: testBoard.inspectionPosition,
          inspectionTurns: 1,
          heldCardIds: ["benefit-inspection"],
        },
      },
    };
    const released = executeCommand(
      inspectionState,
      command(inspectionState, "USE_CARD", { cardId: "benefit-inspection" }),
      { now: startedAt + 2_000 },
    );
    expect(released.state.players["player-1"]).toMatchObject({
      inspectionTurns: 0,
      heldCardIds: [],
    });
    expect(released.events).toContainEqual(
      expect.objectContaining({
        type: "INSPECTION_RELEASED",
        payload: { method: "CARD" },
      }),
    );
  });

  it("rejects stale and duplicate commands before mutating state", () => {
    const state = managementState({});
    const stale = {
      ...command(state, "END_TURN", {}),
      expectedStateVersion: state.version + 1,
    };
    expect(() => executeCommand(state, stale, { now: startedAt + 1_000 })).toThrowError(
      expect.objectContaining({ code: "STATE_VERSION_MISMATCH" }),
    );

    const accepted = executeCommand(state, command(state, "END_TURN", {}), {
      now: startedAt + 1_000,
    }).state;
    expect(() =>
      executeCommand(
        accepted,
        {
          ...command(accepted, "ROLL_DICE", {}),
          commandId: accepted.processedCommandIds[0] as string,
        },
        { now: startedAt + 2_000 },
      ),
    ).toThrowError(expect.objectContaining({ code: "DUPLICATE_COMMAND" }));
  });

  it("simulates a complete game without impossible states", () => {
    let state = newGame("full-simulation");
    let sequence = 0;
    for (; sequence < 2_000 && state.status === "ACTIVE"; sequence += 1) {
      const now = startedAt + sequence * 1_000;
      switch (state.phase) {
        case "AWAITING_ROLL":
          state = executeCommand(
            state,
            {
              ...command(state, "ROLL_DICE", {}),
              commandId: `simulation-${sequence}`,
            },
            { now },
          ).state;
          break;
        case "AWAITING_PURCHASE": {
          const property = testBoard.properties.find(
            (candidate) => candidate.id === state.activeDecision?.propertyId,
          );
          const canBuy =
            property &&
            (state.players[state.currentPlayerId as string]?.balance ?? 0) >= property.price;
          state = executeCommand(
            state,
            {
              ...command(state, canBuy ? "BUY_PROPERTY" : "DECLINE_PROPERTY", {}),
              commandId: `simulation-${sequence}`,
            } as GameCommand,
            { now },
          ).state;
          break;
        }
        case "MANAGING":
          state = executeCommand(
            state,
            {
              ...command(state, "END_TURN", {}),
              commandId: `simulation-${sequence}`,
            },
            { now },
          ).state;
          break;
        case "DEBT_RESOLUTION": {
          const playerId = state.currentPlayerId as string;
          const sellable = testBoard.properties.find(
            (definition) =>
              state.properties[definition.id]?.ownerPlayerId === playerId &&
              (state.properties[definition.id]?.level ?? 0) > 0,
          );
          const mortgageable = testBoard.properties.find(
            (definition) =>
              state.properties[definition.id]?.ownerPlayerId === playerId &&
              !state.properties[definition.id]?.mortgaged &&
              testBoard.groups
                .find((group) => group.id === definition.groupId)
                ?.propertyIds.every(
                  (propertyId) => (state.properties[propertyId]?.level ?? 0) === 0,
                ),
          );
          const action = sellable
            ? ({ type: "SELL_UPGRADE", payload: { propertyId: sellable.id } } as const)
            : mortgageable
              ? ({
                  type: "MORTGAGE_PROPERTY",
                  payload: { propertyId: mortgageable.id },
                } as const)
              : ({ type: "DECLARE_BANKRUPTCY", payload: {} } as const);
          state = executeCommand(
            state,
            {
              commandId: `simulation-${sequence}`,
              actorPlayerId: playerId,
              expectedStateVersion: state.version,
              ...action,
            } as GameCommand,
            { now },
          ).state;
          break;
        }
        case "FINISHED":
          break;
      }
      validateGameState(state);
    }

    expect(sequence).toBeLessThan(2_000);
    expect(state.status).toBe("FINISHED");
    expect(state.finalStandings).toHaveLength(2);
  });
});

describe("ranked rating", () => {
  it("calculates a deterministic zero-sum multiplayer Elo change", () => {
    const changes = calculateRankedRatingChanges(
      [
        { playerId: "p1", placement: 1, netWorth: 2_000, status: "ACTIVE" },
        { playerId: "p2", placement: 2, netWorth: 1_500, status: "ACTIVE" },
        { playerId: "p3", placement: 3, netWorth: 900, status: "BANKRUPT" },
        { playerId: "p4", placement: 4, netWorth: 0, status: "BANKRUPT" },
      ],
      ["p1", "p2", "p3", "p4"].map((playerId) => ({
        playerId,
        rating: 1_000,
        gamesPlayed: 0,
      })),
    );

    expect(changes.map((change) => change.delta).reduce((sum, delta) => sum + delta, 0)).toBe(0);
    expect(changes[0]).toMatchObject({ playerId: "p1", placement: 1 });
    expect(changes[0]?.delta).toBeGreaterThan(0);
    expect(changes[3]?.delta).toBeLessThan(0);
  });

  it("penalizes bankruptcy independently from placement and keeps a public performance score", () => {
    const ratings = ["p1", "p2", "p3"].map((playerId) => ({
      playerId,
      rating: 1_000,
      gamesPlayed: 4,
    }));
    const solvent = calculateRankedRatingChanges(
      [
        { playerId: "p1", placement: 1, netWorth: 2_000, status: "ACTIVE" },
        { playerId: "p2", placement: 2, netWorth: 1_000, status: "ACTIVE" },
        { playerId: "p3", placement: 3, netWorth: 0, status: "BANKRUPT" },
      ],
      ratings,
    );
    const bankrupt = calculateRankedRatingChanges(
      [
        { playerId: "p1", placement: 1, netWorth: 2_000, status: "ACTIVE" },
        { playerId: "p2", placement: 2, netWorth: 1_000, status: "BANKRUPT" },
        { playerId: "p3", placement: 3, netWorth: 0, status: "BANKRUPT" },
      ],
      ratings,
    );

    const solventPlayer = solvent.find((change) => change.playerId === "p2");
    const bankruptPlayer = bankrupt.find((change) => change.playerId === "p2");
    expect(bankruptPlayer?.performanceScore).toBeLessThan(solventPlayer?.performanceScore ?? 0);
    expect(bankruptPlayer?.periodPoints).toBeLessThan(solventPlayer?.periodPoints ?? 0);
  });
});

function newGame(seed: string | number): GameState {
  return createGame({
    gameId: "game-test",
    board: testBoard,
    mode: "RANKED",
    players: testPlayers,
    seed,
    startedAt,
    turnDurationSeconds: 60,
  });
}

function managementState(
  propertyChanges: Readonly<
    Record<
      string,
      {
        readonly ownerPlayerId: string | null;
        readonly level: number;
        readonly mortgaged: boolean;
      }
    >
  >,
): GameState {
  const base = newGame("management");
  return {
    ...base,
    phase: "MANAGING",
    properties: {
      ...base.properties,
      ...Object.fromEntries(
        Object.entries(propertyChanges).map(([propertyId, property]) => [
          propertyId,
          { propertyId, ...property },
        ]),
      ),
    },
  };
}

function execute(
  state: GameState,
  type: GameCommand["type"],
  payload: GameCommand["payload"],
  now: number,
): GameState {
  return executeCommand(state, command(state, type, payload), { now }).state;
}

function seedForDiceTotal(total: number): number {
  for (let seed = 1; seed < 10_000; seed += 1) {
    const state = newGame(seed);
    if (diceTotal(state.rngState) === total) return seed;
  }
  throw new Error(`Unable to find deterministic seed for dice total ${total}`);
}

function rngStateForDiceTotal(total: number): number {
  for (let state = 1; state < 100_000; state += 1) {
    if (diceTotal(state) === total) return state;
  }
  throw new Error(`Unable to find RNG state for dice total ${total}`);
}

function diceTotal(state: number): number {
  const first = randomInteger(state, 1, 6);
  return first.value + randomInteger(first.state, 1, 6).value;
}
