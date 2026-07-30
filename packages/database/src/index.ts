import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { type DatabaseEnvironment, resolveDatabaseUrl } from "./databaseUrl.js";
import { PrismaClient } from "./generated/client/client.js";

export { type DatabaseEnvironment, resolveDatabaseUrl } from "./databaseUrl.js";

export interface DatabaseRuntimeConfig {
  readonly url: string;
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
