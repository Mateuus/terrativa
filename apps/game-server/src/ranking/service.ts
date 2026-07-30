import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@terrativa/database";
import {
  calculateRankedRatingChanges,
  type FinalStanding,
  RANKING_CALCULATION_VERSION,
  type RatingChange,
} from "@terrativa/game-engine";
import type { RankingEntry, RankingPeriod, RankingResponse } from "@terrativa/protocol";

export class RankingService {
  constructor(private readonly database: DatabaseClient) {}

  async getLeaderboard(period: RankingPeriod, now = new Date()): Promise<RankingResponse> {
    const season = await this.database.rankedSeason.findFirst({
      where: {
        status: "ACTIVE",
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: "desc" },
    });
    if (!season) {
      throw new RankingError(404, "ranking.seasonUnavailable");
    }
    const bounds = rankingPeriodBounds(period, now, season.startsAt, season.endsAt);
    const aggregates = await this.database.rankedRatingEntry.groupBy({
      by: ["userId"],
      where: {
        seasonId: season.id,
        createdAt: { gte: bounds.from, lt: bounds.to },
      },
      _sum: { periodPoints: true, ratingDelta: true },
      _count: { id: true },
      _avg: { placement: true },
      orderBy: { _sum: { periodPoints: "desc" } },
      take: 100,
    });
    const userIds = aggregates.map((aggregate) => aggregate.userId);
    const [ratings, users, ledger] = await Promise.all([
      this.database.playerRating.findMany({
        where: { seasonId: season.id, userId: { in: userIds } },
      }),
      this.database.user.findMany({
        where: { id: { in: userIds } },
        include: { profile: true },
      }),
      this.database.rankedRatingEntry.findMany({
        where: {
          seasonId: season.id,
          userId: { in: userIds },
          createdAt: { gte: bounds.from, lt: bounds.to },
        },
        select: { userId: true, placement: true, bankrupt: true },
      }),
    ]);
    const ratingByUser = new Map(ratings.map((rating) => [rating.userId, rating.rating]));
    const userById = new Map(users.map((user) => [user.id, user]));
    const entries = aggregates
      .map((aggregate) => {
        const matches = ledger.filter((item) => item.userId === aggregate.userId);
        const user = userById.get(aggregate.userId);
        return {
          position: 0,
          userId: aggregate.userId,
          displayName: user?.profile?.displayName ?? user?.username ?? "Jogador",
          rating: ratingByUser.get(aggregate.userId) ?? 1_000,
          periodPoints: aggregate._sum.periodPoints ?? 0,
          ratingDelta: aggregate._sum.ratingDelta ?? 0,
          gamesPlayed: aggregate._count.id,
          wins: matches.filter((match) => match.placement === 1).length,
          bankruptcies: matches.filter((match) => match.bankrupt).length,
          averagePlacement: roundToTwo(aggregate._avg.placement ?? 0),
        } satisfies RankingEntry;
      })
      .sort((left, right) =>
        period === "SEASON"
          ? right.rating - left.rating ||
            right.periodPoints - left.periodPoints ||
            left.averagePlacement - right.averagePlacement
          : right.periodPoints - left.periodPoints ||
            right.ratingDelta - left.ratingDelta ||
            right.wins - left.wins,
      )
      .map((entry, index) => ({ ...entry, position: index + 1 }));

    return {
      season: {
        id: season.id,
        name: season.name,
        endsAt: season.endsAt.toISOString(),
      },
      period,
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
      entries,
    };
  }

  async finalizeRankedGame(
    gameId: string,
    standings: readonly FinalStanding[],
    now = new Date(),
  ): Promise<readonly RatingChange[]> {
    return this.database.$transaction(async (transaction) => {
      const existing = await transaction.rankedMatchResult.findUnique({
        where: { gameId },
        include: { entries: true },
      });
      if (existing) {
        return existing.entries
          .sort((left, right) => left.placement - right.placement)
          .map((entry) => ({
            playerId: entry.playerId,
            placement: entry.placement,
            ratingBefore: entry.ratingBefore,
            ratingAfter: entry.ratingAfter,
            delta: entry.ratingDelta,
            performanceScore: entry.performanceScore,
            periodPoints: entry.periodPoints,
          }));
      }

      const game = await transaction.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });
      if (game?.mode !== "RANKED" || game.status !== "FINISHED") {
        throw new RankingError(409, "ranking.gameNotEligible");
      }
      const season = await transaction.rankedSeason.findFirst({
        where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
        orderBy: { startsAt: "desc" },
      });
      if (!season) {
        throw new RankingError(409, "ranking.seasonUnavailable");
      }
      const playerById = new Map(game.players.map((player) => [player.id, player]));
      if (
        standings.length !== game.players.length ||
        standings.some((standing) => !playerById.has(standing.playerId))
      ) {
        throw new RankingError(400, "ranking.invalidStandings");
      }

      const ratings = [];
      for (const standing of standings) {
        const player = playerById.get(standing.playerId);
        if (!player) throw new RankingError(400, "ranking.invalidStandings");
        ratings.push(
          await transaction.playerRating.upsert({
            where: { seasonId_userId: { seasonId: season.id, userId: player.userId } },
            create: {
              id: randomUUID(),
              seasonId: season.id,
              userId: player.userId,
            },
            update: {},
          }),
        );
      }
      const changes = calculateRankedRatingChanges(
        standings,
        ratings.map((rating, index) => ({
          playerId: (standings[index] as FinalStanding).playerId,
          rating: rating.rating,
          gamesPlayed: rating.gamesPlayed,
        })),
      );
      const matchResultId = randomUUID();
      await transaction.rankedMatchResult.create({
        data: {
          id: matchResultId,
          gameId,
          seasonId: season.id,
          calculationVersion: RANKING_CALCULATION_VERSION,
          ratingsBeforeJson: changes.map((change) => ({
            playerId: change.playerId,
            rating: change.ratingBefore,
          })),
          ratingsAfterJson: changes.map((change) => ({
            playerId: change.playerId,
            rating: change.ratingAfter,
            delta: change.delta,
          })),
          createdAt: now,
        },
      });

      for (const change of changes) {
        const standing = standings.find(
          (candidate) => candidate.playerId === change.playerId,
        ) as FinalStanding;
        const player = playerById.get(change.playerId);
        if (!player) throw new RankingError(400, "ranking.invalidStandings");
        const currentRating = ratings.find((rating) => rating.userId === player.userId);
        await transaction.playerRating.update({
          where: { seasonId_userId: { seasonId: season.id, userId: player.userId } },
          data: {
            rating: change.ratingAfter,
            gamesPlayed: { increment: 1 },
            wins: { increment: standing.placement === 1 ? 1 : 0 },
            topThreeFinishes: { increment: standing.placement <= 3 ? 1 : 0 },
            provisionalGames: {
              increment: (currentRating?.provisionalGames ?? 0) < 10 ? 1 : 0,
            },
          },
        });
        await transaction.rankedRatingEntry.create({
          data: {
            id: randomUUID(),
            rankedMatchResultId: matchResultId,
            seasonId: season.id,
            userId: player.userId,
            playerId: change.playerId,
            ratingBefore: change.ratingBefore,
            ratingAfter: change.ratingAfter,
            ratingDelta: change.delta,
            placement: standing.placement,
            netWorth: standing.netWorth,
            bankrupt: standing.status === "BANKRUPT",
            performanceScore: change.performanceScore,
            periodPoints: change.periodPoints,
            createdAt: now,
          },
        });
      }
      return changes;
    });
  }
}

export class RankingError extends Error {
  constructor(
    readonly statusCode: number,
    readonly messageKey: string,
  ) {
    super(messageKey);
    this.name = "RankingError";
  }
}

export function rankingPeriodBounds(
  period: RankingPeriod,
  now: Date,
  seasonStartsAt: Date,
  seasonEndsAt: Date,
): { readonly from: Date; readonly to: Date } {
  const to = new Date(Math.min(now.getTime() + 1, seasonEndsAt.getTime()));
  let from: Date;
  switch (period) {
    case "DAY":
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      break;
    case "WEEK": {
      const day = now.getUTCDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
      );
      break;
    }
    case "MONTH":
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
    case "SEASON":
      from = seasonStartsAt;
      break;
  }
  if (from < seasonStartsAt) from = seasonStartsAt;
  return { from, to };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
