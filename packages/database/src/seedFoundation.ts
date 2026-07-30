import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import {
  baixadaSantistaModule,
  exportTerrativaModule,
  toEngineBoard,
} from "@terrativa/board-content";
import { config as loadEnvironment } from "dotenv";
import { createDatabaseClient } from "./index.js";

const baixadaSantistaContent = requiredPrimaryBoard();
const FOUNDATION_THEME_ID = "6491c0ec-23d5-418a-bf3a-eed6ef16ba53";
const FOUNDATION_BOARD_ID = baixadaSantistaContent.id;
const CONTENT_ACTOR_ID = "6bd5383e-7e11-45f0-bf38-2a994022fd27";
const FOUNDATION_SEASON_ID = "aaea3605-337a-4dfe-9ef1-a92f8732c527";

loadEnvironment({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const database = createDatabaseClient();
const engineBoard = toEngineBoard(baixadaSantistaContent);
const contentExport = exportTerrativaModule(baixadaSantistaModule);

try {
  const activeCreator = await database.user.findFirst({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const creator =
    activeCreator ??
    (await database.user.upsert({
      where: { id: CONTENT_ACTOR_ID },
      create: {
        id: CONTENT_ACTOR_ID,
        email: "content-actor@terrativa.invalid",
        username: "terrativa_content",
        passwordHash: `disabled:${randomBytes(32).toString("hex")}`,
        role: "USER",
        status: "SUSPENDED",
        profile: {
          create: {
            displayName: "Conteúdo Terrativa",
            locale: "pt-BR",
          },
        },
      },
      update: { status: "SUSPENDED" },
      select: { id: true },
    }));

  const themeSlugConflict = await database.theme.findUnique({
    where: { slug: "territorios-brasileiros" },
    select: { id: true },
  });
  if (themeSlugConflict && themeSlugConflict.id !== FOUNDATION_THEME_ID) {
    throw new Error("The territorios-brasileiros slug already belongs to another theme");
  }

  const slugConflict = await database.board.findUnique({
    where: { slug: baixadaSantistaContent.slug },
    select: { id: true },
  });
  if (slugConflict && slugConflict.id !== FOUNDATION_BOARD_ID) {
    throw new Error("The baixada-santista slug already belongs to another board");
  }

  await database.$transaction(async (transaction) => {
    await transaction.theme.upsert({
      where: { id: FOUNDATION_THEME_ID },
      create: {
        id: FOUNDATION_THEME_ID,
        slug: "territorios-brasileiros",
        name: "Territórios Brasileiros",
        description:
          "Mapas fictícios inspirados em regiões brasileiras, sem valores econômicos reais.",
        status: "ACTIVE",
        createdBy: creator.id,
      },
      update: {
        name: "Territórios Brasileiros",
        description:
          "Mapas fictícios inspirados em regiões brasileiras, sem valores econômicos reais.",
        status: "ACTIVE",
      },
    });
    await transaction.board.upsert({
      where: { id: FOUNDATION_BOARD_ID },
      create: {
        id: FOUNDATION_BOARD_ID,
        themeId: FOUNDATION_THEME_ID,
        slug: baixadaSantistaContent.slug,
        name: baixadaSantistaContent.name,
        tileCount: baixadaSantistaContent.tileCount,
        startingBalance: baixadaSantistaContent.startingBalance,
        passStartReward: baixadaSantistaContent.passStartReward,
        rulesJson: boardRulesJson(),
        version: baixadaSantistaContent.version,
        status: "ACTIVE",
      },
      update: {
        name: baixadaSantistaContent.name,
        tileCount: baixadaSantistaContent.tileCount,
        startingBalance: baixadaSantistaContent.startingBalance,
        passStartReward: baixadaSantistaContent.passStartReward,
        rulesJson: boardRulesJson(),
        version: baixadaSantistaContent.version,
        status: "ACTIVE",
      },
    });

    const groupIdsByKey = new Map<string, string>();
    for (const group of baixadaSantistaContent.groups) {
      groupIdsByKey.set(group.key, group.id);
      await transaction.propertyGroup.upsert({
        where: { id: group.id },
        create: {
          id: group.id,
          boardId: FOUNDATION_BOARD_ID,
          key: group.key,
          name: group.name,
          color: group.color,
          upgradeCost: group.upgradeCost,
          maxLevel: group.maxLevel,
        },
        update: {
          key: group.key,
          name: group.name,
          color: group.color,
          upgradeCost: group.upgradeCost,
          maxLevel: group.maxLevel,
        },
      });
    }

    for (const tile of baixadaSantistaContent.tiles) {
      await transaction.boardTile.upsert({
        where: { id: tile.id },
        create: {
          id: tile.id,
          boardId: FOUNDATION_BOARD_ID,
          position: tile.position,
          type: tile.type,
          name: tile.name,
          description: tile.description,
          assetKey: tile.asset.key,
          configJson: tileConfigJson(tile),
        },
        update: {
          position: tile.position,
          type: tile.type,
          name: tile.name,
          description: tile.description,
          assetKey: tile.asset.key,
          configJson: tileConfigJson(tile),
        },
      });

      if (tile.property) {
        const groupId = groupIdsByKey.get(tile.property.groupKey);
        if (!groupId) {
          throw new Error(`Unknown group ${tile.property.groupKey}`);
        }
        await transaction.propertyDefinition.upsert({
          where: { id: tile.property.id },
          create: {
            id: tile.property.id,
            tileId: tile.id,
            groupId,
            purchasePrice: tile.property.purchasePrice,
            mortgageValue: tile.property.mortgageValue,
            unmortgageCost: tile.property.unmortgageCost,
            rentByLevel: [...tile.property.rentByLevel],
          },
          update: {
            tileId: tile.id,
            groupId,
            purchasePrice: tile.property.purchasePrice,
            mortgageValue: tile.property.mortgageValue,
            unmortgageCost: tile.property.unmortgageCost,
            rentByLevel: [...tile.property.rentByLevel],
          },
        });
      }
    }

    for (const deck of baixadaSantistaContent.decks) {
      await transaction.cardDeck.upsert({
        where: { id: deck.id },
        create: {
          id: deck.id,
          boardId: FOUNDATION_BOARD_ID,
          type: deck.type,
          name: deck.name,
        },
        update: { type: deck.type, name: deck.name },
      });
      for (const card of deck.cards) {
        await transaction.cardDefinition.upsert({
          where: { id: card.id },
          create: {
            id: card.id,
            deckId: deck.id,
            key: card.key,
            title: card.title,
            publicText: card.publicText,
            effectType: card.effect.type,
            effectConfigJson: {
              ...card.effect,
              educationalText: card.educationalText,
            },
            tradable: card.tradable,
            enabled: card.enabled,
          },
          update: {
            key: card.key,
            title: card.title,
            publicText: card.publicText,
            effectType: card.effect.type,
            effectConfigJson: {
              ...card.effect,
              educationalText: card.educationalText,
            },
            tradable: card.tradable,
            enabled: card.enabled,
          },
        });
      }
    }

    await transaction.rankedSeason.upsert({
      where: { id: FOUNDATION_SEASON_ID },
      create: {
        id: FOUNDATION_SEASON_ID,
        slug: "temporada-1",
        name: "Temporada 1",
        status: "ACTIVE",
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.999Z"),
      },
      update: {
        name: "Temporada 1",
        status: "ACTIVE",
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.999Z"),
      },
    });
  });

  const persistedCounts = await Promise.all([
    database.boardTile.count({ where: { boardId: FOUNDATION_BOARD_ID } }),
    database.propertyGroup.count({ where: { boardId: FOUNDATION_BOARD_ID } }),
    database.propertyDefinition.count({
      where: { tile: { boardId: FOUNDATION_BOARD_ID } },
    }),
    database.cardDeck.count({ where: { boardId: FOUNDATION_BOARD_ID } }),
    database.cardDefinition.count({
      where: { deck: { boardId: FOUNDATION_BOARD_ID } },
    }),
  ]);
  const expectedCounts = [36, 11, 23, 2, 16];
  if (persistedCounts.some((count, index) => count !== expectedCounts[index])) {
    throw new Error(
      `Persisted content count mismatch: ${persistedCounts.join("/")} expected ${expectedCounts.join("/")}`,
    );
  }

  process.stdout.write(
    `Baixada Santista v${engineBoard.version} ready: ${persistedCounts.join("/")} (${contentExport.checksum})\n`,
  );
} finally {
  await database.$disconnect();
}

function boardRulesJson() {
  return {
    currency: "territas",
    economy: "fictional",
    contentPhase: "phase-6",
    schemaVersion: baixadaSantistaContent.schemaVersion,
    moduleApiVersion: baixadaSantistaModule.moduleApiVersion,
    moduleSlug: baixadaSantistaModule.slug,
    moduleVersion: baixadaSantistaModule.version,
    edition: baixadaSantistaContent.edition,
    inspectionPosition: baixadaSantistaContent.inspectionPosition,
    rules: baixadaSantistaContent.rules,
    economyDisclaimer: baixadaSantistaContent.economyDisclaimer,
    contentChecksum: contentExport.checksum,
    cities: baixadaSantistaContent.cities,
    sources: baixadaSantistaContent.sources,
  };
}

function requiredPrimaryBoard() {
  const board = baixadaSantistaModule.boards[0];
  if (!board) {
    throw new Error("Baixada Santista module has no board");
  }
  return board;
}

function tileConfigJson(tile: (typeof baixadaSantistaContent.tiles)[number]) {
  return {
    cityKey: tile.cityKey,
    educationalText: tile.educationalText,
    fallbackAssetKey: tile.asset.fallbackKey,
    amount: tile.amount,
    targetPosition: tile.targetPosition,
    collectPassStart: tile.collectPassStart,
  };
}
