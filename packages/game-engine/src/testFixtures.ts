import type {
  BoardDefinition,
  GameCommand,
  GameState,
  InitialPlayer,
  TileDefinition,
} from "./types.js";

export const testPlayers: readonly InitialPlayer[] = [
  {
    id: "player-1",
    userId: "user-1",
    displayName: "Ana",
    pawnKey: "tram",
    colorKey: "ocean",
    turnOrder: 0,
  },
  {
    id: "player-2",
    userId: "user-2",
    displayName: "Beto",
    pawnKey: "capybara",
    colorKey: "mangrove",
    turnOrder: 1,
  },
];

const neutral = {
  propertyId: null,
  deck: null,
  amount: null,
  targetPosition: null,
  collectPassStart: false,
} as const;

export const testBoard: BoardDefinition = {
  id: "board-test",
  version: 1,
  tileCount: 12,
  startingBalance: 1_500,
  passStartReward: 200,
  inspectionPosition: 9,
  rules: {
    inspectionFee: 50,
    maxInspectionTurns: 3,
    purchaseDecisionMs: 15_000,
    tradeExpiryMs: 30_000,
    maxRounds: 20,
  },
  tiles: [
    tile(0, "START", "Início"),
    tile(1, "REST", "Orla"),
    propertyTile(2, "PROPERTY", "p1", "Canal"),
    propertyTile(3, "PROPERTY", "p2", "Praia"),
    {
      ...tile(4, "REGIONAL_EVENT", "Evento"),
      deck: "REGIONAL_EVENT",
    },
    {
      ...tile(5, "MUNICIPAL_FEE", "Taxa"),
      amount: 100,
    },
    tile(6, "INSPECTION", "Fiscalização"),
    propertyTile(7, "PROPERTY", "p3", "Serra"),
    propertyTile(8, "PROPERTY", "p4", "Parque"),
    tile(9, "VISITING", "Visita"),
    {
      ...tile(10, "COMMUNITY_BENEFIT", "Benefício"),
      deck: "COMMUNITY_BENEFIT",
    },
    {
      ...tile(11, "MOVE", "Atalho"),
      targetPosition: 1,
    },
  ],
  groups: [
    { id: "coast", propertyIds: ["p1", "p2"] },
    { id: "hills", propertyIds: ["p3", "p4"] },
  ],
  properties: [
    property("p1", "coast", 2, 100, [10, 30, 90, 160, 250]),
    property("p2", "coast", 3, 120, [12, 36, 100, 180, 280]),
    property("p3", "hills", 7, 160, [16, 48, 140, 240, 360]),
    property("p4", "hills", 8, 180, [18, 54, 150, 260, 400]),
  ],
  cards: [
    {
      id: "event-receive",
      deck: "REGIONAL_EVENT",
      title: "Festival regional",
      effect: { type: "RECEIVE", amount: 80 },
      tradable: false,
    },
    {
      id: "event-pay",
      deck: "REGIONAL_EVENT",
      title: "Manutenção regional",
      effect: { type: "PAY", amount: 60 },
      tradable: false,
    },
    {
      id: "event-move",
      deck: "REGIONAL_EVENT",
      title: "Nova rota",
      effect: { type: "MOVE_TO", position: 1, collectPassStart: true },
      tradable: false,
    },
    {
      id: "benefit-receive",
      deck: "COMMUNITY_BENEFIT",
      title: "Projeto comunitário",
      effect: { type: "RECEIVE", amount: 50 },
      tradable: false,
    },
    {
      id: "benefit-inspection",
      deck: "COMMUNITY_BENEFIT",
      title: "Passe de fiscalização",
      effect: { type: "GET_OUT_OF_INSPECTION" },
      tradable: true,
    },
    {
      id: "benefit-repairs",
      deck: "COMMUNITY_BENEFIT",
      title: "Reparos preventivos",
      effect: { type: "REPAIRS", amountPerUpgrade: 20 },
      tradable: false,
    },
  ],
};

export function command(
  state: GameState,
  type: GameCommand["type"],
  payload: GameCommand["payload"],
  actorPlayerId = state.currentPlayerId as string,
  sequence = state.version,
): GameCommand {
  return {
    commandId: `command-${sequence}-${type}`,
    actorPlayerId,
    expectedStateVersion: state.version,
    type,
    payload,
  } as GameCommand;
}

function tile(index: number, type: TileDefinition["type"], name: string): TileDefinition {
  return {
    id: `tile-${index}`,
    index,
    type,
    name,
    ...neutral,
  };
}

function propertyTile(
  index: number,
  type: "PROPERTY" | "TRANSPORT" | "UTILITY",
  propertyId: string,
  name: string,
): TileDefinition {
  return {
    ...tile(index, type, name),
    propertyId,
  };
}

function property(
  id: string,
  groupId: string,
  tileIndex: number,
  price: number,
  rentByLevel: readonly number[],
) {
  return {
    id,
    groupId,
    tileIndex,
    price,
    mortgageValue: Math.floor(price / 2),
    unmortgageCost: Math.ceil(price * 0.55),
    rentByLevel,
    upgradeCost: 50,
    maxLevel: 4,
  };
}
