import { describe, expect, it } from "vitest";
import { rankingPeriodBounds } from "./service.js";

describe("ranking period boundaries", () => {
  const now = new Date("2026-07-26T19:30:00.000Z");
  const seasonStart = new Date("2026-07-01T00:00:00.000Z");
  const seasonEnd = new Date("2026-12-31T23:59:59.999Z");

  it("uses UTC calendar boundaries for daily, weekly and monthly boards", () => {
    expect(rankingPeriodBounds("DAY", now, seasonStart, seasonEnd).from.toISOString()).toBe(
      "2026-07-26T00:00:00.000Z",
    );
    expect(rankingPeriodBounds("WEEK", now, seasonStart, seasonEnd).from.toISOString()).toBe(
      "2026-07-20T00:00:00.000Z",
    );
    expect(rankingPeriodBounds("MONTH", now, seasonStart, seasonEnd).from.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("never queries before the season start", () => {
    const recentStart = new Date("2026-07-25T00:00:00.000Z");
    expect(rankingPeriodBounds("MONTH", now, recentStart, seasonEnd).from).toEqual(recentStart);
  });
});
