const activeGameStorageKey = "terrativa.activeGame.v1";

export interface ActiveGameSession {
  readonly gameId: string;
  readonly roomCode: string;
  readonly presentationMode?: "BOARD" | "CITY_3D";
}

export function readActiveGameSession(): ActiveGameSession | null {
  try {
    const stored = window.localStorage.getItem(activeGameStorageKey);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<ActiveGameSession>;
    if (
      typeof value.gameId !== "string" ||
      value.gameId.length < 8 ||
      typeof value.roomCode !== "string" ||
      !/^[A-Z0-9]{6}$/.test(value.roomCode)
    ) {
      clearActiveGameSession();
      return null;
    }
    return {
      gameId: value.gameId,
      roomCode: value.roomCode,
      presentationMode: value.presentationMode === "CITY_3D" ? "CITY_3D" : "BOARD",
    };
  } catch {
    clearActiveGameSession();
    return null;
  }
}

export function writeActiveGameSession(session: ActiveGameSession): void {
  window.localStorage.setItem(activeGameStorageKey, JSON.stringify(session));
}

export function clearActiveGameSession(): void {
  window.localStorage.removeItem(activeGameStorageKey);
}
