import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/client/client.js";

export interface DatabaseRuntimeConfig {
  readonly url: string;
}

export interface DatabaseEnvironment {
  readonly DATABASE_URL?: string;
  readonly DB_HOST?: string;
  readonly DB_PORT?: string;
  readonly DB_USER?: string;
  readonly DB_PASS?: string;
  readonly DB_NAME?: string;
}

export function resolveDatabaseUrl(environment: DatabaseEnvironment = process.env): string {
  const hasDiscreteConfiguration = [
    environment.DB_HOST,
    environment.DB_USER,
    environment.DB_PASS,
    environment.DB_NAME,
  ].some((value) => value !== undefined);

  if (hasDiscreteConfiguration) {
    const required = {
      DB_HOST: environment.DB_HOST,
      DB_USER: environment.DB_USER,
      DB_PASS: environment.DB_PASS,
      DB_NAME: environment.DB_NAME,
    };
    const missing = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Missing database variables: ${missing.join(", ")}`);
    }

    const port = environment.DB_PORT ?? "3306";
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65_535) {
      throw new Error("DB_PORT must be a valid TCP port");
    }

    const host = required.DB_HOST as string;
    const user = encodeURIComponent(required.DB_USER as string);
    const password = encodeURIComponent(required.DB_PASS as string);
    const database = encodeURIComponent(required.DB_NAME as string);

    return `mysql://${user}:${password}@${host}:${port}/${database}`;
  }

  if (!environment.DATABASE_URL) {
    throw new Error("Set DB_HOST, DB_USER, DB_PASS and DB_NAME, or provide DATABASE_URL");
  }

  return environment.DATABASE_URL;
}

export function readDatabaseRuntimeConfig(
  environment: DatabaseEnvironment = process.env,
): DatabaseRuntimeConfig {
  return Object.freeze({ url: resolveDatabaseUrl(environment) });
}

export function createDatabaseClient(
  environment: DatabaseEnvironment & { readonly DB_POOL_SIZE?: string } = process.env,
): PrismaClient {
  const url = new URL(resolveDatabaseUrl(environment));
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql protocol");
  }

  const connectionLimit = Number(environment.DB_POOL_SIZE ?? "5");
  if (!Number.isInteger(connectionLimit) || connectionLimit < 1 || connectionLimit > 50) {
    throw new Error("DB_POOL_SIZE must be an integer between 1 and 50");
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit,
  });

  return new PrismaClient({ adapter });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
