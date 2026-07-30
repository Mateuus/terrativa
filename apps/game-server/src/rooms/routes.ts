import { createRoomRequestSchema, joinRoomRequestSchema } from "@terrativa/protocol";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticateRequest } from "../auth/guard.js";
import type { AuthService } from "../auth/service.js";
import { AuthError } from "../auth/types.js";
import type { RoomService } from "./service.js";
import { RoomError } from "./types.js";

const roomCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-9]{6}$/),
});

interface RoomRoutesOptions {
  readonly authService: AuthService;
  readonly roomService: RoomService;
}

export async function registerRoomRoutes(
  app: FastifyInstance,
  { authService, roomService }: RoomRoutesOptions,
): Promise<void> {
  app.get("/api/v1/rooms", async (request, reply) => {
    try {
      await authenticateRequest(request, authService);
      return reply.send({ rooms: await roomService.listPublic() });
    } catch (error) {
      return sendError(error, request, reply);
    }
  });

  app.post(
    "/api/v1/rooms",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parse(createRoomRequestSchema, request.body, request, reply);
      if (!input) {
        return;
      }
      try {
        const principal = await authenticateRequest(request, authService);
        const profile = await authService.getProfile(principal);
        return reply
          .code(201)
          .send(
            await roomService.create(
              { userId: principal.userId, displayName: profile.displayName },
              input,
            ),
          );
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.get("/api/v1/rooms/:code", async (request, reply) => {
    const params = parse(roomCodeParamsSchema, request.params, request, reply);
    if (!params) {
      return;
    }
    try {
      const principal = await authenticateRequest(request, authService);
      return reply.send(await roomService.authorize(principal.userId, params.code));
    } catch (error) {
      return sendError(error, request, reply);
    }
  });

  app.post(
    "/api/v1/rooms/:code/join",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = parse(roomCodeParamsSchema, request.params, request, reply);
      const input = parse(joinRoomRequestSchema, request.body, request, reply);
      if (!params || !input) {
        return;
      }
      try {
        const principal = await authenticateRequest(request, authService);
        const profile = await authService.getProfile(principal);
        return reply.send(
          await roomService.join(
            { userId: principal.userId, displayName: profile.displayName },
            params.code,
            input,
          ),
        );
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.post("/api/v1/rooms/:code/leave", async (request, reply) => {
    const params = parse(roomCodeParamsSchema, request.params, request, reply);
    if (!params) {
      return;
    }
    try {
      const principal = await authenticateRequest(request, authService);
      return reply.send(await roomService.leave(params.code, principal.userId));
    } catch (error) {
      return sendError(error, request, reply);
    }
  });
}

function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): T | null {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  void reply.code(400).send({
    error: {
      code: "INVALID_PAYLOAD",
      messageKey: "request.invalidPayload",
      requestId: request.id,
      retryable: false,
    },
  });
  return null;
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const handled =
    error instanceof RoomError || error instanceof AuthError
      ? error
      : new RoomError("INTERNAL_ERROR", 500, "server.internalError", true);
  if (!(error instanceof RoomError) && !(error instanceof AuthError)) {
    request.log.error({ err: error }, "room request failed");
  }
  return reply.code(handled.statusCode).send({
    error: {
      code: handled.code,
      messageKey: handled.messageKey,
      requestId: request.id,
      retryable: handled.retryable,
    },
  });
}
