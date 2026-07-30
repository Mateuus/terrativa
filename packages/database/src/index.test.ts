import { describe, expect, it } from "vitest";
import { readDatabaseRuntimeConfig } from "./index.js";

describe("database runtime configuration", () => {
  it("requires an explicit connection configuration", () => {
    expect(() => readDatabaseRuntimeConfig({})).toThrow("Set DB_HOST");
  });

  it("accepts a prebuilt URL for CI and production", () => {
    const config = readDatabaseRuntimeConfig({
      DATABASE_URL: "mysql://user:secret@localhost:3306/database",
    });
    expect(config.url).toBe("mysql://user:secret@localhost:3306/database");
  });

  it("prefers and safely encodes the local discrete variables", () => {
    const config = readDatabaseRuntimeConfig({
      DATABASE_URL: "mysql://ignored:ignored@docker:3306/ignored",
      DB_HOST: "192.0.2.10",
      DB_PORT: "3306",
      DB_USER: "game user",
      DB_PASS: "pass@word",
      DB_NAME: "game_development",
    });

    expect(config.url).toBe("mysql://game%20user:pass%40word@192.0.2.10:3306/game_development");
  });
});
