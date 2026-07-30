import { timingSafeEqual } from "node:crypto";
import {
  loginRequestSchema,
  registerRequestSchema,
  updateProfileRequestSchema,
} from "@terrativa/protocol";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RuntimeConfig } from "../config.js";
import { authenticateRequest } from "./guard.js";
import type { AuthService } from "./service.js";
import { AuthError, type RequestFingerprint } from "./types.js";

const REFRESH_COOKIE = "terrativa_refresh";
const CSRF_COOKIE = "terrativa_csrf";

interface AuthRoutesOptions {
  readonly authService: AuthService;
  readonly config: RuntimeConfig;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  { authService, config }: AuthRoutesOptions,
): Promise<void> {
  app.post(
    "/api/v1/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parseBody(registerRequestSchema, request, reply);
      if (!input) {
        return;
      }
      try {
        const result = await authService.register(input, fingerprint(request));
        setSessionCookies(reply, result.refreshToken, result.csrfToken, config);
        return reply.code(201).send(result.response);
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parseBody(loginRequestSchema, request, reply);
      if (!input) {
        return;
      }
      try {
        const result = await authService.login(input, fingerprint(request));
        setSessionCookies(reply, result.refreshToken, result.csrfToken, config);
        return reply.send(result.response);
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/auth/refresh",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!hasValidCsrf(request)) {
        return sendAuthError(
          new AuthError("CSRF_INVALID", 403, "auth.csrfInvalid"),
          request,
          reply,
        );
      }
      const refreshToken = request.cookies[REFRESH_COOKIE];
      if (!refreshToken) {
        return sendAuthError(
          new AuthError("UNAUTHENTICATED", 401, "auth.sessionExpired"),
          request,
          reply,
        );
      }

      try {
        const result = await authService.refresh(refreshToken, fingerprint(request));
        setSessionCookies(reply, result.refreshToken, result.csrfToken, config);
        return reply.send(result.response);
      } catch (error) {
        clearSessionCookies(reply, config);
        return sendAuthError(error, request, reply);
      }
    },
  );

  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (!hasValidCsrf(request)) {
      return sendAuthError(new AuthError("CSRF_INVALID", 403, "auth.csrfInvalid"), request, reply);
    }
    try {
      const principal = await authenticateRequest(request, authService);
      await authService.logout(principal, request.cookies[REFRESH_COOKIE]);
      clearSessionCookies(reply, config);
      return reply.code(204).send();
    } catch (error) {
      return sendAuthError(error, request, reply);
    }
  });

  app.get("/api/v1/me", async (request, reply) => {
    try {
      const principal = await authenticateRequest(request, authService);
      return reply.send(await authService.getProfile(principal));
    } catch (error) {
      return sendAuthError(error, request, reply);
    }
  });

  app.patch("/api/v1/me", async (request, reply) => {
    const input = parseBody(updateProfileRequestSchema, request, reply);
    if (!input) {
      return;
    }
    try {
      const principal = await authenticateRequest(request, authService);
      return reply.send(await authService.updateProfile(principal, input));
    } catch (error) {
      return sendAuthError(error, request, reply);
    }
  });
}

function parseBody<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  request: FastifyRequest,
  reply: FastifyReply,
): T | null {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
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
  return parsed.data;
}

function fingerprint(request: FastifyRequest): RequestFingerprint {
  const userAgent = request.headers["user-agent"];
  return {
    ip: request.ip || null,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 512) : null,
  };
}

function hasValidCsrf(request: FastifyRequest): boolean {
  const cookie = request.cookies[CSRF_COOKIE];
  const header = request.headers["x-csrf-token"];
  if (!cookie || typeof header !== "string") {
    return false;
  }
  const cookieBytes = Buffer.from(cookie);
  const headerBytes = Buffer.from(header);
  return cookieBytes.length === headerBytes.length && timingSafeEqual(cookieBytes, headerBytes);
}

function setSessionCookies(
  reply: FastifyReply,
  refreshToken: string,
  csrfToken: string,
  config: RuntimeConfig,
): void {
  const secure = config.NODE_ENV === "production" || config.NODE_ENV === "staging";
  const maxAge = config.REFRESH_TOKEN_TTL_DAYS * 86_400;
  reply
    .setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge,
    })
    .setCookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge,
    });
}

function clearSessionCookies(reply: FastifyReply, config: RuntimeConfig): void {
  const secure = config.NODE_ENV === "production" || config.NODE_ENV === "staging";
  reply
    .clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth", sameSite: "strict", secure })
    .clearCookie(CSRF_COOKIE, { path: "/", sameSite: "strict", secure });
}

function sendAuthError(error: unknown, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const authError =
    error instanceof AuthError
      ? error
      : new AuthError("INTERNAL_ERROR", 500, "server.internalError", true);
  if (!(error instanceof AuthError)) {
    request.log.error({ err: error }, "authentication request failed");
  }
  return reply.code(authError.statusCode).send({
    error: {
      code: authError.code,
      messageKey: authError.messageKey,
      requestId: request.id,
      retryable: authError.retryable,
    },
  });
}
