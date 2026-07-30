import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../auth/guard.js";
import type { AuthService } from "../auth/service.js";
import { AuthError } from "../auth/types.js";
import type { WorldService } from "./service.js";

interface WorldRoutesOptions {
  readonly authService: AuthService;
  readonly worldService: WorldService;
}

export async function registerWorldRoutes(
  app: FastifyInstance,
  { authService, worldService }: WorldRoutesOptions,
): Promise<void> {
  app.post(
    "/api/v1/admin/worlds/publish",
    { bodyLimit: 5_000_000, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const principal = await authenticateRequest(request, authService);
        if (principal.role !== "ADMIN") {
          throw new AuthError("FORBIDDEN", 403, "world.publishForbidden");
        }
        const worldPackage = await worldService.publish(request.body);
        return reply.code(201).send({
          worldId: worldPackage.world.id,
          slug: worldPackage.serverManifest.boardSlug,
          generatedAt: worldPackage.generatedAt,
          status: "published",
        });
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({
            error: {
              code: error.code,
              messageKey: error.messageKey,
              requestId: request.id,
              retryable: error.retryable,
            },
          });
        }
        request.log.warn({ err: error }, "world package rejected");
        return reply.code(400).send({
          error: {
            code: "INVALID_PAYLOAD",
            messageKey: "world.packageInvalid",
            requestId: request.id,
            retryable: false,
          },
        });
      }
    },
  );

  app.get("/api/v1/worlds/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const worldPackage = await worldService.findPublished(slug);
    if (!worldPackage) {
      return reply.code(404).send({
        error: {
          code: "BOARD_NOT_FOUND",
          messageKey: "world.notFound",
          requestId: request.id,
          retryable: false,
        },
      });
    }
    const publicWorld = {
      ...worldPackage.world,
      scripts: undefined,
    };
    return reply.send({
      schemaVersion: worldPackage.schemaVersion,
      generatedAt: worldPackage.generatedAt,
      world: publicWorld,
      serverManifest: worldPackage.serverManifest,
    });
  });
}
