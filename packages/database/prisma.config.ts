import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/index.js";

loadEnvironment({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const { SHADOW_DATABASE_URL: shadowDatabaseUrl } = process.env;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(process.env),
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
