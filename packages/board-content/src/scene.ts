import { z } from "zod";
import generatedBaixadaSantistaScene from "./baixadaSantistaScene.data.js";

const hexColorSchema = z.string().regex(/^#[0-9A-F]{6}$/i);
const finiteSceneNumber = z.number().min(-100).max(100);

export const sceneAssetIdSchema = z.enum([
  "kenney-structure",
  "kenney-structure-roof",
  "kenney-tower-small",
  "kenney-tower-large",
  "kenney-tower-watch",
  "kenney-castle-gate",
  "kenney-castle-wall",
  "kenney-palm-bend",
  "kenney-palm-straight",
  "kenney-rocks-a",
  "kenney-rocks-b",
  "kenney-rocks-c",
  "kenney-dock",
  "kenney-boat",
]);

export const boardSceneTileSchema = z
  .object({
    position: z.int().min(0).max(119),
    x: finiteSceneNumber,
    z: finiteSceneNumber,
    rotationY: z
      .number()
      .min(-Math.PI * 2)
      .max(Math.PI * 2),
    scale: z.number().min(0.35).max(3),
  })
  .strict();

export const boardScenePropSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    assetId: sceneAssetIdSchema,
    x: finiteSceneNumber,
    y: z.number().min(-10).max(30),
    z: finiteSceneNumber,
    rotationY: z
      .number()
      .min(-Math.PI * 2)
      .max(Math.PI * 2),
    scale: z.number().min(0.02).max(12),
  })
  .strict();

export const boardSceneSchema = z
  .object({
    schemaVersion: z.literal(1),
    boardSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(2).max(120),
    surface: z
      .object({
        width: z.number().min(8).max(80),
        depth: z.number().min(8).max(80),
        baseColor: hexColorSchema,
        edgeColor: hexColorSchema,
      })
      .strict(),
    tiles: z.array(boardSceneTileSchema).min(4).max(120),
    props: z.array(boardScenePropSchema).max(500),
  })
  .strict()
  .superRefine((scene, context) => {
    const positions = scene.tiles.map((tile) => tile.position);
    if (new Set(positions).size !== positions.length) {
      context.addIssue({ code: "custom", message: "há posições de casas duplicadas" });
    }
    const propIds = scene.props.map((prop) => prop.id);
    if (new Set(propIds).size !== propIds.length) {
      context.addIssue({ code: "custom", message: "há IDs de objetos duplicados" });
    }
  });

export type SceneAssetId = z.infer<typeof sceneAssetIdSchema>;
export type BoardSceneTile = z.infer<typeof boardSceneTileSchema>;
export type BoardSceneProp = z.infer<typeof boardScenePropSchema>;
export type BoardSceneDefinition = z.infer<typeof boardSceneSchema>;

export interface SceneAssetDefinition {
  readonly id: SceneAssetId;
  readonly label: string;
  readonly category: "Construções" | "Cenário";
  readonly file: string;
  readonly root: string;
  readonly defaultScale: number;
  readonly swatch: string;
}

const kenneyRoot = "/assets/vendor/kenney/pirate-kit/2.1/";

export const sceneAssetCatalog = Object.freeze([
  asset("kenney-structure", "Casa costeira", "Construções", "structure.glb", 0.22, "#D98762"),
  asset(
    "kenney-structure-roof",
    "Telhado modular",
    "Construções",
    "structure-roof.glb",
    0.22,
    "#A94F42",
  ),
  asset(
    "kenney-tower-small",
    "Edifício pequeno",
    "Construções",
    "tower-complete-small.glb",
    0.18,
    "#E7B36A",
  ),
  asset(
    "kenney-tower-large",
    "Edifício alto",
    "Construções",
    "tower-complete-large.glb",
    0.2,
    "#D47558",
  ),
  asset("kenney-tower-watch", "Mirante", "Construções", "tower-watch.glb", 0.2, "#C9604F"),
  asset(
    "kenney-castle-gate",
    "Portal histórico",
    "Construções",
    "castle-gate.glb",
    0.17,
    "#B7725D",
  ),
  asset("kenney-castle-wall", "Muralha", "Construções", "castle-wall.glb", 0.18, "#C88468"),
  asset("kenney-palm-bend", "Palmeira curva", "Cenário", "palm-detailed-bend.glb", 1.55, "#48B982"),
  asset(
    "kenney-palm-straight",
    "Palmeira reta",
    "Cenário",
    "palm-detailed-straight.glb",
    1.45,
    "#55C78B",
  ),
  asset("kenney-rocks-a", "Rochas A", "Cenário", "rocks-sand-a.glb", 1.65, "#B98565"),
  asset("kenney-rocks-b", "Rochas B", "Cenário", "rocks-sand-b.glb", 1.5, "#A96F57"),
  asset("kenney-rocks-c", "Rochas C", "Cenário", "rocks-sand-c.glb", 1.65, "#C98966"),
  asset("kenney-dock", "Píer", "Cenário", "structure-platform-dock-small.glb", 1.55, "#A76346"),
  asset("kenney-boat", "Barco", "Cenário", "boat-row-small.glb", 1.7, "#80513E"),
] satisfies readonly SceneAssetDefinition[]);

const assetById = new Map(sceneAssetCatalog.map((item) => [item.id, item]));

export function getSceneAsset(assetId: SceneAssetId): SceneAssetDefinition {
  const definition = assetById.get(assetId);
  if (!definition) throw new Error(`Asset de cena desconhecido: ${assetId}`);
  return definition;
}

export function validateBoardScene(candidate: unknown): BoardSceneDefinition {
  return boardSceneSchema.parse(candidate);
}

export function createDefaultBoardScene(
  boardSlug: string,
  tileCount: number,
): BoardSceneDefinition {
  const halfSize = 6.35;
  const tiles = Array.from({ length: tileCount }, (_, position) => {
    const [x, z] = perimeterPosition(position, tileCount, halfSize);
    const next = perimeterPosition((position + 1) % tileCount, tileCount, halfSize);
    return {
      position,
      x,
      z,
      rotationY: Math.atan2(next[0] - x, next[1] - z),
      scale: 1,
    };
  });
  return validateBoardScene({
    schemaVersion: 1,
    boardSlug,
    name: "Orla da Baixada",
    surface: {
      width: 15.4,
      depth: 15.4,
      baseColor: "#D9D0B8",
      edgeColor: "#0C3440",
    },
    tiles,
    props: [
      prop("edificio-santos", "kenney-tower-large", -1.75, 0.68, 2.15, 0.12),
      prop("casa-sao-vicente", "kenney-structure", -0.45, 0.68, 2.35, -0.08),
      prop("mirante-guaruja", "kenney-tower-small", 1.35, 0.68, 2.05, 0.16),
      prop("portal-historico", "kenney-castle-gate", 2.45, 0.68, 0.95, -0.6),
      prop("palmeira-oeste", "kenney-palm-bend", -8.25, -0.14, -4.7, 0.76),
      prop("palmeira-leste", "kenney-palm-straight", 8.35, -0.14, 4.72, -0.64),
      prop("rochas-norte", "kenney-rocks-a", -3.2, -0.17, 8.35, 0.28),
      prop("rochas-oeste", "kenney-rocks-b", -8.65, -0.17, 2.7, -0.35),
      prop("rochas-leste", "kenney-rocks-c", 8.75, -0.17, -3.3, 0.7),
      prop("pier-sul", "kenney-dock", 8.45, -0.3, -7.15, -1.05),
      prop("barco-sul", "kenney-boat", 10.4, -0.42, -8.05, -0.25),
    ],
  });
}

const generatedScene: unknown = generatedBaixadaSantistaScene;
export const baixadaSantistaScene = Object.freeze(
  generatedScene === null
    ? createDefaultBoardScene("baixada-santista", 36)
    : validateBoardScene(generatedScene),
);

export function getBoardScene(boardSlug: string, tileCount: number): BoardSceneDefinition {
  return boardSlug === baixadaSantistaScene.boardSlug
    ? baixadaSantistaScene
    : createDefaultBoardScene(boardSlug, tileCount);
}

function asset(
  id: SceneAssetId,
  label: string,
  category: SceneAssetDefinition["category"],
  file: string,
  defaultScale: number,
  swatch: string,
): SceneAssetDefinition {
  return { id, label, category, file, root: kenneyRoot, defaultScale, swatch };
}

function prop(
  id: string,
  assetId: SceneAssetId,
  x: number,
  y: number,
  z: number,
  rotationY: number,
): BoardSceneProp {
  return {
    id,
    assetId,
    x,
    y,
    z,
    rotationY,
    scale: getSceneAsset(assetId).defaultScale,
  };
}

function perimeterPosition(index: number, count: number, halfSize: number): [number, number] {
  const perimeterProgress = (index / count) * 4;
  const segment = Math.floor(perimeterProgress);
  const progress = perimeterProgress - segment;
  const side = halfSize * 2;
  if (segment === 0) return [-halfSize + side * progress, -halfSize];
  if (segment === 1) return [halfSize, -halfSize + side * progress];
  if (segment === 2) return [halfSize - side * progress, halfSize];
  return [-halfSize, halfSize - side * progress];
}
