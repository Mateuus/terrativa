import type { GameEvent, GameState } from "@terrativa/game-engine";
import type { ErrorCode } from "@terrativa/protocol";

export interface GameStartResult {
  readonly gameId: string;
  readonly roomCode: string;
  readonly state: GameState;
}

export interface GamePlayerIdentity {
  readonly playerId: string;
  readonly userId: string;
}

export interface GameAcknowledgement {
  readonly commandId: string;
  readonly accepted: boolean;
  readonly stateVersion: number;
  readonly duplicate: boolean;
  readonly error?: {
    readonly code: ErrorCode;
    readonly messageKey: string;
  };
}

export interface StoredGame {
  readonly state: GameState;
  readonly players: readonly GamePlayerIdentity[];
}

export interface PersistedCommand {
  readonly gameId: string;
  readonly commandId: string;
  readonly actorPlayerId: string;
  readonly commandType: string;
  readonly expectedStateVersion: number;
  readonly acknowledgement: GameAcknowledgement;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly snapshotReason: string;
  readonly now: Date;
}

export interface GameRepository {
  createFromRoom(roomCode: string, now: Date, seed: string): Promise<GameStartResult>;
  load(gameId: string): Promise<StoredGame | null>;
  findByRoomCode(roomCode: string): Promise<string | null>;
  findAcknowledgement(gameId: string, commandId: string): Promise<GameAcknowledgement | null>;
  persistCommand(command: PersistedCommand): Promise<void>;
  markDisconnected(gameId: string, playerId: string, now: Date): Promise<void>;
  markConnected(gameId: string, playerId: string): Promise<void>;
}

export class GameServerError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly messageKey: string,
    readonly retryable = false,
  ) {
    super(messageKey);
    this.name = "GameServerError";
  }
}
