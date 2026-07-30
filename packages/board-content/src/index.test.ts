import { describe, expect, it } from "vitest";
import {
  baixadaSantistaContent,
  baixadaSantistaModule,
  baixadaSantistaScene,
  boardContentSchema,
  boardSummarySchema,
  characterAssetPacks,
  characterPawnCatalog,
  createModuleRegistry,
  exportBoardContent,
  exportTerrativaModule,
  foundationBoard,
  importBoardContent,
  importTerrativaModule,
  simulateBoardBalance,
  terrativaModuleRegistry,
  terrativaModuleSchema,
  toEngineBoard,
  validateBoardScene,
} from "./index.js";

describe("conteúdo Terrativa: Baixada Santista", () => {
  it("mantém 21 personagens Quaternius com IDs únicos e origem CC0", () => {
    expect(characterAssetPacks).toHaveLength(2);
    expect(characterAssetPacks.every((pack) => pack.license === "CC0-1.0")).toBe(true);
    expect(characterPawnCatalog).toHaveLength(21);
    expect(new Set(characterPawnCatalog.map((pawn) => pawn.key)).size).toBe(21);
  });

  it("entrega 36 casas contínuas e quatro casas para cada cidade", () => {
    const content = boardContentSchema.parse(baixadaSantistaContent);
    expect(boardSummarySchema.parse(foundationBoard)).toMatchObject({
      tileCount: 36,
      version: 2,
    });
    expect(content.tiles).toHaveLength(36);
    expect(content.cities).toHaveLength(9);
    for (const city of content.cities) {
      expect(content.tiles.filter((tile) => tile.cityKey === city.key)).toHaveLength(4);
    }
  });

  it("entrega uma cena editável com uma posição para cada casa", () => {
    const scene = validateBoardScene(baixadaSantistaScene);
    expect(scene.boardSlug).toBe(baixadaSantistaContent.slug);
    expect(scene.tiles).toHaveLength(baixadaSantistaContent.tileCount);
    expect(new Set(scene.tiles.map((tile) => tile.position)).size).toBe(
      baixadaSantistaContent.tileCount,
    );
    expect(scene.props.some((prop) => prop.assetId === "kenney-tower-large")).toBe(true);
  });

  it("possui grupos completos, propriedades fictícias, cartas e fallbacks visuais", () => {
    const content = baixadaSantistaContent;
    const properties = content.tiles.flatMap((tile) => (tile.property ? [tile.property] : []));
    expect(content.groups).toHaveLength(11);
    expect(properties).toHaveLength(23);
    expect(content.decks).toHaveLength(2);
    expect(content.decks.flatMap((deck) => deck.cards)).toHaveLength(16);
    expect(content.tiles.every((tile) => tile.asset.fallbackKey.length > 0)).toBe(true);
    expect(content.economyDisclaimer).toContain("valores fictícios");
  });

  it("converte o pacote para a definição validada pela engine", () => {
    const board = toEngineBoard(baixadaSantistaContent);
    expect(board.tileCount).toBe(36);
    expect(board.properties).toHaveLength(23);
    expect(board.cards).toHaveLength(16);
    expect(board.tiles[board.inspectionPosition]?.type).toBe("INSPECTION");
  });

  it("rejeita referências e tabelas econômicas inconsistentes", () => {
    const invalid = structuredClone(baixadaSantistaContent);
    const ownable = invalid.tiles.find((tile) => tile.property);
    if (!ownable?.property) {
      throw new Error("fixture sem propriedade");
    }
    ownable.property.groupKey = "grupo-inexistente";
    expect(() => boardContentSchema.parse(invalid)).toThrow();
  });

  it("exporta de forma canônica e valida o checksum na importação", () => {
    const first = exportBoardContent(baixadaSantistaContent);
    const second = exportBoardContent(baixadaSantistaContent);
    expect(first).toEqual(second);
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(importBoardContent(first.json, first.checksum)).toEqual(baixadaSantistaContent);
    expect(() => importBoardContent(first.json, "0".repeat(64))).toThrow("checksum mismatch");
  });

  it("registra o módulo oficial sem prender o núcleo a uma única região", () => {
    expect(terrativaModuleSchema.parse(baixadaSantistaModule).boards).toHaveLength(1);
    expect(terrativaModuleRegistry.list()).toEqual([
      expect.objectContaining({
        slug: "baixada-santista",
        official: true,
        boardCount: 1,
      }),
    ]);
    expect(terrativaModuleRegistry.getBoard(baixadaSantistaContent.slug)?.id).toBe(
      baixadaSantistaContent.id,
    );
    expect(terrativaModuleRegistry.getMap(baixadaSantistaContent.slug)?.cities).toHaveLength(9);
  });

  it("aceita um módulo comunitário versionado com repositório público", () => {
    const community = structuredClone(baixadaSantistaModule);
    community.slug = "baixada-fluminense";
    community.name = "Terrativa: Baixada Fluminense";
    community.repositoryUrl = "https://codeberg.org/comunidade/terrativa-baixada-fluminense";
    community.territory.regionName = "Baixada Fluminense";
    const board = community.boards[0];
    if (!board) {
      throw new Error("fixture sem tabuleiro");
    }
    board.id = "9d949a54-e5fd-4a7f-aa36-80eb3eec6071";
    board.slug = "baixada-fluminense";
    board.name = "Baixada Fluminense";
    const map = community.mapViews[0];
    if (!map) {
      throw new Error("fixture sem mapa");
    }
    map.boardSlug = "baixada-fluminense";

    const registry = createModuleRegistry([baixadaSantistaModule, community], ["baixada-santista"]);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get("baixada-fluminense")?.license.content).toBe("CC-BY-4.0");
    expect(registry.getMap("baixada-fluminense")?.boardSlug).toBe("baixada-fluminense");
  });

  it("não aceita módulo comunitário sem origem ou com código executável no manifesto", () => {
    const noRepository = structuredClone(baixadaSantistaModule);
    noRepository.slug = "modulo-comunitario";
    expect(() => createModuleRegistry([noRepository])).toThrow("requires repositoryUrl");

    expect(() =>
      terrativaModuleSchema.parse({
        ...baixadaSantistaModule,
        setup: "execute-arbitrary-code",
      }),
    ).toThrow();
  });

  it("exporta e importa o módulo inteiro com manifesto e tabuleiros", () => {
    const exported = exportTerrativaModule(baixadaSantistaModule);
    const imported = importTerrativaModule(exported.json, exported.checksum);
    expect(imported.slug).toBe("baixada-santista");
    expect(imported.boards[0]?.tiles).toHaveLength(36);
  });

  it("conclui partidas determinísticas sem estados impossíveis", () => {
    const report = simulateBoardBalance(toEngineBoard(baixadaSantistaContent), {
      games: 24,
      playerCount: 4,
      seed: "phase-6-test",
    });
    expect(report.impossibleStates).toEqual([]);
    expect(report.completedGames).toBe(24);
    expect(report.completionRate).toBe(1);
    expect(report.averageRounds).toBeGreaterThan(1);
    expect(report.averagePurchases).toBeGreaterThan(4);
    expect(report.maximumWinnerShare).toBeLessThan(0.7);
  });
});
