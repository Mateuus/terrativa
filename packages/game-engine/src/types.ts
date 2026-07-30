export type GameStatus = "ACTIVE" | "FINISHED";
export type GameMode = "CASUAL" | "RANKED";
export type TurnPhase =
  | "AWAITING_ROLL"
  | "AWAITING_PURCHASE"
  | "MANAGING"
  | "DEBT_RESOLUTION"
  | "FINISHED";
export type PlayerStatus = "ACTIVE" | "BANKRUPT";
export type PropertyTileType = "PROPERTY" | "TRANSPORT" | "UTILITY";
export type TileType =
  | "START"
  | PropertyTileType
  | "REGIONAL_EVENT"
  | "COMMUNITY_BENEFIT"
  | "MUNICIPAL_FEE"
  | "INSPECTION"
  | "VISITING"
  | "REST"
  | "MOVE";
export type CardDeckType = "REGIONAL_EVENT" | "COMMUNITY_BENEFIT";

export interface BoardRules {
  readonly inspectionFee: number;
  readonly maxInspectionTurns: number;
  readonly purchaseDecisionMs: number;
  readonly tradeExpiryMs: number;
  readonly maxRounds: number | null;
}

export interface TileDefinition {
  readonly id: string;
  readonly index: number;
  readonly type: TileType;
  readonly name: string;
  readonly propertyId: string | null;
  readonly deck: CardDeckType | null;
  readonly amount: number | null;
  readonly targetPosition: number | null;
  readonly collectPassStart: boolean;
}

export interface PropertyDefinition {
  readonly id: string;
  readonly groupId: string;
  readonly tileIndex: number;
  readonly price: number;
  readonly mortgageValue: number;
  readonly unmortgageCost: number;
  readonly rentByLevel: readonly number[];
  readonly upgradeCost: number;
  readonly maxLevel: number;
}

export interface PropertyGroupDefinition {
  readonly id: string;
  readonly propertyIds: readonly string[];
}

export type CardEffect =
  | { readonly type: "RECEIVE"; readonly amount: number }
  | { readonly type: "PAY"; readonly amount: number }
  | {
      readonly type: "MOVE_TO";
      readonly position: number;
      readonly collectPassStart: boolean;
    }
  | { readonly type: "MOVE_STEPS"; readonly steps: number }
  | { readonly type: "GET_OUT_OF_INSPECTION" }
  | {
      readonly type: "REPAIRS";
      readonly amountPerUpgrade: number;
    };

export interface CardDefinition {
  readonly id: string;
  readonly deck: CardDeckType;
  readonly title: string;
  readonly effect: CardEffect;
  readonly tradable: boolean;
}

export interface BoardDefinition {
  readonly id: string;
  readonly version: number;
  readonly tileCount: number;
  readonly startingBalance: number;
  readonly passStartReward: number;
  readonly inspectionPosition: number;
  readonly rules: BoardRules;
  readonly tiles: readonly TileDefinition[];
  readonly groups: readonly PropertyGroupDefinition[];
  readonly properties: readonly PropertyDefinition[];
  readonly cards: readonly CardDefinition[];
}

export interface InitialPlayer {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly pawnKey: string;
  readonly colorKey: string;
  readonly turnOrder: number;
}

export interface GamePlayerState extends InitialPlayer {
  readonly status: PlayerStatus;
  readonly position: number;
  readonly balance: number;
  readonly inspectionTurns: number;
  readonly heldCardIds: readonly string[];
  readonly eliminatedAtTurn: number | null;
}

export interface PropertyState {
  readonly propertyId: string;
  readonly ownerPlayerId: string | null;
  readonly level: number;
  readonly mortgaged: boolean;
}

export interface DeckState {
  readonly cardIds: readonly string[];
  readonly cursor: number;
}

export interface PurchaseDecision {
  readonly type: "PURCHASE_PROPERTY";
  readonly playerId: string;
  readonly propertyId: string;
  readonly expiresAt: number;
}

export interface PendingDebt {
  readonly debtorPlayerId: string;
  readonly creditorPlayerId: string | null;
  readonly amount: number;
  readonly reason: string;
}

export interface TradeAssets {
  readonly cash: number;
  readonly propertyIds: readonly string[];
  readonly cardIds: readonly string[];
}

export type TradeStatus = "OPEN" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";

export interface TradeOffer {
  readonly id: string;
  readonly fromPlayerId: string;
  readonly toPlayerId: string;
  readonly offered: TradeAssets;
  readonly requested: TradeAssets;
  readonly status: TradeStatus;
  readonly expiresAt: number;
}

export interface GameState {
  readonly gameId: string;
  readonly board: BoardDefinition;
  readonly mode: GameMode;
  readonly version: number;
  readonly status: GameStatus;
  readonly phase: TurnPhase;
  readonly round: number;
  readonly turnNumber: number;
  readonly turnDurationSeconds: number;
  readonly currentPlayerId: string | null;
  readonly turnDeadlineAt: number;
  readonly winnerPlayerId: string | null;
  readonly finishReason: string | null;
  readonly finalStandings: readonly FinalStanding[];
  readonly playerOrder: readonly string[];
  readonly players: Readonly<Record<string, GamePlayerState>>;
  readonly properties: Readonly<Record<string, PropertyState>>;
  readonly decks: Readonly<Record<CardDeckType, DeckState>>;
  readonly activeDecision: PurchaseDecision | null;
  readonly pendingDebt: PendingDebt | null;
  readonly trades: Readonly<Record<string, TradeOffer>>;
  readonly rngState: number;
  readonly processedCommandIds: readonly string[];
}

export interface CreateGameInput {
  readonly gameId: string;
  readonly board: BoardDefinition;
  readonly mode: GameMode;
  readonly players: readonly InitialPlayer[];
  readonly seed: string | number;
  readonly startedAt: number;
  readonly turnDurationSeconds: number;
}

export interface FinalStanding {
  readonly playerId: string;
  readonly placement: number;
  readonly netWorth: number;
  readonly status: PlayerStatus;
}

interface CommandBase {
  readonly commandId: string;
  readonly actorPlayerId: string;
  readonly expectedStateVersion: number;
}

export type GameCommand = CommandBase &
  (
    | { readonly type: "ROLL_DICE"; readonly payload: Record<string, never> }
    | { readonly type: "BUY_PROPERTY"; readonly payload: Record<string, never> }
    | { readonly type: "DECLINE_PROPERTY"; readonly payload: Record<string, never> }
    | { readonly type: "BUILD_UPGRADE"; readonly payload: { readonly propertyId: string } }
    | { readonly type: "SELL_UPGRADE"; readonly payload: { readonly propertyId: string } }
    | { readonly type: "MORTGAGE_PROPERTY"; readonly payload: { readonly propertyId: string } }
    | { readonly type: "UNMORTGAGE_PROPERTY"; readonly payload: { readonly propertyId: string } }
    | {
        readonly type: "CREATE_TRADE";
        readonly payload: {
          readonly tradeId: string;
          readonly toPlayerId: string;
          readonly offered: TradeAssets;
          readonly requested: TradeAssets;
        };
      }
    | { readonly type: "ACCEPT_TRADE"; readonly payload: { readonly tradeId: string } }
    | { readonly type: "REJECT_TRADE"; readonly payload: { readonly tradeId: string } }
    | { readonly type: "CANCEL_TRADE"; readonly payload: { readonly tradeId: string } }
    | { readonly type: "USE_CARD"; readonly payload: { readonly cardId: string } }
    | { readonly type: "PAY_INSPECTION_FEE"; readonly payload: Record<string, never> }
    | { readonly type: "DECLARE_BANKRUPTCY"; readonly payload: Record<string, never> }
    | { readonly type: "END_TURN"; readonly payload: Record<string, never> }
  );

export interface EngineContext {
  readonly now: number;
}

export interface GameEvent {
  readonly type: string;
  readonly actorPlayerId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface CommandResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export type GameRuleErrorCode =
  | "INVALID_CONTENT"
  | "INVALID_GAME_PHASE"
  | "STATE_VERSION_MISMATCH"
  | "DUPLICATE_COMMAND"
  | "NOT_YOUR_TURN"
  | "PLAYER_UNAVAILABLE"
  | "DECISION_EXPIRED"
  | "INSUFFICIENT_BALANCE"
  | "PROPERTY_UNAVAILABLE"
  | "INVALID_UPGRADE"
  | "INVALID_TRADE"
  | "INVALID_CARD"
  | "INVARIANT_VIOLATION";

export class GameRuleError extends Error {
  constructor(
    readonly code: GameRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GameRuleError";
  }
}
