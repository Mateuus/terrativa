import {
  type BoardDefinition,
  type CardDefinition,
  type CardEffect,
  type TileDefinition,
  validateBoardDefinition,
} from "@terrativa/game-engine";
import type { BoardContent, BoardContentCard, BoardContentTile } from "./schema.js";

export function toEngineBoard(content: BoardContent): BoardDefinition {
  const enabledCards = content.decks.flatMap((deck) =>
    deck.cards.filter((card) => card.enabled).map((card) => toEngineCard(deck.type, card)),
  );
  const properties = content.tiles.flatMap((tile) => {
    if (!tile.property) {
      return [];
    }
    const group = requiredGroup(content, tile.property.groupKey);
    return [
      {
        id: tile.property.id,
        groupId: group.id,
        tileIndex: tile.position,
        price: tile.property.purchasePrice,
        mortgageValue: tile.property.mortgageValue,
        unmortgageCost: tile.property.unmortgageCost,
        rentByLevel: tile.property.rentByLevel,
        upgradeCost: group.upgradeCost,
        maxLevel: group.maxLevel,
      },
    ];
  });
  const board: BoardDefinition = {
    id: content.id,
    version: content.version,
    tileCount: content.tileCount,
    startingBalance: content.startingBalance,
    passStartReward: content.passStartReward,
    inspectionPosition: content.inspectionPosition,
    rules: content.rules,
    tiles: content.tiles.map(toEngineTile),
    groups: content.groups.map((group) => ({
      id: group.id,
      propertyIds: properties
        .filter((property) => property.groupId === group.id)
        .map((property) => property.id),
    })),
    properties,
    cards: enabledCards,
  };

  validateBoardDefinition(board);
  return board;
}

function toEngineTile(tile: BoardContentTile): TileDefinition {
  const deck =
    tile.type === "REGIONAL_EVENT"
      ? "REGIONAL_EVENT"
      : tile.type === "COMMUNITY_BENEFIT"
        ? "COMMUNITY_BENEFIT"
        : null;
  return {
    id: tile.id,
    index: tile.position,
    type: tile.type,
    name: tile.name,
    propertyId: tile.property?.id ?? null,
    deck,
    amount: tile.amount,
    targetPosition: tile.targetPosition,
    collectPassStart: tile.collectPassStart,
  };
}

function toEngineCard(
  deck: "REGIONAL_EVENT" | "COMMUNITY_BENEFIT",
  card: BoardContentCard,
): CardDefinition {
  return {
    id: card.id,
    deck,
    title: card.title,
    effect: card.effect as CardEffect,
    tradable: card.tradable,
  };
}

function requiredGroup(content: BoardContent, key: string): BoardContent["groups"][number] {
  const group = content.groups.find((candidate) => candidate.key === key);
  if (!group) {
    throw new Error(`Unknown property group: ${key}`);
  }
  return group;
}
