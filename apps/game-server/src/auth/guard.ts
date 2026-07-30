import type { FastifyRequest } from "fastify";
import type { AuthService } from "./service.js";
import type { AccessPrincipal } from "./types.js";
import { AuthError } from "./types.js";

export async function authenticateRequest(
  request: FastifyRequest,
  authService: AuthService,
): Promise<AccessPrincipal> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthError("UNAUTHENTICATED", 401, "auth.accessTokenMissing");
  }
  return authService.authenticate(authorization.slice(7));
}
