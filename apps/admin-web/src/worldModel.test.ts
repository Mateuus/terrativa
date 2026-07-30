// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  createInitialWorld,
  createWorld,
  createWorldPackage,
  duplicateWorld,
  loadWorlds,
  parseStudioWorld,
  saveWorlds,
  slugify,
  vehicleAssetCatalog,
} from "./worldModel";

describe("catálogo de mundos do Admin", () => {
  beforeEach(() => window.localStorage.clear());

  it("inicia com o mundo oficial e uma rota para cada trecho", () => {
    const world = createInitialWorld();
    expect(world.slug).toBe("baixada-santista");
    expect(world.scene.tiles).toHaveLength(36);
    expect(world.routes).toHaveLength(36);
    expect(world.landscape?.heightData).toHaveLength(33 ** 2);
    expect(world.routes[0]).toMatchObject({
      fromPosition: 0,
      toPosition: 1,
      mode: "walk",
    });
  });

  it("cria uma ilha vazia com quantidade configurável de pontos", () => {
    const world = createWorld({
      name: "Costa Verde",
      slug: "costa-verde",
      description: "Mundo de teste",
      template: "island",
      tileCount: 24,
    });
    expect(world.scene.tiles).toHaveLength(24);
    expect(world.scene.props).toHaveLength(0);
    expect(world.routes).toHaveLength(24);
    expect(world.waterBodies).toEqual([]);
    expect(world.vehicles).toEqual([]);
  });

  it("persiste, duplica e normaliza nomes de mundos", () => {
    const original = createInitialWorld();
    saveWorlds([original]);
    expect(loadWorlds()[0]?.id).toBe(original.id);
    expect(duplicateWorld(original).slug).toContain("baixada-santista-copia");
    expect(slugify("São Vicente 3D")).toBe("sao-vicente-3d");
  });

  it("disponibiliza veículos CC0 para rotas automáticas", () => {
    expect(vehicleAssetCatalog.map((asset) => asset.id)).toEqual([
      "sedan",
      "taxi",
      "suv",
      "van",
      "ambulance",
    ]);
  });

  it("importa o pacote 3D completo sem perder água, rotas ou veículos", () => {
    const original = createInitialWorld();
    const imported = parseStudioWorld({
      ...original,
      waterBodies: [
        {
          id: "rio-1",
          name: "Rio do teste",
          kind: "river",
          x: 1,
          y: 0.5,
          z: 2,
          width: 2,
          length: 8,
          rotationY: 0,
          color: "#208FA3",
        },
      ],
      routes: [{ ...original.routes[0], mode: "car", vehicleAssetId: "taxi" }],
      vehicles: [
        {
          id: "taxi-1",
          assetId: "taxi",
          name: "Táxi",
          x: 0,
          y: 0.6,
          z: 0,
          rotationY: 0,
          scale: 0.72,
        },
      ],
    });

    expect(imported.waterBodies[0]?.kind).toBe("river");
    expect(imported.routes[0]).toMatchObject({ mode: "car", vehicleAssetId: "taxi" });
    expect(imported.vehicles[0]?.assetId).toBe("taxi");
  });

  it("gera manifesto multiserver e biblioteca organizada por pastas", () => {
    const world = createInitialWorld();
    const worldPackage = createWorldPackage(world);

    expect(world.contentFolders.map((folder) => folder.id)).toContain("scripts");
    expect(world.contentFolders.map((folder) => folder.id)).toContain("engine");
    expect(
      world.contentAssets
        .filter((asset) => asset.source === "bundled")
        .every((asset) => asset.folderId.startsWith("engine-")),
    ).toBe(true);
    expect(
      world.contentAssets
        .filter((asset) => asset.kind === "model")
        .every(
          (asset) =>
            asset.modelType === "static-mesh" &&
            asset.staticMesh?.collision === "box" &&
            asset.staticMesh.castShadow,
        ),
    ).toBe(true);
    expect(world.scripts.find((script) => script.id === "script-elevador-exemplo")?.folderId).toBe(
      "engine-scripts",
    );
    expect(world.contentAssets.some((asset) => asset.provider === "Kenney")).toBe(true);
    expect(worldPackage).toMatchObject({
      schemaVersion: 3,
      serverManifest: {
        authority: "server",
        roomType: "terrativa-world",
        boardSlug: "baixada-santista",
        scriptRuntime: "sandbox-required",
        landscape: {
          resolution: 32,
          vertices: 33 ** 2,
        },
      },
    });
    expect(
      worldPackage.serverManifest.assets.find((asset) => asset.kind === "model"),
    ).toMatchObject({
      modelType: "static-mesh",
      staticMesh: {
        collision: "box",
        castShadow: true,
        receiveShadow: true,
      },
    });
  });

  it("migra projetos antigos separando assets da Engine do Conteúdo do mundo", () => {
    const current = createInitialWorld();
    const migrated = parseStudioWorld({
      ...current,
      contentFolders: current.contentFolders.filter(
        (folder) => folder.id !== "engine" && !folder.id.startsWith("engine-"),
      ),
      contentAssets: [
        ...current.contentAssets.map((asset) => ({
          ...asset,
          folderId: asset.folderId.replace(/^engine-/, ""),
        })),
        {
          id: "upload-casa",
          name: "Casa do jogador",
          kind: "model",
          folderId: "buildings",
          source: "uploaded",
          url: "/uploads/casa.glb",
          mimeType: "model/gltf-binary",
          size: 120,
          license: "Autor",
          provider: "Upload",
          defaultScale: 1,
        },
      ],
    });

    expect(migrated.contentFolders.some((folder) => folder.id === "engine")).toBe(true);
    expect(
      migrated.contentAssets
        .filter((asset) => asset.source === "bundled")
        .every((asset) => asset.folderId.startsWith("engine-")),
    ).toBe(true);
    expect(migrated.contentAssets.find((asset) => asset.id === "upload-casa")?.folderId).toBe(
      "buildings",
    );
    expect(migrated.contentAssets.find((asset) => asset.id === "upload-casa")).toMatchObject({
      modelType: "static-mesh",
      staticMesh: {
        collision: "box",
        castShadow: true,
        receiveShadow: true,
      },
    });
  });

  it("cria um Landscape ao importar mundos antigos sem dados de escultura", () => {
    const { landscape: _landscape, ...legacyWorld } = createInitialWorld();
    const migrated = parseStudioWorld(legacyWorld);

    expect(migrated.landscape).toMatchObject({
      id: "landscape-main",
      width: migrated.terrain.size,
      depth: migrated.terrain.size,
      resolution: 32,
    });
    expect(migrated.landscape?.heightData).toHaveLength(33 ** 2);
  });

  it("persiste pastas e corrige referências inválidas do Organizador", () => {
    const current = createInitialWorld();
    const migrated = parseStudioWorld({
      ...current,
      outlinerFolders: [
        { id: "gameplay", name: " Gameplay ", parentId: null },
        { id: "interacoes", name: "Interações", parentId: "gameplay" },
        { id: "ciclo-a", name: "Ciclo A", parentId: "ciclo-b" },
        { id: "ciclo-b", name: "Ciclo B", parentId: "ciclo-a" },
      ],
      outlinerAssignments: {
        "tile:0": "interacoes",
        "tile:1": "pasta-inexistente",
      },
    });

    expect(migrated.outlinerFolders.find((folder) => folder.id === "gameplay")).toMatchObject({
      name: "Gameplay",
      parentId: null,
    });
    expect(migrated.outlinerFolders.find((folder) => folder.id === "interacoes")?.parentId).toBe(
      "gameplay",
    );
    expect(
      migrated.outlinerFolders
        .filter((folder) => folder.id.startsWith("ciclo-"))
        .some((folder) => folder.parentId === null),
    ).toBe(true);
    expect(migrated.outlinerAssignments).toEqual({ "tile:0": "interacoes" });
  });
});
