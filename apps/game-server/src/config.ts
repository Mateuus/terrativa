import { z } from "zod";

const runtimeConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  GAME_SERVER_HOST: z.string().min(1).default("0.0.0.0"),
  GAME_SERVER_PORT: z.coerce.number().int().min(1).max(65_535).default(2567),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ACCESS_TOKEN_SECRET: z.string().min(32).default("terrativa-development-access-secret"),
  REFRESH_TOKEN_PEPPER: z.string().min(32).default("terrativa-development-refresh-pepper"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(900).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const config = runtimeConfigSchema.parse(environment);
  if (
    ["staging", "production"].includes(config.NODE_ENV) &&
    (config.ACCESS_TOKEN_SECRET.startsWith("terrativa-development-") ||
      config.REFRESH_TOKEN_PEPPER.startsWith("terrativa-development-"))
  ) {
    throw new Error("Production authentication secrets must be explicitly configured");
  }
  return config;
}
