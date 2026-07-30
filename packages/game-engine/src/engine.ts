import { randomInteger, seedToUint32, shuffleDeterministically } from "./rng.js";
import type {
  BoardDefinition,
  CardDeckType,
  CardDefinition,
  CommandResult,
  CreateGameInput,
  DeckState,
  EngineContext,
  GameCommand,
  GameEvent,
  GamePlayerState,
  GameState,
  InitialPlayer,
  PropertyDefinition,
  PropertyState,
  TradeAssets,
  TradeOffer,
} from "./types.js";
import { GameRuleError } from "./types.js";
import {
  assertNonNegativeInteger,
  validateBoardDefinition,
  validateGameState,
  validateTradeAssets,
} from "./validation.js";

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;
type MutableGameState = DeepMutable<GameState>;
type MutablePlayer = DeepMutable<GamePlayerState>;
type MutableProperty = DeepMutable<PropertyState>;
type MutableTrade = DeepMutable<TradeOffer>;

const EMPTY_PAYLOAD: Record<string, never> = {};
const MAX_PROCESSED_COMMANDS = 256;

export function createGame(input: CreateGameInput): GameState {
  validateBoardDefinition(input.board);
  validateInitialPlayers(input.players);
  if (
    !Number.isSafeInteger(input.turnDurationSeconds) ||
    input.turnDurationSeconds < 30 ||
    input.turnDurationSeconds > 180
  ) {
    throw new GameRuleError("INVALID_CONTENT", "turnDurationSeconds must be between 30 and 180");
  }
  assertNonNegativeInteger(input.startedAt, "startedAt");

  const sortedPlayers = [...input.players].sort((left, right) => left.turnOrder - right.turnOrder);
  let rngState = seedToUint32(input.seed);
  const decks = {} as Record<CardDeckType, DeckState>;
  for (const deck of ["REGIONAL_EVENT", "COMMUNITY_BENEFIT"] as const) {
    const shuffled = shuffleDeterministically(
      input.board.cards.filter((card) => card.deck === deck).map((card) => card.id),
      rngState,
    );
    rngState = shuffled.state;
    decks[deck] = { cardIds: shuffled.values, cursor: 0 };
  }

  const players = Object.fromEntries(
    sortedPlayers.map((player) => [
      player.id,
      {
        ...player,
        status: "ACTIVE",
        position: 0,
        balance: input.board.startingBalance,
        inspectionTurns: 0,
        heldCardIds: [],
        eliminatedAtTurn: null,
      } satisfies GamePlayerState,
    ]),
  );
  const properties = Object.fromEntries(
    input.board.properties.map((property) => [
      property.id,
      {
        propertyId: property.id,
        ownerPlayerId: null,
        level: 0,
        mortgaged: false,
      } satisfies PropertyState,
    ]),
  );
  const firstPlayer = sortedPlayers[0] as InitialPlayer;
  const state: GameState = {
    gameId: input.gameId,
    board: input.board,
    mode: input.mode,
    version: 0,
    status: "ACTIVE",
    phase: "AWAITING_ROLL",
    round: 1,
    turnNumber: 1,
    turnDurationSeconds: input.turnDurationSeconds,
    currentPlayerId: firstPlayer.id,
    turnDeadlineAt: input.startedAt + input.turnDurationSeconds * 1_000,
    winnerPlayerId: null,
    finishReason: null,
    finalStandings: [],
    playerOrder: sortedPlayers.map((player) => player.id),
    players,
    properties,
    decks,
    activeDecision: null,
    pendingDebt: null,
    trades: {},
    rngState,
    processedCommandIds: [],
  };
  validateGameState(state);
  return state;
}

export function initialGameEvents(state: GameState): readonly GameEvent[] {
  return [
    event("GAME_STARTED", null, {
      gameId: state.gameId,
      boardId: state.board.id,
      boardVersion: state.board.version,
      playerOrder: state.playerOrder,
    }),
    event("TURN_STARTED", state.currentPlayerId, {
      round: state.round,
      turnNumber: state.turnNumber,
      deadlineAt: state.turnDeadlineAt,
    }),
  ];
}

export function executeCommand(
  source: GameState,
  command: GameCommand,
  context: EngineContext,
): CommandResult {
  if (source.status !== "ACTIVE") {
    fail("INVALID_GAME_PHASE", "The game has already finished");
  }
  if (command.expectedStateVersion !== source.version) {
    fail("STATE_VERSION_MISMATCH", "The command targets an outdated state version");
  }
  if (source.processedCommandIds.includes(command.commandId)) {
    fail("DUPLICATE_COMMAND", "This command has already been processed");
  }
  const sourceActor = source.players[command.actorPlayerId];
  if (sourceActor?.status !== "ACTIVE") {
    fail("PLAYER_UNAVAILABLE", "The command actor is not an active player");
  }
  assertNonNegativeInteger(context.now, "context.now");

  const state = cloneState(source);
  const events: GameEvent[] = [];
  expireTrades(state, context.now, events);

  switch (command.type) {
    case "ROLL_DICE":
      assertCurrentPlayer(state, command.actorPlayerId);
      rollDice(state, command.actorPlayerId, context, events);
      break;
    case "BUY_PROPERTY":
      assertCurrentPlayer(state, command.actorPlayerId);
      buyProperty(state, command.actorPlayerId, context, events);
      break;
    case "DECLINE_PROPERTY":
      assertCurrentPlayer(state, command.actorPlayerId);
      declineProperty(state, command.actorPlayerId, context, events);
      break;
    case "BUILD_UPGRADE":
      assertCurrentPlayer(state, command.actorPlayerId);
      buildUpgrade(state, command.actorPlayerId, command.payload.propertyId, events);
      break;
    case "SELL_UPGRADE":
      assertCurrentPlayer(state, command.actorPlayerId);
      sellUpgrade(state, command.actorPlayerId, command.payload.propertyId, events);
      settleDebtIfPossible(state, events);
      break;
    case "MORTGAGE_PROPERTY":
      assertCurrentPlayer(state, command.actorPlayerId);
      mortgageProperty(state, command.actorPlayerId, command.payload.propertyId, events);
      settleDebtIfPossible(state, events);
      break;
    case "UNMORTGAGE_PROPERTY":
      assertCurrentPlayer(state, command.actorPlayerId);
      unmortgageProperty(state, command.actorPlayerId, command.payload.propertyId, events);
      break;
    case "CREATE_TRADE":
      createTrade(state, command.actorPlayerId, command.payload, context, events);
      break;
    case "ACCEPT_TRADE":
      acceptTrade(state, command.actorPlayerId, command.payload.tradeId, context, events);
      break;
    case "REJECT_TRADE":
      rejectTrade(state, command.actorPlayerId, command.payload.tradeId, context, events);
      break;
    case "CANCEL_TRADE":
      cancelTrade(state, command.actorPlayerId, command.payload.tradeId, context, events);
      break;
    case "USE_CARD":
      assertCurrentPlayer(state, command.actorPlayerId);
      useCard(state, command.actorPlayerId, command.payload.cardId, events);
      break;
    case "PAY_INSPECTION_FEE":
      assertCurrentPlayer(state, command.actorPlayerId);
      payInspectionFee(state, command.actorPlayerId, events);
      break;
    case "DECLARE_BANKRUPTCY":
      assertCurrentPlayer(state, command.actorPlayerId);
      declareBankruptcy(state, command.actorPlayerId, context, events);
      break;
    case "END_TURN":
      assertCurrentPlayer(state, command.actorPlayerId);
      endTurn(state, command.actorPlayerId, context, events);
      break;
  }

  state.version += 1;
  state.processedCommandIds.push(command.commandId);
  if (state.processedCommandIds.length > MAX_PROCESSED_COMMANDS) {
    state.processedCommandIds.splice(0, state.processedCommandIds.length - MAX_PROCESSED_COMMANDS);
  }
  validateGameState(state);
  return { state, events };
}

export function processTimeouts(source: GameState, context: EngineContext): CommandResult {
  if (source.status !== "ACTIVE") {
    return { state: source, events: [] };
  }
  const state = cloneState(source);
  const events: GameEvent[] = [];
  expireTrades(state, context.now, events);

  if (state.activeDecision && state.activeDecision.expiresAt <= context.now) {
    events.push(
      event("DECISION_EXPIRED", state.activeDecision.playerId, {
        decisionType: state.activeDecision.type,
        propertyId: state.activeDecision.propertyId,
      }),
    );
    state.activeDecision = null;
    state.phase = "MANAGING";
  }

  if (
    state.turnDeadlineAt <= context.now &&
    state.phase !== "AWAITING_PURCHASE" &&
    state.phase !== "DEBT_RESOLUTION"
  ) {
    const playerId = requiredCurrentPlayerId(state);
    if (state.phase === "AWAITING_ROLL") {
      rollDice(state, playerId, context, events);
      events.push(event("TURN_TIMEOUT_APPLIED", playerId, { policy: "AUTO_ROLL" }));
    } else if (state.phase === "MANAGING") {
      events.push(event("TURN_TIMEOUT_APPLIED", playerId, { policy: "AUTO_END" }));
      advanceTurn(state, context, events);
    }
  }

  if (events.length === 0) {
    return { state: source, events };
  }
  state.version += 1;
  validateGameState(state);
  return { state, events };
}

export function calculateNetWorth(state: GameState, playerId: string): number {
  const player = requiredPlayer(state, playerId);
  let worth = player.balance;
  for (const definition of state.board.properties) {
    const property = state.properties[definition.id] as PropertyState;
    if (property.ownerPlayerId === playerId) {
      worth += property.mortgaged ? definition.mortgageValue : definition.price;
      worth += Math.floor((property.level * definition.upgradeCost) / 2);
    }
  }
  return worth;
}

function rollDice(
  state: MutableGameState,
  playerId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  if (state.phase !== "AWAITING_ROLL") {
    fail("INVALID_GAME_PHASE", "Dice can only be rolled at the start of a turn");
  }
  const first = randomInteger(state.rngState, 1, 6);
  const second = randomInteger(first.state, 1, 6);
  state.rngState = second.state;
  const total = first.value + second.value;
  events.push(
    event("DICE_ROLLED", playerId, {
      dieOne: first.value,
      dieTwo: second.value,
      total,
      doubles: first.value === second.value,
    }),
  );

  const player = requiredMutablePlayer(state, playerId);
  if (player.inspectionTurns > 0) {
    if (first.value === second.value) {
      player.inspectionTurns = 0;
      events.push(event("INSPECTION_RELEASED", playerId, { method: "DOUBLES" }));
      movePlayer(state, playerId, total, true, events);
      resolveCurrentTile(state, playerId, context, events);
      return;
    }
    player.inspectionTurns += 1;
    if (player.inspectionTurns > state.board.rules.maxInspectionTurns) {
      player.inspectionTurns = 0;
      events.push(event("INSPECTION_RELEASED", playerId, { method: "FORCED_FEE" }));
      chargePlayer(
        state,
        playerId,
        null,
        state.board.rules.inspectionFee,
        "INSPECTION_FEE",
        events,
      );
    } else {
      state.phase = "MANAGING";
      events.push(
        event("INSPECTION_CONTINUED", playerId, {
          attempt: player.inspectionTurns,
        }),
      );
    }
    return;
  }

  movePlayer(state, playerId, total, true, events);
  resolveCurrentTile(state, playerId, context, events);
}

function movePlayer(
  state: MutableGameState,
  playerId: string,
  steps: number,
  collectPassStart: boolean,
  events: GameEvent[],
): void {
  const player = requiredMutablePlayer(state, playerId);
  const origin = player.position;
  const rawDestination = origin + steps;
  const tileCount = state.board.tileCount;
  const destination = ((rawDestination % tileCount) + tileCount) % tileCount;
  const passes = steps > 0 ? Math.floor(rawDestination / tileCount) : 0;
  if (collectPassStart && passes > 0) {
    const reward = passes * state.board.passStartReward;
    player.balance += reward;
    events.push(event("PASSED_START", playerId, { passes, reward }));
    events.push(event("BALANCE_CHANGED", playerId, { delta: reward, reason: "PASSED_START" }));
  }
  player.position = destination;
  events.push(event("PLAYER_MOVED", playerId, { from: origin, to: destination, steps }));
}

function resolveCurrentTile(
  state: MutableGameState,
  playerId: string,
  context: EngineContext,
  events: GameEvent[],
  depth = 0,
): void {
  if (depth > 6) {
    fail("INVARIANT_VIOLATION", "Tile resolution exceeded the recursion limit");
  }
  const player = requiredMutablePlayer(state, playerId);
  const tile = state.board.tiles[player.position];
  if (!tile) {
    fail("INVARIANT_VIOLATION", "Player reached a missing board tile");
  }
  events.push(
    event("TILE_RESOLVED", playerId, {
      tileId: tile.id,
      tileIndex: tile.index,
      tileType: tile.type,
    }),
  );

  switch (tile.type) {
    case "PROPERTY":
    case "TRANSPORT":
    case "UTILITY":
      resolvePropertyTile(state, playerId, tile.propertyId as string, context, events);
      break;
    case "REGIONAL_EVENT":
    case "COMMUNITY_BENEFIT":
      drawCard(state, playerId, tile.deck as CardDeckType, context, events, depth);
      break;
    case "MUNICIPAL_FEE":
      chargePlayer(state, playerId, null, tile.amount as number, "MUNICIPAL_FEE", events);
      break;
    case "INSPECTION":
      sendToInspection(state, playerId, events);
      break;
    case "MOVE":
      moveToPosition(state, playerId, tile.targetPosition as number, tile.collectPassStart, events);
      resolveCurrentTile(state, playerId, context, events, depth + 1);
      break;
    case "START":
    case "VISITING":
    case "REST":
      state.phase = "MANAGING";
      break;
  }
}

function resolvePropertyTile(
  state: MutableGameState,
  playerId: string,
  propertyId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  const property = requiredMutableProperty(state, propertyId);
  if (!property.ownerPlayerId) {
    state.activeDecision = {
      type: "PURCHASE_PROPERTY",
      playerId,
      propertyId,
      expiresAt: context.now + state.board.rules.purchaseDecisionMs,
    };
    state.phase = "AWAITING_PURCHASE";
    events.push(
      event("DECISION_REQUIRED", playerId, {
        decisionType: "PURCHASE_PROPERTY",
        propertyId,
        expiresAt: state.activeDecision.expiresAt,
      }),
    );
    return;
  }
  if (property.ownerPlayerId === playerId || property.mortgaged) {
    state.phase = "MANAGING";
    return;
  }
  const definition = requiredPropertyDefinition(state.board, propertyId);
  const rent = definition.rentByLevel[property.level] as number;
  chargePlayer(state, playerId, property.ownerPlayerId, rent, "RENT", events);
}

function buyProperty(
  state: MutableGameState,
  playerId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  const decision = state.activeDecision;
  if (state.phase !== "AWAITING_PURCHASE" || !decision || decision.playerId !== playerId) {
    fail("INVALID_GAME_PHASE", "There is no property purchase decision for this player");
  }
  if (decision.expiresAt <= context.now) {
    fail("DECISION_EXPIRED", "The property purchase decision has expired");
  }
  const definition = requiredPropertyDefinition(state.board, decision.propertyId);
  const property = requiredMutableProperty(state, decision.propertyId);
  const player = requiredMutablePlayer(state, playerId);
  if (property.ownerPlayerId) {
    fail("PROPERTY_UNAVAILABLE", "The property is no longer available");
  }
  if (player.balance < definition.price) {
    fail("INSUFFICIENT_BALANCE", "The player cannot afford this property");
  }
  player.balance -= definition.price;
  property.ownerPlayerId = playerId;
  state.activeDecision = null;
  state.phase = "MANAGING";
  events.push(
    event("PROPERTY_PURCHASED", playerId, {
      propertyId: property.propertyId,
      price: definition.price,
    }),
  );
  events.push(
    event("BALANCE_CHANGED", playerId, {
      delta: -definition.price,
      reason: "PROPERTY_PURCHASE",
    }),
  );
}

function declineProperty(
  state: MutableGameState,
  playerId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  const decision = state.activeDecision;
  if (state.phase !== "AWAITING_PURCHASE" || !decision || decision.playerId !== playerId) {
    fail("INVALID_GAME_PHASE", "There is no property purchase decision for this player");
  }
  if (decision.expiresAt <= context.now) {
    fail("DECISION_EXPIRED", "The property purchase decision has expired");
  }
  state.activeDecision = null;
  state.phase = "MANAGING";
  events.push(event("PROPERTY_DECLINED", playerId, { propertyId: decision.propertyId }));
}

function buildUpgrade(
  state: MutableGameState,
  playerId: string,
  propertyId: string,
  events: GameEvent[],
): void {
  requireManagingPhase(state);
  const property = requiredOwnedProperty(state, playerId, propertyId);
  const definition = requiredPropertyDefinition(state.board, propertyId);
  const group = groupProperties(state, definition.groupId);
  if (group.some((candidate) => candidate.state.ownerPlayerId !== playerId)) {
    fail("INVALID_UPGRADE", "The player must own the complete property group");
  }
  if (group.some((candidate) => candidate.state.mortgaged)) {
    fail("INVALID_UPGRADE", "A mortgaged group cannot receive upgrades");
  }
  if (property.level >= definition.maxLevel) {
    fail("INVALID_UPGRADE", "The property is already at maximum level");
  }
  const levelsAfter = group.map((candidate) =>
    candidate.definition.id === propertyId ? candidate.state.level + 1 : candidate.state.level,
  );
  if (Math.max(...levelsAfter) - Math.min(...levelsAfter) > 1) {
    fail("INVALID_UPGRADE", "Upgrades must remain balanced across the group");
  }
  const player = requiredMutablePlayer(state, playerId);
  if (player.balance < definition.upgradeCost) {
    fail("INSUFFICIENT_BALANCE", "The player cannot afford this upgrade");
  }
  player.balance -= definition.upgradeCost;
  property.level += 1;
  events.push(
    event("UPGRADE_BUILT", playerId, {
      propertyId,
      level: property.level,
      cost: definition.upgradeCost,
    }),
  );
  events.push(
    event("BALANCE_CHANGED", playerId, {
      delta: -definition.upgradeCost,
      reason: "UPGRADE_BUILT",
    }),
  );
}

function sellUpgrade(
  state: MutableGameState,
  playerId: string,
  propertyId: string,
  events: GameEvent[],
): void {
  requireManagementOrDebt(state);
  const property = requiredOwnedProperty(state, playerId, propertyId);
  if (property.level <= 0) {
    fail("INVALID_UPGRADE", "The property has no upgrade to sell");
  }
  const definition = requiredPropertyDefinition(state.board, propertyId);
  const group = groupProperties(state, definition.groupId);
  const levelsAfter = group.map((candidate) =>
    candidate.definition.id === propertyId ? candidate.state.level - 1 : candidate.state.level,
  );
  if (Math.max(...levelsAfter) - Math.min(...levelsAfter) > 1) {
    fail("INVALID_UPGRADE", "Upgrade sales must remain balanced across the group");
  }
  const proceeds = Math.floor(definition.upgradeCost / 2);
  property.level -= 1;
  requiredMutablePlayer(state, playerId).balance += proceeds;
  events.push(
    event("UPGRADE_SOLD", playerId, {
      propertyId,
      level: property.level,
      proceeds,
    }),
  );
  events.push(
    event("BALANCE_CHANGED", playerId, {
      delta: proceeds,
      reason: "UPGRADE_SOLD",
    }),
  );
}

function mortgageProperty(
  state: MutableGameState,
  playerId: string,
  propertyId: string,
  events: GameEvent[],
): void {
  requireManagementOrDebt(state);
  const property = requiredOwnedProperty(state, playerId, propertyId);
  const definition = requiredPropertyDefinition(state.board, propertyId);
  const group = groupProperties(state, definition.groupId);
  if (property.mortgaged) {
    fail("PROPERTY_UNAVAILABLE", "The property is already mortgaged");
  }
  if (group.some((candidate) => candidate.state.level > 0)) {
    fail("INVALID_UPGRADE", "All group upgrades must be sold before mortgaging");
  }
  property.mortgaged = true;
  requiredMutablePlayer(state, playerId).balance += definition.mortgageValue;
  events.push(
    event("PROPERTY_MORTGAGED", playerId, {
      propertyId,
      proceeds: definition.mortgageValue,
    }),
  );
  events.push(
    event("BALANCE_CHANGED", playerId, {
      delta: definition.mortgageValue,
      reason: "PROPERTY_MORTGAGED",
    }),
  );
}

function unmortgageProperty(
  state: MutableGameState,
  playerId: string,
  propertyId: string,
  events: GameEvent[],
): void {
  requireManagingPhase(state);
  const property = requiredOwnedProperty(state, playerId, propertyId);
  const definition = requiredPropertyDefinition(state.board, propertyId);
  if (!property.mortgaged) {
    fail("PROPERTY_UNAVAILABLE", "The property is not mortgaged");
  }
  const player = requiredMutablePlayer(state, playerId);
  if (player.balance < definition.unmortgageCost) {
    fail("INSUFFICIENT_BALANCE", "The player cannot afford to unmortgage this property");
  }
  player.balance -= definition.unmortgageCost;
  property.mortgaged = false;
  events.push(
    event("PROPERTY_UNMORTGAGED", playerId, {
      propertyId,
      cost: definition.unmortgageCost,
    }),
  );
  events.push(
    event("BALANCE_CHANGED", playerId, {
      delta: -definition.unmortgageCost,
      reason: "PROPERTY_UNMORTGAGED",
    }),
  );
}

function createTrade(
  state: MutableGameState,
  playerId: string,
  payload: Extract<GameCommand, { type: "CREATE_TRADE" }>["payload"],
  context: EngineContext,
  events: GameEvent[],
): void {
  requireTradePhase(state);
  if (state.trades[payload.tradeId]) {
    fail("INVALID_TRADE", "Trade id already exists");
  }
  if (payload.toPlayerId === playerId) {
    fail("INVALID_TRADE", "A player cannot trade with themselves");
  }
  requiredActivePlayer(state, payload.toPlayerId);
  validateTradeAssets(payload.offered, "offered");
  validateTradeAssets(payload.requested, "requested");
  if (isEmptyTrade(payload.offered) && isEmptyTrade(payload.requested)) {
    fail("INVALID_TRADE", "A trade cannot be empty");
  }
  assertAssetsAvailable(state, playerId, payload.offered);
  assertAssetsAvailable(state, payload.toPlayerId, payload.requested);
  const expiresAt = context.now + state.board.rules.tradeExpiryMs;
  state.trades[payload.tradeId] = {
    id: payload.tradeId,
    fromPlayerId: playerId,
    toPlayerId: payload.toPlayerId,
    offered: cloneAssets(payload.offered),
    requested: cloneAssets(payload.requested),
    status: "OPEN",
    expiresAt,
  };
  events.push(
    event("TRADE_CREATED", playerId, {
      tradeId: payload.tradeId,
      toPlayerId: payload.toPlayerId,
      expiresAt,
    }),
  );
}

function acceptTrade(
  state: MutableGameState,
  playerId: string,
  tradeId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  requireTradePhase(state);
  const trade = requiredOpenTrade(state, tradeId, context.now);
  if (trade.toPlayerId !== playerId) {
    fail("INVALID_TRADE", "Only the recipient can accept a trade");
  }
  assertAssetsAvailable(state, trade.fromPlayerId, trade.offered);
  assertAssetsAvailable(state, trade.toPlayerId, trade.requested);
  transferAssets(state, trade.fromPlayerId, trade.toPlayerId, trade.offered);
  transferAssets(state, trade.toPlayerId, trade.fromPlayerId, trade.requested);
  trade.status = "ACCEPTED";
  events.push(
    event("TRADE_ACCEPTED", playerId, {
      tradeId,
      fromPlayerId: trade.fromPlayerId,
      toPlayerId: trade.toPlayerId,
    }),
  );
}

function rejectTrade(
  state: MutableGameState,
  playerId: string,
  tradeId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  const trade = requiredOpenTrade(state, tradeId, context.now);
  if (trade.toPlayerId !== playerId) {
    fail("INVALID_TRADE", "Only the recipient can reject a trade");
  }
  trade.status = "REJECTED";
  events.push(event("TRADE_REJECTED", playerId, { tradeId }));
}

function cancelTrade(
  state: MutableGameState,
  playerId: string,
  tradeId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  const trade = requiredOpenTrade(state, tradeId, context.now);
  if (trade.fromPlayerId !== playerId) {
    fail("INVALID_TRADE", "Only the creator can cancel a trade");
  }
  trade.status = "CANCELLED";
  events.push(event("TRADE_CANCELLED", playerId, { tradeId }));
}

function useCard(
  state: MutableGameState,
  playerId: string,
  cardId: string,
  events: GameEvent[],
): void {
  if (state.phase !== "AWAITING_ROLL") {
    fail("INVALID_GAME_PHASE", "Inspection cards must be used before rolling");
  }
  const player = requiredMutablePlayer(state, playerId);
  if (player.position !== state.board.inspectionPosition || player.inspectionTurns <= 0) {
    fail("INVALID_CARD", "The player is not under inspection");
  }
  const card = requiredCard(state.board, cardId);
  if (card.effect.type !== "GET_OUT_OF_INSPECTION" || !player.heldCardIds.includes(cardId)) {
    fail("INVALID_CARD", "The card cannot be used in this situation");
  }
  player.heldCardIds.splice(player.heldCardIds.indexOf(cardId), 1);
  player.inspectionTurns = 0;
  events.push(event("CARD_USED", playerId, { cardId, effectType: card.effect.type }));
  events.push(event("INSPECTION_RELEASED", playerId, { method: "CARD" }));
}

function payInspectionFee(state: MutableGameState, playerId: string, events: GameEvent[]): void {
  if (state.phase !== "AWAITING_ROLL") {
    fail("INVALID_GAME_PHASE", "Inspection fee must be paid before rolling");
  }
  const player = requiredMutablePlayer(state, playerId);
  if (player.position !== state.board.inspectionPosition || player.inspectionTurns <= 0) {
    fail("INVALID_GAME_PHASE", "The player is not under inspection");
  }
  if (player.balance < state.board.rules.inspectionFee) {
    fail("INSUFFICIENT_BALANCE", "The player cannot afford the inspection fee");
  }
  player.balance -= state.board.rules.inspectionFee;
  player.inspectionTurns = 0;
  events.push(
    event("BALANCE_CHANGED", playerId, {
      delta: -state.board.rules.inspectionFee,
      reason: "INSPECTION_FEE",
    }),
  );
  events.push(event("INSPECTION_RELEASED", playerId, { method: "FEE" }));
}

function endTurn(
  state: MutableGameState,
  playerId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  if (state.phase !== "MANAGING") {
    fail("INVALID_GAME_PHASE", "The current turn still has an unresolved action");
  }
  events.push(event("TURN_ENDED", playerId, { turnNumber: state.turnNumber }));
  advanceTurn(state, context, events);
}

function advanceTurn(state: MutableGameState, context: EngineContext, events: GameEvent[]): void {
  const currentId = requiredCurrentPlayerId(state);
  const currentIndex = state.playerOrder.indexOf(currentId);
  let nextIndex = currentIndex;
  let wrapped = false;
  do {
    nextIndex = (nextIndex + 1) % state.playerOrder.length;
    if (nextIndex <= currentIndex) {
      wrapped = true;
    }
    const candidateId = state.playerOrder[nextIndex] as string;
    if (state.players[candidateId]?.status === "ACTIVE") {
      state.currentPlayerId = candidateId;
      break;
    }
  } while (nextIndex !== currentIndex);

  if (wrapped) {
    state.round += 1;
    if (state.board.rules.maxRounds && state.round > state.board.rules.maxRounds) {
      finishByNetWorth(state, events);
      return;
    }
  }
  state.turnNumber += 1;
  state.phase = "AWAITING_ROLL";
  state.activeDecision = null;
  state.pendingDebt = null;
  state.turnDeadlineAt = context.now + state.turnDurationSeconds * 1_000;
  events.push(
    event("TURN_STARTED", state.currentPlayerId, {
      round: state.round,
      turnNumber: state.turnNumber,
      deadlineAt: state.turnDeadlineAt,
    }),
  );
}

function drawCard(
  state: MutableGameState,
  playerId: string,
  deckType: CardDeckType,
  context: EngineContext,
  events: GameEvent[],
  depth: number,
): void {
  const deck = state.decks[deckType];
  if (deck.cardIds.length === 0) {
    fail("INVARIANT_VIOLATION", `Deck ${deckType} is empty`);
  }
  const cardId = deck.cardIds[deck.cursor] as string;
  deck.cursor = (deck.cursor + 1) % deck.cardIds.length;
  const card = requiredCard(state.board, cardId);
  events.push(
    event("CARD_DRAWN_PUBLIC", playerId, {
      cardId,
      title: card.title,
      effectType: card.effect.type,
    }),
  );
  applyCardEffect(state, playerId, card, context, events, depth);
}

function applyCardEffect(
  state: MutableGameState,
  playerId: string,
  card: CardDefinition,
  context: EngineContext,
  events: GameEvent[],
  depth: number,
): void {
  switch (card.effect.type) {
    case "RECEIVE": {
      requiredMutablePlayer(state, playerId).balance += card.effect.amount;
      state.phase = "MANAGING";
      events.push(
        event("BALANCE_CHANGED", playerId, {
          delta: card.effect.amount,
          reason: "CARD",
          cardId: card.id,
        }),
      );
      break;
    }
    case "PAY":
      chargePlayer(state, playerId, null, card.effect.amount, `CARD:${card.id}`, events);
      break;
    case "MOVE_TO":
      moveToPosition(state, playerId, card.effect.position, card.effect.collectPassStart, events);
      resolveCurrentTile(state, playerId, context, events, depth + 1);
      break;
    case "MOVE_STEPS":
      movePlayer(state, playerId, card.effect.steps, card.effect.steps > 0, events);
      resolveCurrentTile(state, playerId, context, events, depth + 1);
      break;
    case "GET_OUT_OF_INSPECTION":
      requiredMutablePlayer(state, playerId).heldCardIds.push(card.id);
      state.phase = "MANAGING";
      events.push(event("CARD_HELD", playerId, { cardId: card.id }));
      break;
    case "REPAIRS": {
      const upgrades = Object.values(state.properties)
        .filter((property) => property.ownerPlayerId === playerId)
        .reduce((total, property) => total + property.level, 0);
      chargePlayer(
        state,
        playerId,
        null,
        upgrades * card.effect.amountPerUpgrade,
        `CARD:${card.id}`,
        events,
      );
      break;
    }
  }
}

function moveToPosition(
  state: MutableGameState,
  playerId: string,
  position: number,
  collectPassStart: boolean,
  events: GameEvent[],
): void {
  const player = requiredMutablePlayer(state, playerId);
  const origin = player.position;
  if (collectPassStart && position < origin) {
    player.balance += state.board.passStartReward;
    events.push(
      event("PASSED_START", playerId, {
        passes: 1,
        reward: state.board.passStartReward,
      }),
    );
    events.push(
      event("BALANCE_CHANGED", playerId, {
        delta: state.board.passStartReward,
        reason: "PASSED_START",
      }),
    );
  }
  player.position = position;
  events.push(
    event("PLAYER_MOVED", playerId, {
      from: origin,
      to: position,
      steps: null,
    }),
  );
}

function sendToInspection(state: MutableGameState, playerId: string, events: GameEvent[]): void {
  const player = requiredMutablePlayer(state, playerId);
  player.position = state.board.inspectionPosition;
  player.inspectionTurns = 1;
  state.phase = "MANAGING";
  events.push(
    event("PLAYER_INSPECTED", playerId, {
      position: state.board.inspectionPosition,
    }),
  );
}

function chargePlayer(
  state: MutableGameState,
  debtorPlayerId: string,
  creditorPlayerId: string | null,
  amount: number,
  reason: string,
  events: GameEvent[],
): void {
  assertNonNegativeInteger(amount, "charge amount");
  if (amount === 0) {
    state.phase = "MANAGING";
    return;
  }
  const debtor = requiredMutablePlayer(state, debtorPlayerId);
  if (debtor.balance < amount) {
    state.pendingDebt = {
      debtorPlayerId,
      creditorPlayerId,
      amount,
      reason,
    };
    state.phase = "DEBT_RESOLUTION";
    events.push(
      event("DECISION_REQUIRED", debtorPlayerId, {
        decisionType: "DEBT_RESOLUTION",
        amount,
        creditorPlayerId,
        reason,
      }),
    );
    return;
  }
  settlePayment(state, debtorPlayerId, creditorPlayerId, amount, reason, events);
  state.phase = "MANAGING";
}

function settlePayment(
  state: MutableGameState,
  debtorPlayerId: string,
  creditorPlayerId: string | null,
  amount: number,
  reason: string,
  events: GameEvent[],
): void {
  const debtor = requiredMutablePlayer(state, debtorPlayerId);
  debtor.balance -= amount;
  if (creditorPlayerId) {
    requiredMutablePlayer(state, creditorPlayerId).balance += amount;
  }
  events.push(event("BALANCE_CHANGED", debtorPlayerId, { delta: -amount, reason }));
  if (creditorPlayerId) {
    events.push(event("BALANCE_CHANGED", creditorPlayerId, { delta: amount, reason }));
  }
  if (reason === "RENT") {
    events.push(
      event("RENT_PAID", debtorPlayerId, {
        creditorPlayerId,
        amount,
      }),
    );
  }
}

function settleDebtIfPossible(state: MutableGameState, events: GameEvent[]): void {
  const debt = state.pendingDebt;
  if (!debt) {
    return;
  }
  const debtor = requiredMutablePlayer(state, debt.debtorPlayerId);
  if (debtor.balance < debt.amount) {
    return;
  }
  settlePayment(
    state,
    debt.debtorPlayerId,
    debt.creditorPlayerId,
    debt.amount,
    debt.reason,
    events,
  );
  state.pendingDebt = null;
  state.phase = "MANAGING";
  events.push(
    event("DEBT_RESOLVED", debt.debtorPlayerId, {
      amount: debt.amount,
      creditorPlayerId: debt.creditorPlayerId,
    }),
  );
}

function declareBankruptcy(
  state: MutableGameState,
  playerId: string,
  context: EngineContext,
  events: GameEvent[],
): void {
  if (state.phase !== "DEBT_RESOLUTION" || state.pendingDebt?.debtorPlayerId !== playerId) {
    fail("INVALID_GAME_PHASE", "Bankruptcy requires an unresolved debt");
  }
  const debt = state.pendingDebt;
  const player = requiredMutablePlayer(state, playerId);
  if (debt.creditorPlayerId) {
    requiredMutablePlayer(state, debt.creditorPlayerId).balance += player.balance;
  }
  player.balance = 0;
  player.status = "BANKRUPT";
  player.eliminatedAtTurn = state.turnNumber;
  for (const property of Object.values(state.properties)) {
    if (property.ownerPlayerId === playerId) {
      property.ownerPlayerId = debt.creditorPlayerId;
      if (!debt.creditorPlayerId) {
        property.level = 0;
        property.mortgaged = false;
      }
    }
  }
  if (debt.creditorPlayerId) {
    requiredMutablePlayer(state, debt.creditorPlayerId).heldCardIds.push(...player.heldCardIds);
  }
  player.heldCardIds = [];
  for (const trade of Object.values(state.trades)) {
    if (
      trade.status === "OPEN" &&
      (trade.fromPlayerId === playerId || trade.toPlayerId === playerId)
    ) {
      trade.status = "CANCELLED";
    }
  }
  state.pendingDebt = null;
  state.activeDecision = null;
  events.push(
    event("PLAYER_BANKRUPT", playerId, {
      creditorPlayerId: debt.creditorPlayerId,
      reason: debt.reason,
    }),
  );

  const activePlayers = state.playerOrder.filter(
    (candidateId) => state.players[candidateId]?.status === "ACTIVE",
  );
  if (activePlayers.length === 1) {
    finishGame(state, activePlayers[0] as string, "LAST_SOLVENT", events);
    return;
  }
  state.phase = "MANAGING";
  advanceTurn(state, context, events);
}

function finishByNetWorth(state: MutableGameState, events: GameEvent[]): void {
  const candidates = state.playerOrder
    .filter((playerId) => state.players[playerId]?.status === "ACTIVE")
    .map((playerId) => ({ playerId, netWorth: calculateNetWorth(state, playerId) }))
    .sort(
      (left, right) =>
        right.netWorth - left.netWorth ||
        state.playerOrder.indexOf(left.playerId) - state.playerOrder.indexOf(right.playerId),
    );
  finishGame(state, (candidates[0] as { playerId: string }).playerId, "MAX_ROUNDS", events);
}

function finishGame(
  state: MutableGameState,
  winnerPlayerId: string,
  reason: string,
  events: GameEvent[],
): void {
  state.status = "FINISHED";
  state.phase = "FINISHED";
  state.currentPlayerId = null;
  state.winnerPlayerId = winnerPlayerId;
  state.finishReason = reason;
  state.finalStandings = buildFinalStandings(state, winnerPlayerId);
  state.activeDecision = null;
  state.pendingDebt = null;
  events.push(
    event("GAME_FINISHED", winnerPlayerId, {
      winnerPlayerId,
      reason,
      round: state.round,
    }),
  );
}

function buildFinalStandings(
  state: MutableGameState,
  winnerPlayerId: string,
): DeepMutable<GameState["finalStandings"]> {
  const ordered = state.playerOrder
    .map((playerId) => {
      const player = requiredMutablePlayer(state, playerId);
      return {
        playerId,
        netWorth: calculateNetWorth(state, playerId),
        status: player.status,
        eliminatedAtTurn: player.eliminatedAtTurn,
      };
    })
    .sort((left, right) => {
      if (left.playerId === winnerPlayerId) return -1;
      if (right.playerId === winnerPlayerId) return 1;
      if (left.status !== right.status) return left.status === "ACTIVE" ? -1 : 1;
      if (left.status === "BANKRUPT") {
        return (
          (right.eliminatedAtTurn ?? -1) - (left.eliminatedAtTurn ?? -1) ||
          right.netWorth - left.netWorth
        );
      }
      return right.netWorth - left.netWorth;
    });
  return ordered.map((standing, index) => ({
    playerId: standing.playerId,
    placement: index + 1,
    netWorth: standing.netWorth,
    status: standing.status,
  }));
}

function expireTrades(state: MutableGameState, now: number, events: GameEvent[]): void {
  for (const trade of Object.values(state.trades)) {
    if (trade.status === "OPEN" && trade.expiresAt <= now) {
      trade.status = "EXPIRED";
      events.push(event("TRADE_EXPIRED", null, { tradeId: trade.id }));
    }
  }
}

function assertAssetsAvailable(
  state: MutableGameState,
  playerId: string,
  assets: TradeAssets,
): void {
  const player = requiredActivePlayer(state, playerId);
  if (player.balance < assets.cash) {
    fail("INVALID_TRADE", "Trade cash is no longer available");
  }
  for (const propertyId of assets.propertyIds) {
    const property = requiredMutableProperty(state, propertyId);
    if (property.ownerPlayerId !== playerId || property.level !== 0) {
      fail("INVALID_TRADE", "Trade property is unavailable or still upgraded");
    }
  }
  for (const cardId of assets.cardIds) {
    const card = requiredCard(state.board, cardId);
    if (!card.tradable || !player.heldCardIds.includes(cardId)) {
      fail("INVALID_TRADE", "Trade card is unavailable or not tradable");
    }
  }
}

function transferAssets(
  state: MutableGameState,
  fromPlayerId: string,
  toPlayerId: string,
  assets: TradeAssets,
): void {
  const from = requiredMutablePlayer(state, fromPlayerId);
  const to = requiredMutablePlayer(state, toPlayerId);
  from.balance -= assets.cash;
  to.balance += assets.cash;
  for (const propertyId of assets.propertyIds) {
    requiredMutableProperty(state, propertyId).ownerPlayerId = toPlayerId;
  }
  for (const cardId of assets.cardIds) {
    from.heldCardIds.splice(from.heldCardIds.indexOf(cardId), 1);
    to.heldCardIds.push(cardId);
  }
}

function requiredOpenTrade(state: MutableGameState, tradeId: string, now: number): MutableTrade {
  const trade = state.trades[tradeId];
  if (trade?.status !== "OPEN") {
    fail("INVALID_TRADE", "Trade is not open");
  }
  if (trade.expiresAt <= now) {
    fail("INVALID_TRADE", "Trade has expired");
  }
  return trade;
}

function requiredOwnedProperty(
  state: MutableGameState,
  playerId: string,
  propertyId: string,
): MutableProperty {
  const property = requiredMutableProperty(state, propertyId);
  if (property.ownerPlayerId !== playerId) {
    fail("PROPERTY_UNAVAILABLE", "The player does not own this property");
  }
  return property;
}

function groupProperties(
  state: MutableGameState,
  groupId: string,
): readonly { readonly definition: PropertyDefinition; readonly state: MutableProperty }[] {
  const group = state.board.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    fail("INVARIANT_VIOLATION", "Property group is missing");
  }
  return group.propertyIds.map((propertyId) => ({
    definition: requiredPropertyDefinition(state.board, propertyId),
    state: requiredMutableProperty(state, propertyId),
  }));
}

function requireManagingPhase(state: MutableGameState): void {
  if (state.phase !== "MANAGING") {
    fail("INVALID_GAME_PHASE", "This action is only available during management");
  }
}

function requireManagementOrDebt(state: MutableGameState): void {
  if (state.phase !== "MANAGING" && state.phase !== "DEBT_RESOLUTION") {
    fail("INVALID_GAME_PHASE", "This action is unavailable in the current phase");
  }
}

function requireTradePhase(state: MutableGameState): void {
  if (state.activeDecision || state.pendingDebt || state.status !== "ACTIVE") {
    fail("INVALID_GAME_PHASE", "Trades are blocked by a mandatory resolution");
  }
}

function assertCurrentPlayer(state: MutableGameState, playerId: string): void {
  if (state.currentPlayerId !== playerId) {
    fail("NOT_YOUR_TURN", "Only the current player can perform this action");
  }
}

function requiredCurrentPlayerId(state: MutableGameState): string {
  if (!state.currentPlayerId) {
    fail("INVARIANT_VIOLATION", "Current player is missing");
  }
  return state.currentPlayerId;
}

function requiredPlayer(state: GameState, playerId: string): GamePlayerState {
  const player = state.players[playerId];
  if (!player) {
    fail("PLAYER_UNAVAILABLE", "Player does not exist");
  }
  return player;
}

function requiredMutablePlayer(state: MutableGameState, playerId: string): MutablePlayer {
  const player = state.players[playerId];
  if (!player) {
    fail("PLAYER_UNAVAILABLE", "Player does not exist");
  }
  return player;
}

function requiredActivePlayer(state: MutableGameState, playerId: string): MutablePlayer {
  const player = requiredMutablePlayer(state, playerId);
  if (player.status !== "ACTIVE") {
    fail("PLAYER_UNAVAILABLE", "Player is not active");
  }
  return player;
}

function requiredMutableProperty(state: MutableGameState, propertyId: string): MutableProperty {
  const property = state.properties[propertyId];
  if (!property) {
    fail("PROPERTY_UNAVAILABLE", "Property does not exist");
  }
  return property;
}

function requiredPropertyDefinition(
  board: BoardDefinition,
  propertyId: string,
): PropertyDefinition {
  const property = board.properties.find((candidate) => candidate.id === propertyId);
  if (!property) {
    fail("PROPERTY_UNAVAILABLE", "Property definition does not exist");
  }
  return property;
}

function requiredCard(board: BoardDefinition, cardId: string): CardDefinition {
  const card = board.cards.find((candidate) => candidate.id === cardId);
  if (!card) {
    fail("INVALID_CARD", "Card does not exist");
  }
  return card;
}

function validateInitialPlayers(players: readonly InitialPlayer[]): void {
  if (players.length < 2 || players.length > 6) {
    fail("INVALID_CONTENT", "A game requires between 2 and 6 players");
  }
  assertUnique(
    players.map((player) => player.id),
    "player id",
  );
  assertUnique(
    players.map((player) => player.userId),
    "player user id",
  );
  assertUnique(
    players.map((player) => player.pawnKey),
    "player pawn",
  );
  assertUnique(
    players.map((player) => player.colorKey),
    "player color",
  );
  assertUnique(
    players.map((player) => String(player.turnOrder)),
    "player turn order",
  );
  const order = players.map((player) => player.turnOrder).sort((left, right) => left - right);
  if (order.some((value, index) => value !== index)) {
    fail("INVALID_CONTENT", "Player turn order must be contiguous and start at zero");
  }
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    fail("INVALID_CONTENT", `Duplicate ${field}`);
  }
}

function isEmptyTrade(assets: TradeAssets): boolean {
  return assets.cash === 0 && assets.propertyIds.length === 0 && assets.cardIds.length === 0;
}

function cloneAssets(assets: TradeAssets): DeepMutable<TradeAssets> {
  return {
    cash: assets.cash,
    propertyIds: [...assets.propertyIds],
    cardIds: [...assets.cardIds],
  };
}

function cloneState(state: GameState): MutableGameState {
  return JSON.parse(JSON.stringify(state)) as MutableGameState;
}

function event(
  type: string,
  actorPlayerId: string | null,
  payload: Record<string, unknown> = EMPTY_PAYLOAD,
): GameEvent {
  return { type, actorPlayerId, payload };
}

function fail(code: ConstructorParameters<typeof GameRuleError>[0], message: string): never {
  throw new GameRuleError(code, message);
}
