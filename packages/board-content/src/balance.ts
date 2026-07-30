import {
  type BoardDefinition,
  createGame,
  executeCommand,
  type GameCommand,
  type GameEvent,
  type GameState,
  type InitialPlayer,
} from "@terrativa/game-engine";

export interface BalanceSimulationOptions {
  readonly games?: number;
  readonly playerCount?: number;
  readonly seed?: string;
  readonly maximumCommandsPerGame?: number;
}

export interface BalanceSimulationReport {
  readonly games: number;
  readonly completedGames: number;
  readonly completionRate: number;
  readonly averageRounds: number;
  readonly averageBankruptcies: number;
  readonly averagePurchases: number;
  readonly averageUpgrades: number;
  readonly winnerDistribution: Readonly<Record<number, number>>;
  readonly maximumWinnerShare: number;
  readonly impossibleStates: readonly string[];
}

export function simulateBoardBalance(
  board: BoardDefinition,
  options: BalanceSimulationOptions = {},
): BalanceSimulationReport {
  const games = options.games ?? 100;
  const playerCount = options.playerCount ?? 4;
  const seed = options.seed ?? "terrativa-balance-v1";
  const commandLimit = options.maximumCommandsPerGame ?? 20_000;
  assertSimulationOptions(games, playerCount, commandLimit);

  let completedGames = 0;
  let totalRounds = 0;
  let totalBankruptcies = 0;
  let totalPurchases = 0;
  let totalUpgrades = 0;
  const winnerDistribution: Record<number, number> = {};
  const impossibleStates: string[] = [];

  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    try {
      const result = simulateGame(
        board,
        createPlayers(playerCount),
        `${seed}:${gameIndex}`,
        commandLimit,
      );
      completedGames += 1;
      totalRounds += result.state.round;
      totalBankruptcies += result.bankruptcies;
      totalPurchases += result.purchases;
      totalUpgrades += result.upgrades;
      const winnerTurnOrder = result.state.playerOrder.indexOf(
        result.state.winnerPlayerId as string,
      );
      winnerDistribution[winnerTurnOrder] = (winnerDistribution[winnerTurnOrder] ?? 0) + 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      impossibleStates.push(`simulação ${gameIndex}: ${message}`);
    }
  }

  const maximumWins = Math.max(0, ...Object.values(winnerDistribution));
  return Object.freeze({
    games,
    completedGames,
    completionRate: completedGames / games,
    averageRounds: completedGames === 0 ? 0 : totalRounds / completedGames,
    averageBankruptcies: completedGames === 0 ? 0 : totalBankruptcies / completedGames,
    averagePurchases: completedGames === 0 ? 0 : totalPurchases / completedGames,
    averageUpgrades: completedGames === 0 ? 0 : totalUpgrades / completedGames,
    winnerDistribution: Object.freeze({ ...winnerDistribution }),
    maximumWinnerShare: completedGames === 0 ? 0 : maximumWins / completedGames,
    impossibleStates: Object.freeze(impossibleStates),
  });
}

interface SimulatedGame {
  readonly state: GameState;
  readonly bankruptcies: number;
  readonly purchases: number;
  readonly upgrades: number;
}

function simulateGame(
  board: BoardDefinition,
  players: readonly InitialPlayer[],
  seed: string,
  commandLimit: number,
): SimulatedGame {
  let state = createGame({
    gameId: `balance-${seed}`,
    board,
    mode: "CASUAL",
    players,
    seed,
    startedAt: 1_000,
    turnDurationSeconds: 60,
  });
  let now = 1_000;
  let sequence = 0;
  let managedTurn = -1;
  let bankruptcies = 0;
  let purchases = 0;
  let upgrades = 0;

  while (state.status === "ACTIVE" && sequence < commandLimit) {
    now += 100;
    const actorPlayerId = state.currentPlayerId;
    if (!actorPlayerId) {
      throw new Error("partida ativa sem jogador atual");
    }
    let command: GameCommand;
    switch (state.phase) {
      case "AWAITING_ROLL":
        command = createCommand(state, actorPlayerId, sequence, "ROLL_DICE", {});
        break;
      case "AWAITING_PURCHASE": {
        const decision = state.activeDecision;
        if (!decision) {
          throw new Error("decisão de compra ausente");
        }
        const property = board.properties.find((candidate) => candidate.id === decision.propertyId);
        if (!property) {
          throw new Error("propriedade da decisão não existe");
        }
        const canPurchase = (state.players[actorPlayerId]?.balance ?? 0) - property.price >= 250;
        command = createCommand(
          state,
          actorPlayerId,
          sequence,
          canPurchase ? "BUY_PROPERTY" : "DECLINE_PROPERTY",
          {},
        );
        break;
      }
      case "DEBT_RESOLUTION":
        command = debtCommand(state, actorPlayerId, sequence);
        break;
      case "MANAGING": {
        const buildable =
          managedTurn === state.turnNumber ? null : findBuildableProperty(state, actorPlayerId);
        if (buildable) {
          managedTurn = state.turnNumber;
          command = createCommand(state, actorPlayerId, sequence, "BUILD_UPGRADE", {
            propertyId: buildable,
          });
        } else {
          command = createCommand(state, actorPlayerId, sequence, "END_TURN", {});
        }
        break;
      }
      case "FINISHED":
        throw new Error("fase final em partida marcada como ativa");
    }

    const result = executeCommand(state, command, { now });
    state = result.state;
    bankruptcies += countEvents(result.events, "PLAYER_BANKRUPT");
    purchases += countEvents(result.events, "PROPERTY_PURCHASED");
    upgrades += countEvents(result.events, "UPGRADE_BUILT");
    sequence += 1;
  }

  if (state.status !== "FINISHED") {
    throw new Error(`limite de ${commandLimit} comandos excedido`);
  }
  return { state, bankruptcies, purchases, upgrades };
}

function debtCommand(state: GameState, playerId: string, sequence: number): GameCommand {
  const owned = state.board.properties
    .filter((definition) => state.properties[definition.id]?.ownerPlayerId === playerId)
    .sort((left, right) => right.mortgageValue - left.mortgageValue);
  const improved = owned
    .filter((definition) => (state.properties[definition.id]?.level ?? 0) > 0)
    .sort(
      (left, right) =>
        (state.properties[right.id]?.level ?? 0) - (state.properties[left.id]?.level ?? 0),
    )[0];
  if (improved) {
    return createCommand(state, playerId, sequence, "SELL_UPGRADE", {
      propertyId: improved.id,
    });
  }
  const mortgageable = owned.find((definition) => !state.properties[definition.id]?.mortgaged);
  if (mortgageable) {
    return createCommand(state, playerId, sequence, "MORTGAGE_PROPERTY", {
      propertyId: mortgageable.id,
    });
  }
  return createCommand(state, playerId, sequence, "DECLARE_BANKRUPTCY", {});
}

function findBuildableProperty(state: GameState, playerId: string): string | null {
  const player = state.players[playerId];
  if (!player || player.balance < 600) {
    return null;
  }
  for (const group of state.board.groups) {
    const definitions = group.propertyIds.map((propertyId) =>
      state.board.properties.find((property) => property.id === propertyId),
    );
    if (
      definitions.some(
        (definition) =>
          !definition ||
          state.properties[definition.id]?.ownerPlayerId !== playerId ||
          state.properties[definition.id]?.mortgaged,
      )
    ) {
      continue;
    }
    const complete = definitions.filter(
      (definition): definition is NonNullable<typeof definition> => Boolean(definition),
    );
    const minimumLevel = Math.min(
      ...complete.map((definition) => state.properties[definition.id]?.level ?? 0),
    );
    const candidate = complete.find((definition) => {
      const current = state.properties[definition.id];
      return (
        current?.level === minimumLevel &&
        current.level < definition.maxLevel &&
        player.balance - definition.upgradeCost >= 350
      );
    });
    if (candidate) {
      return candidate.id;
    }
  }
  return null;
}

function createPlayers(playerCount: number): readonly InitialPlayer[] {
  return Array.from({ length: playerCount }, (_, index) => ({
    id: `balance-player-${index}`,
    userId: `balance-user-${index}`,
    displayName: `Jogador ${index + 1}`,
    pawnKey: `pawn-${index}`,
    colorKey: `color-${index}`,
    turnOrder: index,
  }));
}

function createCommand(
  state: GameState,
  actorPlayerId: string,
  sequence: number,
  type: GameCommand["type"],
  payload: GameCommand["payload"],
): GameCommand {
  return {
    commandId: `balance-command-${sequence}`,
    actorPlayerId,
    expectedStateVersion: state.version,
    type,
    payload,
  } as GameCommand;
}

function countEvents(events: readonly GameEvent[], type: string): number {
  return events.filter((event) => event.type === type).length;
}

function assertSimulationOptions(games: number, playerCount: number, commandLimit: number): void {
  if (!Number.isInteger(games) || games < 1 || games > 10_000) {
    throw new RangeError("games deve estar entre 1 e 10.000");
  }
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) {
    throw new RangeError("playerCount deve estar entre 2 e 6");
  }
  if (!Number.isInteger(commandLimit) || commandLimit < 100) {
    throw new RangeError("maximumCommandsPerGame deve ser pelo menos 100");
  }
}
