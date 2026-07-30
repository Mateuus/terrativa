// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveGameSession,
  readActiveGameSession,
  writeActiveGameSession,
} from "./activeGame";

describe("active game session", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists a reconnectable game", () => {
    const session = {
      gameId: "247e8deb-ea3e-430d-b660-a3224859e015",
      roomCode: "WZKVN8",
      presentationMode: "BOARD" as const,
    };
    writeActiveGameSession(session);
    expect(readActiveGameSession()).toEqual(session);
  });

  it("removes invalid data", () => {
    window.localStorage.setItem("terrativa.activeGame.v1", '{"gameId":1}');
    expect(readActiveGameSession()).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("can be cleared after leaving", () => {
    writeActiveGameSession({
      gameId: "247e8deb-ea3e-430d-b660-a3224859e015",
      roomCode: "WZKVN8",
    });
    clearActiveGameSession();
    expect(readActiveGameSession()).toBeNull();
  });
});
