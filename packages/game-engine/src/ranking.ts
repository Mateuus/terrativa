import type { FinalStanding } from "./types.js";
import { GameRuleError } from "./types.js";

export const RANKING_CALCULATION_VERSION = 1 as const;

export interface PlayerRating {
  readonly playerId: string;
  readonly rating: number;
  readonly gamesPlayed: number;
}

export interface RatingChange {
  readonly playerId: string;
  readonly placement: number;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly performanceScore: number;
  readonly periodPoints: number;
}

export interface RankingOptions {
  readonly kFactor?: number;
  readonly minimumRating?: number;
}

export function calculateRankedRatingChanges(
  standings: readonly FinalStanding[],
  ratings: readonly PlayerRating[],
  options: RankingOptions = {},
): readonly RatingChange[] {
  if (standings.length < 2 || standings.length > 6) {
    throw new GameRuleError("INVALID_CONTENT", "Ranked results require between 2 and 6 players");
  }
  const kFactor = options.kFactor ?? 32;
  const minimumRating = options.minimumRating ?? 100;
  if (!Number.isSafeInteger(kFactor) || kFactor <= 0) {
    throw new GameRuleError("INVALID_CONTENT", "Ranking kFactor must be positive");
  }
  if (!Number.isSafeInteger(minimumRating)) {
    throw new GameRuleError("INVALID_CONTENT", "Ranking minimumRating must be an integer");
  }

  const ratingByPlayer = new Map(ratings.map((rating) => [rating.playerId, rating]));
  if (
    ratingByPlayer.size !== standings.length ||
    standings.some((standing) => !ratingByPlayer.has(standing.playerId))
  ) {
    throw new GameRuleError("INVALID_CONTENT", "Every ranked standing requires one rating");
  }
  if (new Set(standings.map((standing) => standing.playerId)).size !== standings.length) {
    throw new GameRuleError("INVALID_CONTENT", "Ranked standings contain duplicate players");
  }
  if (
    standings.some(
      (standing) =>
        !Number.isSafeInteger(standing.placement) ||
        standing.placement < 1 ||
        standing.placement > standings.length ||
        !Number.isSafeInteger(standing.netWorth) ||
        standing.netWorth < 0,
    ) ||
    ratings.some(
      (rating) =>
        !Number.isSafeInteger(rating.rating) ||
        !Number.isSafeInteger(rating.gamesPlayed) ||
        rating.gamesPlayed < 0,
    )
  ) {
    throw new GameRuleError("INVALID_CONTENT", "Ranked values must be valid safe integers");
  }

  const rawDeltas = new Map<string, number>();
  const deltas = new Map<string, number>();
  const performanceScores = new Map<string, number>();
  const netWorths = standings.map((standing) => standing.netWorth);
  const minimumNetWorth = Math.min(...netWorths);
  const maximumNetWorth = Math.max(...netWorths);
  for (const standing of standings) {
    const playerRating = ratingByPlayer.get(standing.playerId) as PlayerRating;
    let placementTotal = 0;
    let expectedTotal = 0;
    for (const opponent of standings) {
      if (opponent.playerId === standing.playerId) continue;
      const opponentRating = ratingByPlayer.get(opponent.playerId) as PlayerRating;
      placementTotal +=
        standing.placement < opponent.placement
          ? 1
          : standing.placement === opponent.placement
            ? 0.5
            : 0;
      expectedTotal += 1 / (1 + 10 ** ((opponentRating.rating - playerRating.rating) / 400));
    }
    const opponents = standings.length - 1;
    const placementScore = placementTotal / opponents;
    const wealthScore =
      maximumNetWorth === minimumNetWorth
        ? 0.5
        : (standing.netWorth - minimumNetWorth) / (maximumNetWorth - minimumNetWorth);
    const solvencyScore = standing.status === "ACTIVE" ? 1 : 0;
    const performanceScore = placementScore * 0.65 + wealthScore * 0.25 + solvencyScore * 0.1;
    performanceScores.set(standing.playerId, performanceScore);
    rawDeltas.set(standing.playerId, kFactor * (performanceScore - expectedTotal / opponents));
  }

  const meanDelta =
    [...rawDeltas.values()].reduce((total, delta) => total + delta, 0) / standings.length;
  for (const standing of standings) {
    deltas.set(standing.playerId, Math.round((rawDeltas.get(standing.playerId) ?? 0) - meanDelta));
  }

  const roundedSum = [...deltas.values()].reduce((total, delta) => total + delta, 0);
  const winner = [...standings].sort(
    (left, right) => left.placement - right.placement,
  )[0] as FinalStanding;
  deltas.set(winner.playerId, (deltas.get(winner.playerId) ?? 0) - roundedSum);
  enforceMinimumRating(deltas, ratings, minimumRating);

  return [...standings]
    .sort((left, right) => left.placement - right.placement)
    .map((standing) => {
      const before = (ratingByPlayer.get(standing.playerId) as PlayerRating).rating;
      const delta = deltas.get(standing.playerId) ?? 0;
      return {
        playerId: standing.playerId,
        placement: standing.placement,
        ratingBefore: before,
        ratingAfter: before + delta,
        delta,
        performanceScore: Math.round((performanceScores.get(standing.playerId) ?? 0) * 1_000),
        periodPoints: Math.round((performanceScores.get(standing.playerId) ?? 0) * 100),
      };
    });
}

function enforceMinimumRating(
  deltas: Map<string, number>,
  ratings: readonly PlayerRating[],
  minimumRating: number,
): void {
  let correction = 0;
  for (const rating of ratings) {
    const delta = deltas.get(rating.playerId) ?? 0;
    if (rating.rating + delta < minimumRating) {
      const boundedDelta = minimumRating - rating.rating;
      correction += boundedDelta - delta;
      deltas.set(rating.playerId, boundedDelta);
    }
  }
  if (correction === 0) return;

  const donors = [...ratings].sort(
    (left, right) => (deltas.get(right.playerId) ?? 0) - (deltas.get(left.playerId) ?? 0),
  );
  while (correction > 0) {
    const donor = donors.find(
      (rating) => rating.rating + (deltas.get(rating.playerId) ?? 0) > minimumRating,
    );
    if (!donor) {
      throw new GameRuleError("INVARIANT_VIOLATION", "Unable to keep ranked rating zero-sum");
    }
    deltas.set(donor.playerId, (deltas.get(donor.playerId) ?? 0) - 1);
    correction -= 1;
  }
}
