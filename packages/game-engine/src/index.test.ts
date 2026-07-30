import { describe, expect, it } from "vitest";
import { assertNonNegativeInteger, createFoundationGameState } from "./index.js";

describe("game-engine foundation", () => {
  it("starts with a stable unversioned lobby state", () => {
    expect(createFoundationGameState()).toEqual({ version: 0, status: "LOBBY" });
  });

  it("rejects unsafe fictitious money values", () => {
    expect(() => assertNonNegativeInteger(-1, "balance")).toThrow(RangeError);
    expect(() => assertNonNegativeInteger(Number.MAX_SAFE_INTEGER + 1, "balance")).toThrow(
      RangeError,
    );
  });
});
