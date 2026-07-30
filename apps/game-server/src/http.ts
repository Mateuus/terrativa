import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { HealthResponse } from "@terrativa/protocol";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { registerAuthRoutes } from "./auth/routes.js";
import type { AuthService } from "./auth/service.js";
import type { RuntimeConfig } from "./config.js";
import { registerRankingRoutes } from "./ranking/routes.js";
import type { RankingService } from "./ranking/service.js";
import { registerRoomRoutes } from "./rooms/routes.js";
import type { RoomService } from "./rooms/service.js";
import { registerWorldRoutes } from "./worlds/routes.js";
import type { WorldService } from "./worlds/service.js";

export interface HttpDependencies {
  readonly authService?: AuthService;
  readonly roomService?: RoomService;
  readonly rankingService?: RankingService;
  readonly worldService?: WorldService;
}

export async function buildHttpApp(
  config: RuntimeConfig,
  dependencies: HttpDependencies = {},
): Promise<FastifyInstance> {
  const logger: FastifyServerOptions["logger"] =
    config.NODE_ENV === "test"
      ? false
      : config.NODE_ENV === "development"
        ? {
            level: config.LOG_LEVEL,
            transport: {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:standard" },
            },
          }
        : { level: config.LOG_LEVEL };

  const app = Fastify({
    logger,
    bodyLimit: 32 * 1024,
    requestIdHeader: "x-request-id",
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: [config.APP_ORIGIN],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-ID"],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  app.get(
    "/health",
    async (): Promise<HealthResponse> => ({
      status: "ok",
      service: "game-server",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/ready", async () => ({
    status: "ready",
    checks: {
      process: "ok",
      database: dependencies.authService ? "configured" : "not-required-in-foundation",
      redis: "optional",
    },
  }));

  if (dependencies.authService) {
    await registerAuthRoutes(app, { authService: dependencies.authService, config });
    if (dependencies.roomService) {
      await registerRoomRoutes(app, {
        authService: dependencies.authService,
        roomService: dependencies.roomService,
      });
    }
    if (dependencies.worldService) {
      await registerWorldRoutes(app, {
        authService: dependencies.authService,
        worldService: dependencies.worldService,
      });
    }
  }
  if (dependencies.rankingService) {
    await registerRankingRoutes(app, dependencies.rankingService);
  }

  return app;
}
