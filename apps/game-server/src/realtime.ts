import type {
  Server as HttpServer,
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";
import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createAuthenticatedGameRoom } from "./games/GameRoom.js";
import type { GameService } from "./games/service.js";
import { createAuthenticatedLobbyRoom, type RoomAuthenticator } from "./rooms/LobbyRoom.js";
import type { LobbyCoordinator } from "./rooms/types.js";

export function buildRealtimeServer(
  httpServer: HttpServer,
  authenticate: RoomAuthenticator,
  coordinator: LobbyCoordinator,
  allowedOrigin: string,
  gameService?: GameService,
): Server {
  matchMaker.controller.DEFAULT_CORS_HEADERS["Access-Control-Allow-Headers"] =
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, X-Request-ID";
  matchMaker.controller.getCorsHeaders = (headers) => ({
    "Access-Control-Allow-Origin": headers.get("origin") === allowedOrigin ? allowedOrigin : "null",
  });

  const fastifyRequestHandler = httpServer.listeners("request")[0] as RequestListener | undefined;

  if (!fastifyRequestHandler) {
    throw new Error("Fastify must be ready before Colyseus is attached");
  }

  httpServer.removeListener("request", fastifyRequestHandler);

  const transport = new WebSocketTransport({
    server: httpServer,
    pingInterval: 10_000,
    verifyClient: ({ origin }: { origin: string }) => origin === allowedOrigin,
  });
  const gameServer = new Server({
    transport,
    gracefullyShutdown: false,
    express: (expressApp) => {
      expressApp.use((request: IncomingMessage, response: ServerResponse) => {
        fastifyRequestHandler(request, response);
      });
    },
    greet: false,
  });

  gameServer
    .define("lobby", createAuthenticatedLobbyRoom(authenticate, coordinator, gameService ?? null))
    .filterBy(["roomCode"]);
  if (gameService) {
    gameServer
      .define("game", createAuthenticatedGameRoom(authenticate, gameService))
      .filterBy(["gameId", "roomCode"]);
  }

  return gameServer;
}
