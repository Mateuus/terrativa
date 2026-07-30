import { type GameState, validateGameState } from "@terrativa/game-engine";
import { cloneGameState, stateChecksum } from "./serialization.js";
import type {
  GameAcknowledgement,
  GamePlayerIdentity,
  GameRepository,
  GameStartResult,
  PersistedCommand,
  StoredGame,
} from "./types.js";

interface MemoryGame {
  state: GameState;
  checksum: string;
  readonly roomCode: string;
  readonly players: readonly GamePlayerIdentity[];
  readonly acknowledgements: Map<string, GameAcknowledgement>;
  readonly disconnected: Set<string>;
}

export class MemoryGameRepository implements GameRepository {
  readonly #games = new Map<string, MemoryGame>();

  seed(roomCode: string, state: GameState, players: readonly GamePlayerIdentity[]): void {
    const copy = cloneGameState(state);
    this.#games.set(state.gameId, {
      state: copy,
      checksum: stateChecksum(copy),
      roomCode,
      players,
      acknowledgements: new Map(),
      disconnected: new Set(),
    });
  }

  async createFromRoom(roomCode: string): Promise<GameStartResult> {
    const found = [...this.#games.values()].find((game) => game.roomCode === roomCode);
    if (!found) throw new Error(`No prepared memory game for room ${roomCode}`);
    return { gameId: found.state.gameId, roomCode, state: cloneGameState(found.state) };
  }

  async load(gameId: string): Promise<StoredGame | null> {
    const game = this.#games.get(gameId);
    if (!game) return null;
    if (stateChecksum(game.state) !== game.checksum) {
      throw new Error(`Snapshot checksum mismatch for game ${gameId}`);
    }
    validateGameState(game.state);
    return { state: cloneGameState(game.state), players: game.players };
  }

  async findByRoomCode(roomCode: string): Promise<string | null> {
    return [...this.#games.entries()].find(([, game]) => game.roomCode === roomCode)?.[0] ?? null;
  }

  async findAcknowledgement(
    gameId: string,
    commandId: string,
  ): Promise<GameAcknowledgement | null> {
    return this.#games.get(gameId)?.acknowledgements.get(commandId) ?? null;
  }

  async persistCommand(command: PersistedCommand): Promise<void> {
    const game = this.#required(command.gameId);
    if (game.acknowledgements.has(command.commandId)) return;
    if (command.acknowledgement.accepted && game.state.version !== command.expectedStateVersion) {
      throw new Error("Concurrent game state update");
    }
    game.acknowledgements.set(command.commandId, command.acknowledgement);
    if (command.acknowledgement.accepted) {
      game.state = cloneGameState(command.state);
      game.checksum = stateChecksum(game.state);
    }
  }

  async markDisconnected(_gameId: string, playerId: string): Promise<void> {
    this.#required(_gameId).disconnected.add(playerId);
  }

  async markConnected(gameId: string, playerId: string): Promise<void> {
    this.#required(gameId).disconnected.delete(playerId);
  }

  isDisconnected(gameId: string, playerId: string): boolean {
    return this.#required(gameId).disconnected.has(playerId);
  }

  corruptSnapshot(gameId: string): void {
    this.#required(gameId).checksum = "0".repeat(64);
  }

  #required(gameId: string): MemoryGame {
    const game = this.#games.get(gameId);
    if (!game) throw new Error(`Unknown memory game ${gameId}`);
    return game;
  }
}
