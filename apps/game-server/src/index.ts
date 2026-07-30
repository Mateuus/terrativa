import { resolve } from "node:path";
import { createDatabaseClient } from "@terrativa/database";
import { config as loadEnvironment } from "dotenv";
import { PrismaAuthRepository } from "./auth/prismaRepository.js";
import { AccessTokenService, ArgonPasswordHasher } from "./auth/security.js";
import { AuthService } from "./auth/service.js";
import { readRuntimeConfig } from "./config.js";
import { PrismaGameRepository } from "./games/prismaRepository.js";
import { GameService } from "./games/service.js";
import { buildHttpApp } from "./http.js";
import { RankingService } from "./ranking/service.js";
import { buildRealtimeServer } from "./realtime.js";
import { PrismaRoomRepository } from "./rooms/prismaRepository.js";
import { RoomService } from "./rooms/service.js";
import { FileWorldRepository } from "./worlds/fileRepository.js";
import { WorldService } from "./worlds/service.js";

loadEnvironment({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const config = readRuntimeConfig();
const database = createDatabaseClient();
const authService = new AuthService(
  new PrismaAuthRepository(database),
  new ArgonPasswordHasher(),
  new AccessTokenService(config.ACCESS_TOKEN_SECRET, config.ACCESS_TOKEN_TTL_SECONDS),
  {
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
    refreshTokenPepper: config.REFRESH_TOKEN_PEPPER,
  },
);
const passwordHasher = new ArgonPasswordHasher();
const roomService = new RoomService(new PrismaRoomRepository(database), passwordHasher);
const rankingService = new RankingService(database);
const worldService = new WorldService(
  new FileWorldRepository(resolve(import.meta.dirname, "../data/worlds")),
);
const gameService = new GameService(
  new PrismaGameRepository(database),
  () => new Date(),
  rankingService,
);
const app = await buildHttpApp(config, {
  authService,
  roomService,
  rankingService,
  worldService,
});
await app.ready();

const gameServer = buildRealtimeServer(
  app.server,
  (accessToken) => authService.authenticate(accessToken),
  roomService,
  config.APP_ORIGIN,
  gameService,
);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "graceful shutdown started");
  await gameServer.gracefullyShutdown(false);
  await app.close();
  await database.$disconnect();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await gameServer.listen(config.GAME_SERVER_PORT, config.GAME_SERVER_HOST);
app.log.info(
  { host: config.GAME_SERVER_HOST, port: config.GAME_SERVER_PORT },
  "game server listening",
);
