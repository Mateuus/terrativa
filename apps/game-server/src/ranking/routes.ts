import { rankingPeriodSchema } from "@terrativa/protocol";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RankingService } from "./service.js";
import { RankingError } from "./service.js";

const rankingQuerySchema = z
  .object({
    period: rankingPeriodSchema.default("SEASON"),
  })
  .strict();

export async function registerRankingRoutes(
  app: FastifyInstance,
  rankingService: RankingService,
): Promise<void> {
  app.get("/api/v1/rankings", async (request, reply) => {
    const parsed = rankingQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_PAYLOAD",
          messageKey: "request.invalidPayload",
          requestId: request.id,
          retryable: false,
        },
      });
    }
    try {
      return reply.send(await rankingService.getLeaderboard(parsed.data.period));
    } catch (error) {
      const handled =
        error instanceof RankingError ? error : new RankingError(500, "server.internalError");
      if (!(error instanceof RankingError)) {
        request.log.error({ err: error }, "ranking request failed");
      }
      return reply.code(handled.statusCode).send({
        error: {
          code: handled.statusCode === 404 ? "RANKING_UNAVAILABLE" : "INTERNAL_ERROR",
          messageKey: handled.messageKey,
          requestId: request.id,
          retryable: false,
        },
      });
    }
  });
}
