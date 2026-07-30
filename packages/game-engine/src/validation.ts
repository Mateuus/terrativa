import type { BoardDefinition, GameState, TradeAssets } from "./types.js";
import { GameRuleError } from "./types.js";

export function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
}

export function validateBoardDefinition(board: BoardDefinition): void {
  assertPositiveInteger(board.version, "board.version");
  assertPositiveInteger(board.tileCount, "board.tileCount");
  assertNonNegativeInteger(board.startingBalance, "board.startingBalance");
  assertNonNegativeInteger(board.passStartReward, "board.passStartReward");
  assertPosition(board.inspectionPosition, board.tileCount, "board.inspectionPosition");
  assertPositiveInteger(board.rules.maxInspectionTurns, "board.rules.maxInspectionTurns");
  assertPositiveInteger(board.rules.purchaseDecisionMs, "board.rules.purchaseDecisionMs");
  assertPositiveInteger(board.rules.tradeExpiryMs, "board.rules.tradeExpiryMs");
  if (board.rules.maxRounds !== null) {
    assertPositiveInteger(board.rules.maxRounds, "board.rules.maxRounds");
  }
  if (board.tiles.length !== board.tileCount) {
    invalid("Board tileCount must match tiles length");
  }

  assertUnique(
    board.tiles.map((tile) => tile.id),
    "tile id",
  );
  assertUnique(
    board.tiles.map((tile) => String(tile.index)),
    "tile index",
  );
  const sortedPositions = board.tiles.map((tile) => tile.index).sort((left, right) => left - right);
  if (sortedPositions.some((position, index) => position !== index)) {
    invalid("Tile positions must be contiguous and start at zero");
  }
  if (board.tiles.filter((tile) => tile.type === "START").length !== 1) {
    invalid("Board must have exactly one START tile");
  }

  const propertyIdList = board.properties.map((property) => property.id);
  const groupIdList = board.groups.map((group) => group.id);
  assertUnique(propertyIdList, "property id");
  assertUnique(groupIdList, "property group id");
  const propertyIds = new Set(propertyIdList);
  const groupIds = new Set(groupIdList);
  for (const property of board.properties) {
    if (!groupIds.has(property.groupId)) {
      invalid(`Property ${property.id} references an unknown group`);
    }
    assertPosition(property.tileIndex, board.tileCount, `property ${property.id} tileIndex`);
    assertPositiveInteger(property.price, `property ${property.id} price`);
    assertPositiveInteger(property.mortgageValue, `property ${property.id} mortgageValue`);
    assertPositiveInteger(property.unmortgageCost, `property ${property.id} unmortgageCost`);
    assertPositiveInteger(property.upgradeCost, `property ${property.id} upgradeCost`);
    assertNonNegativeInteger(property.maxLevel, `property ${property.id} maxLevel`);
    if (property.rentByLevel.length !== property.maxLevel + 1) {
      invalid(`Property ${property.id} must define rent for every level`);
    }
    for (const rent of property.rentByLevel) {
      assertNonNegativeInteger(rent, `property ${property.id} rent`);
    }
  }

  const groupedProperties = new Set<string>();
  for (const group of board.groups) {
    if (group.propertyIds.length === 0) {
      invalid(`Property group ${group.id} cannot be empty`);
    }
    assertUnique(group.propertyIds, `property id in group ${group.id}`);
    for (const propertyId of group.propertyIds) {
      if (!propertyIds.has(propertyId)) {
        invalid(`Group ${group.id} references an unknown property`);
      }
      if (groupedProperties.has(propertyId)) {
        invalid(`Property ${propertyId} belongs to more than one group`);
      }
      groupedProperties.add(propertyId);
    }
  }
  if (groupedProperties.size !== propertyIds.size) {
    invalid("Every property must belong to exactly one group");
  }

  for (const tile of board.tiles) {
    const isProperty = ["PROPERTY", "TRANSPORT", "UTILITY"].includes(tile.type);
    if (isProperty !== (tile.propertyId !== null)) {
      invalid(`Tile ${tile.id} has an invalid property reference`);
    }
    if (tile.propertyId && !propertyIds.has(tile.propertyId)) {
      invalid(`Tile ${tile.id} references an unknown property`);
    }
    if (["REGIONAL_EVENT", "COMMUNITY_BENEFIT"].includes(tile.type) !== (tile.deck !== null)) {
      invalid(`Tile ${tile.id} has an invalid deck reference`);
    }
    if (tile.type === "MUNICIPAL_FEE" && tile.amount === null) {
      invalid(`Fee tile ${tile.id} must define an amount`);
    }
    if (tile.amount !== null) {
      assertNonNegativeInteger(tile.amount, `tile ${tile.id} amount`);
    }
    if (tile.type === "MOVE" && tile.targetPosition === null) {
      invalid(`Move tile ${tile.id} must define a target`);
    }
    if (tile.targetPosition !== null) {
      assertPosition(tile.targetPosition, board.tileCount, `tile ${tile.id} targetPosition`);
    }
  }

  assertUnique(
    board.cards.map((card) => card.id),
    "card id",
  );
  for (const card of board.cards) {
    switch (card.effect.type) {
      case "RECEIVE":
      case "PAY":
        assertPositiveInteger(card.effect.amount, `card ${card.id} amount`);
        break;
      case "MOVE_TO":
        assertPosition(card.effect.position, board.tileCount, `card ${card.id} position`);
        break;
      case "MOVE_STEPS":
        if (!Number.isSafeInteger(card.effect.steps) || card.effect.steps === 0) {
          invalid(`Card ${card.id} must move a non-zero number of steps`);
        }
        break;
      case "REPAIRS":
        assertPositiveInteger(card.effect.amountPerUpgrade, `card ${card.id} amountPerUpgrade`);
        break;
      case "GET_OUT_OF_INSPECTION":
        break;
    }
  }
  for (const tile of board.tiles) {
    if (tile.deck && board.cards.filter((card) => card.deck === tile.deck).length === 0) {
      invalid(`Deck ${tile.deck} is used by the board but has no cards`);
    }
  }
}

export function validateGameState(state: GameState): void {
  validateBoardDefinition(state.board);
  assertNonNegativeInteger(state.version, "state.version");
  assertPositiveInteger(state.round, "state.round");
  assertPositiveInteger(state.turnNumber, "state.turnNumber");
  assertUnique(state.playerOrder, "player order");
  if (state.playerOrder.length < 2 || state.playerOrder.length > 6) {
    invariant("A game must contain between 2 and 6 players");
  }
  for (const playerId of state.playerOrder) {
    const player = state.players[playerId];
    if (!player) {
      invariant(`Player ${playerId} is missing from state`);
    }
    assertNonNegativeInteger(player.balance, `player ${playerId} balance`);
    assertPosition(player.position, state.board.tileCount, `player ${playerId} position`);
    assertNonNegativeInteger(player.inspectionTurns, `player ${playerId} inspectionTurns`);
  }
  if (state.status === "ACTIVE") {
    const current = state.currentPlayerId ? state.players[state.currentPlayerId] : null;
    if (current?.status !== "ACTIVE") {
      invariant("An active game must have an active current player");
    }
  }
  if (state.status === "FINISHED") {
    if (
      state.phase !== "FINISHED" ||
      !state.winnerPlayerId ||
      state.finalStandings.length !== state.playerOrder.length
    ) {
      invariant("A finished game must have a winner and FINISHED phase");
    }
    assertUnique(
      state.finalStandings.map((standing) => standing.playerId),
      "final standing player",
    );
  } else if (state.finalStandings.length !== 0) {
    invariant("An active game cannot have final standings");
  }
  if ((state.phase === "AWAITING_PURCHASE") !== (state.activeDecision !== null)) {
    invariant("Purchase phase and active decision must agree");
  }
  if ((state.phase === "DEBT_RESOLUTION") !== (state.pendingDebt !== null)) {
    invariant("Debt phase and pending debt must agree");
  }
  if (state.pendingDebt && state.pendingDebt.debtorPlayerId !== state.currentPlayerId) {
    invariant("Only the current player may resolve mandatory debt");
  }

  for (const definition of state.board.properties) {
    const property = state.properties[definition.id];
    if (!property) {
      invariant(`Property state ${definition.id} is missing`);
    }
    if (
      !Number.isSafeInteger(property.level) ||
      property.level < 0 ||
      property.level > definition.maxLevel
    ) {
      invariant(`Property ${definition.id} has an invalid level`);
    }
    if (property.ownerPlayerId && !state.players[property.ownerPlayerId]) {
      invariant(`Property ${definition.id} has an unknown owner`);
    }
    if (property.mortgaged && property.level !== 0) {
      invariant(`Mortgaged property ${definition.id} cannot have upgrades`);
    }
  }
  assertUnique(state.processedCommandIds, "processed command id");
}

export function validateTradeAssets(assets: TradeAssets, field: string): void {
  assertNonNegativeInteger(assets.cash, `${field}.cash`);
  assertUnique(assets.propertyIds, `${field}.propertyIds`);
  assertUnique(assets.cardIds, `${field}.cardIds`);
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    invalid(`${field} must be a positive safe integer`);
  }
}

function assertPosition(value: number, tileCount: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= tileCount) {
    invalid(`${field} must be a valid board position`);
  }
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    invalid(`Duplicate ${field}`);
  }
}

function invalid(message: string): never {
  throw new GameRuleError("INVALID_CONTENT", message);
}

function invariant(message: string): never {
  throw new GameRuleError("INVARIANT_VIOLATION", message);
}
