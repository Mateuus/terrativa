import {
  type BoardSceneDefinition,
  baixadaSantistaScene,
  createDefaultBoardScene,
  type SceneAssetId,
  sceneAssetCatalog,
  validateBoardScene,
} from "@terrativa/board-content";

export type WorldTemplate = "coastal" | "island" | "flat";
export type WorldStatus = "draft" | "published";
export type TravelMode = "walk" | "car" | "boat";
export type WaterBodyKind = "lake" | "river";
export type VehicleAssetId = "sedan" | "taxi" | "suv" | "van" | "ambulance";
export type WorldAssetKind = "model" | "texture" | "audio" | "script" | "data";
export type WorldAssetSource = "bundled" | "uploaded" | "project";
export type StaticMeshCollision = "none" | "box" | "mesh";

export interface WorldStaticMeshMaterialOverride {
  readonly baseColor: string;
  readonly metallic: number;
  readonly roughness: number;
  readonly emissiveColor: string;
  readonly baseColorTextureUrl: string;
}

export interface WorldStaticMeshSettings {
  readonly collision: StaticMeshCollision;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  readonly materialOverride?: WorldStaticMeshMaterialOverride;
}

export interface WorldContentFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

export interface WorldOutlinerFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

export interface WorldContentAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: WorldAssetKind;
  readonly folderId: string;
  readonly source: WorldAssetSource;
  readonly url: string;
  readonly mimeType: string;
  readonly size: number;
  readonly license: string;
  readonly provider: string;
  readonly defaultScale: number;
  readonly modelType?: "static-mesh";
  readonly staticMesh?: WorldStaticMeshSettings;
  readonly catalogRef?:
    | { readonly type: "scene"; readonly id: SceneAssetId }
    | { readonly type: "vehicle"; readonly id: VehicleAssetId };
}

export interface WorldScript {
  readonly id: string;
  readonly name: string;
  readonly folderId: string;
  readonly enabled: boolean;
  readonly source: string;
}

export interface WorldPlacedObject {
  readonly id: string;
  readonly name: string;
  readonly assetId: string;
  readonly objectType: "static-mesh";
  readonly mobility: "static";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly scale: number;
}

export interface WorldServerConfig {
  readonly protocolVersion: 1;
  readonly authority: "server";
  readonly roomType: "terrativa-world";
  readonly maxPlayers: number;
  readonly tickRate: number;
  readonly region: "auto" | "sa-east";
  readonly sharding: "room";
  readonly scriptRuntime: "sandbox-required";
}

export interface TerrainSettings {
  readonly shape: "island" | "plateau";
  readonly size: number;
  readonly elevation: number;
  readonly roughness: number;
  readonly waterLevel: number;
  readonly seed: number;
  readonly groundColor: string;
  readonly waterColor: string;
  readonly skyColor: string;
  readonly sunIntensity: number;
}

export interface WorldLandscape {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly resolution: number;
  readonly heightData: readonly number[];
  readonly visible: boolean;
}

export interface WorldWaterBody {
  readonly id: string;
  readonly name: string;
  readonly kind: WaterBodyKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly length: number;
  readonly rotationY: number;
  readonly color: string;
}

export interface WorldRoute {
  readonly id: string;
  readonly fromPosition: number;
  readonly toPosition: number;
  readonly mode: TravelMode;
  readonly speed: number;
  readonly vehicleAssetId?: VehicleAssetId;
}

export interface WorldVehicle {
  readonly id: string;
  readonly assetId: VehicleAssetId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly scale: number;
}

export interface StudioWorld {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly status: WorldStatus;
  readonly template: WorldTemplate;
  readonly terrain: TerrainSettings;
  readonly landscape: WorldLandscape | null;
  readonly waterBodies: readonly WorldWaterBody[];
  readonly routes: readonly WorldRoute[];
  readonly vehicles: readonly WorldVehicle[];
  readonly objects: readonly WorldPlacedObject[];
  readonly outlinerFolders: readonly WorldOutlinerFolder[];
  readonly outlinerAssignments: Readonly<Record<string, string>>;
  readonly contentFolders: readonly WorldContentFolder[];
  readonly contentAssets: readonly WorldContentAsset[];
  readonly scripts: readonly WorldScript[];
  readonly server: WorldServerConfig;
  readonly scene: BoardSceneDefinition;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewWorldInput {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly template: WorldTemplate;
  readonly tileCount: number;
}

export interface VehicleAssetDefinition {
  readonly id: VehicleAssetId;
  readonly label: string;
  readonly file: string;
  readonly root: string;
  readonly defaultScale: number;
  readonly color: string;
}

const STORAGE_KEY = "terrativa.admin.worlds.v2";
const vehicleRoot = "/assets/vendor/kenney/car-kit/3.1/";

export const WORLD_CONTENT_ROOT_ID = "content";
export const ENGINE_CONTENT_ROOT_ID = "engine";

export const vehicleAssetCatalog = Object.freeze([
  vehicle("sedan", "Sedan", "sedan.glb", "#5B9FC7"),
  vehicle("taxi", "Táxi", "taxi.glb", "#F2B84B"),
  vehicle("suv", "SUV", "suv.glb", "#D86F55"),
  vehicle("van", "Van", "van.glb", "#75C7B5"),
  vehicle("ambulance", "Ambulância", "ambulance.glb", "#E5E8E4"),
] satisfies readonly VehicleAssetDefinition[]);

export function createInitialWorld(): StudioWorld {
  const now = new Date().toISOString();
  const terrain = terrainForTemplate("coastal", 1946);
  return {
    id: "world-baixada-santista",
    name: "Baixada Santista",
    slug: "baixada-santista",
    description: "Mundo oficial costeiro da Terrativa.",
    status: "published",
    template: "coastal",
    terrain,
    landscape: createDefaultLandscape(terrain.size, "Landscape Baixada Santista"),
    waterBodies: [],
    routes: createRoutes(baixadaSantistaScene),
    vehicles: [],
    objects: [],
    outlinerFolders: [],
    outlinerAssignments: {},
    contentFolders: createDefaultFolders(),
    contentAssets: createBundledAssets(),
    scripts: [createElevatorScript()],
    server: createDefaultServerConfig(),
    scene: structuredClone(baixadaSantistaScene),
    createdAt: now,
    updatedAt: now,
  };
}

export function createWorld(input: NewWorldInput): StudioWorld {
  const now = new Date().toISOString();
  const terrain = terrainForTemplate(input.template, Math.floor(Math.random() * 9_000) + 1_000);
  const base = createDefaultBoardScene(input.slug, input.tileCount);
  const scene: BoardSceneDefinition =
    input.template === "coastal"
      ? {
          ...structuredClone(baixadaSantistaScene),
          boardSlug: input.slug,
          name: input.name,
          tiles: base.tiles,
        }
      : {
          ...base,
          name: input.name,
          props: [],
          surface: {
            ...base.surface,
            baseColor: input.template === "island" ? "#D7C79F" : "#BCC9B8",
            edgeColor: input.template === "island" ? "#655A48" : "#344D45",
          },
        };
  return {
    id: `world-${input.slug}-${Date.now().toString(36)}`,
    name: input.name,
    slug: input.slug,
    description: input.description,
    status: "draft",
    template: input.template,
    terrain,
    landscape: createDefaultLandscape(terrain.size),
    waterBodies: [],
    routes: createRoutes(scene),
    vehicles: [],
    objects: [],
    outlinerFolders: [],
    outlinerAssignments: {},
    contentFolders: createDefaultFolders(),
    contentAssets: createBundledAssets(),
    scripts: [createElevatorScript()],
    server: createDefaultServerConfig(),
    scene: validateBoardScene(scene),
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateWorld(source: StudioWorld): StudioWorld {
  const suffix = Date.now().toString(36);
  const slug = `${source.slug}-copia-${suffix.slice(-4)}`;
  const now = new Date().toISOString();
  return {
    ...structuredClone(source),
    id: `world-${slug}`,
    name: `${source.name} — cópia`,
    slug,
    status: "draft",
    scene: { ...structuredClone(source.scene), boardSlug: slug, name: `${source.name} — cópia` },
    createdAt: now,
    updatedAt: now,
  };
}

export function loadWorlds(): StudioWorld[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [createInitialWorld()];
    const worlds = JSON.parse(stored) as unknown;
    if (!Array.isArray(worlds) || worlds.length === 0) return [createInitialWorld()];
    return worlds.map(parseStudioWorld);
  } catch {
    return [createInitialWorld()];
  }
}

export function saveWorlds(worlds: readonly StudioWorld[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(worlds));
}

export function touchWorld(world: StudioWorld, patch: Partial<StudioWorld>): StudioWorld {
  return { ...world, ...patch, updatedAt: new Date().toISOString() };
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isEngineContentFolder(folderId: string): boolean {
  return folderId === ENGINE_CONTENT_ROOT_ID || folderId.startsWith("engine-");
}

export function createDefaultStaticMeshSettings(): WorldStaticMeshSettings {
  return {
    collision: "box",
    castShadow: true,
    receiveShadow: true,
  };
}

export function getVehicleAsset(id: VehicleAssetId): VehicleAssetDefinition {
  const asset = vehicleAssetCatalog.find((candidate) => candidate.id === id);
  if (!asset) throw new Error(`Veículo desconhecido: ${id}`);
  return asset;
}

export function createDefaultLandscape(size = 48, name = "Landscape"): WorldLandscape {
  const resolution = 32;
  return {
    id: "landscape-main",
    name,
    width: size,
    depth: size,
    resolution,
    heightData: new Array((resolution + 1) ** 2).fill(0),
    visible: true,
  };
}

function terrainForTemplate(template: WorldTemplate, seed: number): TerrainSettings {
  if (template === "flat") {
    return {
      shape: "plateau",
      size: 42,
      elevation: 0.7,
      roughness: 0.08,
      waterLevel: -1.5,
      seed,
      groundColor: "#799276",
      waterColor: "#277D8C",
      skyColor: "#B8DAE1",
      sunIntensity: 1.15,
    };
  }
  return {
    shape: "island",
    size: template === "coastal" ? 48 : 38,
    elevation: template === "coastal" ? 2.2 : 3.4,
    roughness: template === "coastal" ? 0.42 : 0.66,
    waterLevel: -0.72,
    seed,
    groundColor: template === "coastal" ? "#A9A67A" : "#7F9B70",
    waterColor: "#147F91",
    skyColor: "#9FD4DD",
    sunIntensity: 1.3,
  };
}

function normalizeLandscape(
  candidate: WorldLandscape | null | undefined,
  fallbackSize: number,
): WorldLandscape | null {
  if (candidate === null) return null;
  if (!candidate || typeof candidate !== "object") return createDefaultLandscape(fallbackSize);
  const resolution = Math.min(64, Math.max(8, Math.round(candidate.resolution || 32)));
  const expectedLength = (resolution + 1) ** 2;
  const heightData =
    Array.isArray(candidate.heightData) && candidate.heightData.length === expectedLength
      ? candidate.heightData.map((height) =>
          typeof height === "number" && Number.isFinite(height) ? height : 0,
        )
      : new Array(expectedLength).fill(0);
  return {
    id: typeof candidate.id === "string" ? candidate.id : "landscape-main",
    name: typeof candidate.name === "string" ? candidate.name : "Landscape",
    width:
      typeof candidate.width === "number" && candidate.width > 0 ? candidate.width : fallbackSize,
    depth:
      typeof candidate.depth === "number" && candidate.depth > 0 ? candidate.depth : fallbackSize,
    resolution,
    heightData,
    visible: candidate.visible !== false,
  };
}

export function parseStudioWorld(candidate: unknown): StudioWorld {
  if (!candidate || typeof candidate !== "object") throw new Error("Mundo inválido");
  const world = candidate as Partial<StudioWorld>;
  if (
    typeof world.id !== "string" ||
    typeof world.name !== "string" ||
    typeof world.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(world.slug) ||
    !world.scene
  ) {
    throw new Error("O arquivo não contém um mundo Terrativa válido.");
  }
  const template: WorldTemplate =
    world.template === "flat" || world.template === "island" || world.template === "coastal"
      ? world.template
      : "coastal";
  const now = new Date().toISOString();
  const terrain = {
    ...terrainForTemplate(template, world.terrain?.seed ?? 1946),
    ...world.terrain,
  };
  const outlinerFolders = normalizeOutlinerFolders(world.outlinerFolders);
  return {
    id: world.id,
    name: world.name,
    slug: world.slug,
    description: typeof world.description === "string" ? world.description : "",
    status: world.status === "published" ? "published" : "draft",
    template,
    terrain,
    landscape: normalizeLandscape(world.landscape, terrain.size),
    waterBodies: Array.isArray(world.waterBodies) ? world.waterBodies : [],
    routes:
      Array.isArray(world.routes) && world.routes.length > 0
        ? world.routes
        : createRoutes(world.scene),
    vehicles: Array.isArray(world.vehicles) ? world.vehicles : [],
    objects: Array.isArray(world.objects)
      ? world.objects.map((object) => ({
          ...object,
          objectType: "static-mesh" as const,
          mobility: "static" as const,
        }))
      : [],
    outlinerFolders,
    outlinerAssignments: normalizeOutlinerAssignments(world.outlinerAssignments, outlinerFolders),
    contentFolders: normalizeContentFolders(world.contentFolders),
    contentAssets: normalizeContentAssets(world.contentAssets),
    scripts: normalizeScripts(world.scripts),
    server: { ...createDefaultServerConfig(), ...world.server },
    scene: validateBoardScene(world.scene),
    createdAt: typeof world.createdAt === "string" ? world.createdAt : now,
    updatedAt: typeof world.updatedAt === "string" ? world.updatedAt : now,
  };
}

function normalizeOutlinerFolders(
  folders: readonly WorldOutlinerFolder[] | undefined,
): WorldOutlinerFolder[] {
  if (!Array.isArray(folders)) return [];
  const unique = new Map<string, WorldOutlinerFolder>();
  for (const folder of folders) {
    if (
      !folder ||
      typeof folder.id !== "string" ||
      !folder.id ||
      typeof folder.name !== "string" ||
      !folder.name.trim() ||
      unique.has(folder.id)
    ) {
      continue;
    }
    unique.set(folder.id, {
      id: folder.id,
      name: folder.name.trim(),
      parentId: typeof folder.parentId === "string" ? folder.parentId : null,
    });
  }

  const ids = new Set(unique.keys());
  const normalized = [...unique.values()].map((folder) => ({
    ...folder,
    parentId:
      folder.parentId && folder.parentId !== folder.id && ids.has(folder.parentId)
        ? folder.parentId
        : null,
  }));
  const byId = new Map(normalized.map((folder) => [folder.id, folder]));
  return normalized.map((folder) => {
    const visited = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId) {
      if (visited.has(parentId)) return { ...folder, parentId: null };
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return folder;
  });
}

function normalizeOutlinerAssignments(
  assignments: Readonly<Record<string, string>> | undefined,
  folders: readonly WorldOutlinerFolder[],
): Record<string, string> {
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) return {};
  const folderIds = new Set(folders.map((folder) => folder.id));
  return Object.fromEntries(
    Object.entries(assignments).filter(
      ([actorId, folderId]) =>
        actorId.length > 0 && typeof folderId === "string" && folderIds.has(folderId),
    ),
  );
}

function createRoutes(scene: BoardSceneDefinition): WorldRoute[] {
  return scene.tiles.map((tile, index) => ({
    id: `route-${tile.position}-${scene.tiles[(index + 1) % scene.tiles.length]?.position ?? 0}`,
    fromPosition: tile.position,
    toPosition: scene.tiles[(index + 1) % scene.tiles.length]?.position ?? 0,
    mode: "walk",
    speed: 1.8,
  }));
}

export function createWorldPackage(world: StudioWorld) {
  return {
    schemaVersion: 3 as const,
    generatedAt: new Date().toISOString(),
    world,
    serverManifest: {
      ...world.server,
      worldId: world.id,
      boardSlug: world.slug,
      stateSchema: "terrativa.world-state.v1",
      routes: world.routes.length,
      landscape: world.landscape
        ? {
            id: world.landscape.id,
            width: world.landscape.width,
            depth: world.landscape.depth,
            resolution: world.landscape.resolution,
            vertices: world.landscape.heightData.length,
          }
        : null,
      assets: world.contentAssets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        modelType: asset.modelType,
        url: asset.url,
        license: asset.license,
        staticMesh: asset.staticMesh,
      })),
      scripts: world.scripts
        .filter((script) => script.enabled)
        .map((script) => ({
          id: script.id,
          name: script.name,
          execution: "sandbox-required" as const,
        })),
    },
  };
}

export function createScript(name: string, folderId = "scripts"): WorldScript {
  const base = slugify(name.replace(/\.js$/i, "")) || "script";
  return {
    id: `script-${base}-${Date.now().toString(36)}`,
    name: `${base}.js`,
    folderId,
    enabled: false,
    source: `// API segura do Terrativa World Runtime\nexport function onStart(context) {\n  context.log("Script ${base} iniciado");\n}\n\nexport function onInteract(context, actor) {\n  // Use context.world, context.events e context.timers.\n}\n`,
  };
}

export function createFolder(
  name: string,
  parentId: string | null = WORLD_CONTENT_ROOT_ID,
): WorldContentFolder {
  const base = slugify(name) || "pasta";
  return {
    id: `folder-${base}-${Date.now().toString(36)}`,
    name: name.trim() || "Nova pasta",
    parentId,
  };
}

export function createOutlinerFolder(
  name: string,
  parentId: string | null = null,
): WorldOutlinerFolder {
  const base = slugify(name) || "pasta";
  return {
    id: `outliner-${base}-${Date.now().toString(36)}`,
    name: name.trim() || "Nova pasta",
    parentId,
  };
}

function createDefaultFolders(): WorldContentFolder[] {
  return [
    { id: "content", name: "Conteúdo", parentId: null },
    { id: "environment", name: "Ambiente", parentId: "content" },
    { id: "buildings", name: "Construções", parentId: "content" },
    { id: "vehicles", name: "Veículos", parentId: "content" },
    { id: "characters", name: "Personagens", parentId: "content" },
    { id: "audio", name: "Áudio", parentId: "content" },
    { id: "textures", name: "Texturas", parentId: "content" },
    { id: "scripts", name: "Scripts", parentId: "content" },
    { id: "uploads", name: "Importados", parentId: "content" },
    { id: ENGINE_CONTENT_ROOT_ID, name: "Engine", parentId: null },
    { id: "engine-environment", name: "Ambiente", parentId: ENGINE_CONTENT_ROOT_ID },
    { id: "engine-buildings", name: "Construções", parentId: ENGINE_CONTENT_ROOT_ID },
    { id: "engine-vehicles", name: "Veículos", parentId: ENGINE_CONTENT_ROOT_ID },
    { id: "engine-characters", name: "Personagens", parentId: ENGINE_CONTENT_ROOT_ID },
    { id: "engine-audio", name: "Áudio", parentId: ENGINE_CONTENT_ROOT_ID },
    { id: "engine-textures", name: "Texturas", parentId: ENGINE_CONTENT_ROOT_ID },
    { id: "engine-scripts", name: "Scripts", parentId: ENGINE_CONTENT_ROOT_ID },
  ];
}

function normalizeContentFolders(
  folders: readonly WorldContentFolder[] | undefined,
): WorldContentFolder[] {
  const defaults = createDefaultFolders();
  if (!Array.isArray(folders)) return defaults;
  const reservedIds = new Set(defaults.map((folder) => folder.id));
  const customFolders = folders
    .filter(
      (folder) =>
        folder &&
        typeof folder.id === "string" &&
        typeof folder.name === "string" &&
        !reservedIds.has(folder.id),
    )
    .map((folder) => ({
      ...folder,
      parentId:
        typeof folder.parentId === "string" && !isEngineContentFolder(folder.parentId)
          ? folder.parentId
          : WORLD_CONTENT_ROOT_ID,
    }));
  return [...defaults, ...customFolders];
}

function normalizeContentAssets(
  assets: readonly WorldContentAsset[] | undefined,
): WorldContentAsset[] {
  const bundledAssets = createBundledAssets();
  if (!Array.isArray(assets)) return bundledAssets;
  const bundledIds = new Set(bundledAssets.map((asset) => asset.id));
  const worldAssets = assets
    .filter((asset) => asset?.source !== "bundled" && !bundledIds.has(asset?.id))
    .map((asset) => ({
      ...asset,
      folderId:
        typeof asset.folderId === "string" && !isEngineContentFolder(asset.folderId)
          ? asset.folderId
          : "uploads",
      defaultScale:
        typeof asset.defaultScale === "number" && Number.isFinite(asset.defaultScale)
          ? asset.defaultScale
          : 1,
      ...(asset.kind === "model"
        ? {
            modelType: "static-mesh" as const,
            staticMesh: asset.staticMesh ?? createDefaultStaticMeshSettings(),
          }
        : {}),
    }));
  return [...bundledAssets, ...worldAssets];
}

function normalizeScripts(scripts: readonly WorldScript[] | undefined): WorldScript[] {
  const bundledScript = createElevatorScript();
  if (!Array.isArray(scripts)) return [bundledScript];
  const worldScripts = scripts
    .filter((script) => script?.id !== bundledScript.id)
    .map((script) => ({
      ...script,
      folderId:
        typeof script.folderId === "string" && !isEngineContentFolder(script.folderId)
          ? script.folderId
          : "scripts",
    }));
  return [bundledScript, ...worldScripts];
}

function createBundledAssets(): WorldContentAsset[] {
  const sceneAssets = sceneAssetCatalog.map(
    (asset): WorldContentAsset => ({
      id: `builtin-scene-${asset.id}`,
      name: asset.label,
      kind: "model",
      folderId: asset.category === "Construções" ? "engine-buildings" : "engine-environment",
      source: "bundled",
      url: `${asset.root}${asset.file}`,
      mimeType: "model/gltf-binary",
      size: 0,
      license: "CC0-1.0",
      provider: "Kenney",
      defaultScale: asset.defaultScale,
      modelType: "static-mesh",
      staticMesh: createDefaultStaticMeshSettings(),
      catalogRef: { type: "scene", id: asset.id },
    }),
  );
  const vehicles = vehicleAssetCatalog.map(
    (asset): WorldContentAsset => ({
      id: `builtin-vehicle-${asset.id}`,
      name: asset.label,
      kind: "model",
      folderId: "engine-vehicles",
      source: "bundled",
      url: `${asset.root}${asset.file}`,
      mimeType: "model/gltf-binary",
      size: 0,
      license: "CC0-1.0",
      provider: "Kenney",
      defaultScale: asset.defaultScale,
      modelType: "static-mesh",
      staticMesh: createDefaultStaticMeshSettings(),
      catalogRef: { type: "vehicle", id: asset.id },
    }),
  );
  const quaterniusRoot = "/assets/vendor/quaternius/ultimate-modular-men/2022-02/";
  const quaterniusCharacters = [
    ["adventurer.gltf", "Aventureiro"],
    ["beach.gltf", "Praia"],
    ["casual-2.gltf", "Casual"],
    ["casual-hoodie.gltf", "Moletom"],
    ["farmer.gltf", "Fazendeiro"],
    ["king.gltf", "Rei"],
    ["punk.gltf", "Punk"],
    ["spacesuit.gltf", "Astronauta"],
    ["suit.gltf", "Executivo"],
    ["swat.gltf", "Agente"],
    ["worker.gltf", "Trabalhador"],
  ] as const;
  const characters = quaterniusCharacters.map(
    ([file, label], index): WorldContentAsset => ({
      id: `builtin-quaternius-men-${String(index + 1).padStart(2, "0")}`,
      name: label,
      kind: "model",
      folderId: "engine-characters",
      source: "bundled",
      url: `${quaterniusRoot}${file}`,
      mimeType: "model/gltf+json",
      size: 0,
      license: "CC0-1.0",
      provider: "Quaternius",
      defaultScale: 0.32,
      modelType: "static-mesh",
      staticMesh: createDefaultStaticMeshSettings(),
    }),
  );
  return [...sceneAssets, ...vehicles, ...characters];
}

function createElevatorScript(): WorldScript {
  return {
    id: "script-elevador-exemplo",
    name: "elevador-exemplo.js",
    folderId: "engine-scripts",
    enabled: false,
    source:
      '// Exemplo desativado: executado apenas no sandbox do servidor.\nexport function onInteract(context, actor) {\n  const destino = context.object.getNumber("andarDestino", 4);\n  context.motion.moveTo(context.object.id, { y: destino }, { duration: 2.5 });\n  context.events.emit("elevador:movendo", { actorId: actor.id, destino });\n}\n',
  };
}

function createDefaultServerConfig(): WorldServerConfig {
  return {
    protocolVersion: 1,
    authority: "server",
    roomType: "terrativa-world",
    maxPlayers: 6,
    tickRate: 20,
    region: "auto",
    sharding: "room",
    scriptRuntime: "sandbox-required",
  };
}

function vehicle(
  id: VehicleAssetId,
  label: string,
  file: string,
  color: string,
): VehicleAssetDefinition {
  return { id, label, file, root: vehicleRoot, defaultScale: 0.72, color };
}
