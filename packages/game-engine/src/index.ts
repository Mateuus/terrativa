export {
  calculateNetWorth,
  createGame,
  executeCommand,
  initialGameEvents,
  processTimeouts,
} from "./engine.js";
export type { PlayerRating, RankingOptions, RatingChange } from "./ranking.js";
export {
  calculateRankedRatingChanges,
  RANKING_CALCULATION_VERSION,
} from "./ranking.js";
export {
  nextUint32,
  randomInteger,
  seedToUint32,
  shuffleDeterministically,
} from "./rng.js";
export type * from "./types.js";
export { GameRuleError } from "./types.js";
export {
  assertNonNegativeInteger,
  validateBoardDefinition,
  validateGameState,
  validateTradeAssets,
} from "./validation.js";

export type FoundationGameStatus = "LOBBY" | "ACTIVE" | "FINISHED";

export interface FoundationGameState {
  readonly version: number;
  readonly status: FoundationGameStatus;
}

export function createFoundationGameState(): FoundationGameState {
  return Object.freeze({
    version: 0,
    status: "LOBBY",
  });
}
