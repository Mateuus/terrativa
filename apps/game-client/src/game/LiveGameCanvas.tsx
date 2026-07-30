import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import "@babylonjs/core/Culling/ray.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Scene } from "@babylonjs/core/scene.js";
import {
  type BoardContent,
  type BoardSceneDefinition,
  getBoardScene,
  getSceneAsset,
} from "@terrativa/board-content";
import "@babylonjs/loaders/glTF/index.js";
import { useEffect, useRef } from "react";
import { characterAssetLocation } from "./characterAssets";
import { diceAsset } from "./environmentAssets";
import { playGameSound } from "./gameAudio";

export interface LivePlayerVisual {
  readonly id: string;
  readonly displayName: string;
  readonly pawnKey: string;
  readonly colorKey: string;
  readonly position: number;
  readonly status: "ACTIVE" | "BANKRUPT";
}

export interface LivePropertyVisual {
  readonly propertyId: string;
  readonly ownerPlayerId: string | null;
  readonly level: number;
  readonly mortgaged: boolean;
}

export interface LiveDiceVisual {
  readonly dieOne: number;
  readonly dieTwo: number;
  readonly sequence: number;
}

interface LiveGameCanvasProps {
  readonly board: BoardContent;
  readonly currentPlayerId: string | null;
  readonly dice: LiveDiceVisual | null;
  readonly onReady: () => void;
  readonly onTileSelect: (tileIndex: number) => void;
  readonly players: readonly LivePlayerVisual[];
  readonly properties: readonly LivePropertyVisual[];
  readonly selectedTileIndex: number;
}

interface PawnRig {
  readonly fallbackRoot: TransformNode;
  readonly leftArm: TransformNode;
  readonly leftLeg: TransformNode;
  readonly rightArm: TransformNode;
  readonly rightLeg: TransformNode;
}

interface PawnAnimationSet {
  readonly all: readonly AnimationGroup[];
  readonly idle: AnimationGroup | undefined;
  readonly walk: AnimationGroup | undefined;
  current: "idle" | "walk" | null;
}

const pawnColors: Readonly<Record<string, string>> = {
  ocean: "#25A8D6",
  mangrove: "#49B477",
  sun: "#F2B84B",
  coral: "#F08069",
  violet: "#8E72D8",
  sand: "#E8D5A9",
};

const pipLayouts: Readonly<Record<number, readonly [number, number][]>> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

const DICE_REST_Y = 1.45;
const CHARACTER_MODEL_FORWARD_OFFSET = Math.PI;

export function LiveGameCanvas({
  board,
  currentPlayerId,
  dice,
  onReady,
  onTileSelect,
  players,
  properties,
  selectedTileIndex,
}: LiveGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const tileMeshesRef = useRef<readonly Mesh[]>([]);
  const tileMaterialsRef = useRef<readonly StandardMaterial[]>([]);
  const tilePositionsRef = useRef<readonly [number, number][]>([]);
  const pawnRootsRef = useRef(new Map<string, TransformNode>());
  const pawnPathsRef = useRef(new Map<string, Vector3[]>());
  const pawnPositionsRef = useRef(new Map<string, number>());
  const pawnRigsRef = useRef(new Map<string, PawnRig>());
  const pawnAnimationsRef = useRef(new Map<string, PawnAnimationSet>());
  const propertyRootsRef = useRef<TransformNode[]>([]);
  const diceMeshesRef = useRef<readonly [TransformNode, TransformNode] | null>(null);
  const diceTargetRotationsRef = useRef<readonly [Vector3, Vector3]>([
    dieRotationForValue(1),
    dieRotationForValue(1),
  ]);
  const usingImportedDiceRef = useRef(false);
  const diceAnimationStartedAtRef = useRef(0);
  const lastStepSoundAtRef = useRef(0);
  const firstFrameRenderedRef = useRef(false);
  const pendingAssetCountRef = useRef(0);
  const readyEmittedRef = useRef(false);
  const signalReadyRef = useRef<() => void>(() => undefined);
  const onReadyRef = useRef(onReady);
  const onTileSelectRef = useRef(onTileSelect);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onTileSelectRef.current = onTileSelect;
  }, [onTileSelect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
    });
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.35));

    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#06171EFF");
    scene.ambientColor = Color3.FromHexString("#244C55");
    sceneRef.current = scene;
    firstFrameRenderedRef.current = false;
    readyEmittedRef.current = false;
    pendingAssetCountRef.current = 0;
    signalReadyRef.current = () => {
      if (
        !readyEmittedRef.current &&
        firstFrameRenderedRef.current &&
        pendingAssetCountRef.current === 0
      ) {
        readyEmittedRef.current = true;
        onReadyRef.current();
      }
    };
    const sceneDefinition = getBoardScene(board.slug, board.tileCount);

    const camera = new ArcRotateCamera(
      "live-game-camera",
      -Math.PI / 2.8,
      Math.PI / 3.35,
      18,
      new Vector3(0, 0.5, 0),
      scene,
    );
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 25;
    camera.lowerBetaLimit = 0.48;
    camera.upperBetaLimit = 1.32;
    camera.wheelPrecision = 28;
    camera.pinchPrecision = 65;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);

    const sky = new HemisphericLight("live-sky", new Vector3(0.1, 1, 0.2), scene);
    sky.intensity = 1.42;
    sky.groundColor = Color3.FromHexString("#123D49");
    const sun = new DirectionalLight("live-sun", new Vector3(-0.55, -1, 0.3), scene);
    sun.intensity = 2.2;

    const oceanMaterial = createMaterial(scene, "live-ocean", "#0A6179");
    oceanMaterial.emissiveColor = Color3.FromHexString("#063846");
    oceanMaterial.specularColor = Color3.FromHexString("#86DCE7").scale(0.55);
    const ocean = CreateGround("live-ocean", { width: 48, height: 48 }, scene);
    ocean.position.y = -0.48;
    ocean.material = oceanMaterial;
    const seaRipples = createSeaRipples(scene);
    createBeach(scene);

    const edgeMaterial = createMaterial(scene, "live-board-edge", "#0C3440");
    edgeMaterial.diffuseColor = Color3.FromHexString(sceneDefinition.surface.edgeColor);
    const base = CreateBox(
      "live-board-base",
      {
        width: sceneDefinition.surface.width,
        depth: sceneDefinition.surface.depth,
        height: 0.52,
      },
      scene,
    );
    base.position.y = -0.18;
    base.material = edgeMaterial;

    const surfaceMaterial = createMaterial(scene, "live-board-surface", "#D9D0B8");
    surfaceMaterial.diffuseColor = Color3.FromHexString(sceneDefinition.surface.baseColor);
    const surface = CreateBox(
      "live-board-surface",
      {
        width: sceneDefinition.surface.width - 0.7,
        depth: sceneDefinition.surface.depth - 0.7,
        height: 0.26,
      },
      scene,
    );
    surface.position.y = 0.22;
    surface.material = surfaceMaterial;

    const cityByKey = new Map(board.cities.map((city) => [city.key, city]));
    const positions = Array.from({ length: board.tileCount }, (_, index) => {
      const tile = sceneDefinition.tiles.find((candidate) => candidate.position === index);
      return [tile?.x ?? 0, tile?.z ?? 0] as [number, number];
    });
    const tileMaterials: StandardMaterial[] = [];
    const tileMeshes = board.tiles.map((tile, index) => {
      const city = cityByKey.get(tile.cityKey);
      const tileMaterial = createMaterial(
        scene,
        `live-tile-material-${index}`,
        city?.accentColor ?? "#64748B",
      );
      tileMaterials.push(tileMaterial);
      const isCorner = index % Math.max(1, Math.floor(board.tileCount / 4)) === 0;
      const mesh = CreateBox(
        `live-tile-${index}`,
        {
          width: isCorner ? 1.28 : 1.13,
          depth: isCorner ? 1.28 : 1.05,
          height: 0.2,
        },
        scene,
      );
      const [x, z] = positions[index] ?? [0, 0];
      mesh.position.set(x, 0.55, z);
      const sceneTile = sceneDefinition.tiles.find((candidate) => candidate.position === index);
      mesh.rotation.y = sceneTile?.rotationY ?? 0;
      mesh.scaling.x = sceneTile?.scale ?? 1;
      mesh.scaling.z = sceneTile?.scale ?? 1;
      mesh.material = tileMaterial;
      mesh.metadata = { tileIndex: index };
      mesh.actionManager = null;
      return mesh;
    });
    tileMeshesRef.current = tileMeshes;
    tileMaterialsRef.current = tileMaterials;
    tilePositionsRef.current = positions;

    createCenterCity(scene);
    createStartLine(scene, positions[0] ?? [0, 0], board.passStartReward);

    const dieMaterial = createMaterial(scene, "live-die-fallback", "#FFF8E7");
    const diceMeshes = [
      CreateBox("live-die-one", { size: 0.82 }, scene),
      CreateBox("live-die-two", { size: 0.82 }, scene),
    ] as const;
    diceMeshes[0].position.set(-0.62, DICE_REST_Y, 0.15);
    diceMeshes[1].position.set(0.62, DICE_REST_Y, 0.15);
    for (const die of diceMeshes) {
      die.material = dieMaterial;
      setDiePips(die, 1, scene);
    }
    diceMeshesRef.current = diceMeshes;
    usingImportedDiceRef.current = false;

    const finishEnvironmentLoad = () => {
      pendingAssetCountRef.current = Math.max(0, pendingAssetCountRef.current - 1);
      signalReadyRef.current();
    };
    pendingAssetCountRef.current += 2;
    void loadSceneAssets(scene, sceneDefinition)
      .catch((error: unknown) => {
        console.warn("Não foi possível carregar todos os assets do mapa.", error);
      })
      .finally(finishEnvironmentLoad);
    void loadDiceModels(scene)
      .then((importedDice) => {
        if (!importedDice || scene.isDisposed) return;
        for (const die of diceMeshes) die.dispose(false, true);
        diceMeshesRef.current = importedDice;
        usingImportedDiceRef.current = true;
        importedDice[0].rotation.copyFrom(diceTargetRotationsRef.current[0]);
        importedDice[1].rotation.copyFrom(diceTargetRotationsRef.current[1]);
      })
      .catch((error: unknown) => {
        console.warn("Não foi possível carregar o dado 3D; usando o fallback.", error);
      })
      .finally(finishEnvironmentLoad);

    scene.onPointerDown = (_event, pick) => {
      const tileIndex = (pick.pickedMesh?.metadata as { tileIndex?: unknown } | undefined)
        ?.tileIndex;
      if (typeof tileIndex === "number") {
        onTileSelectRef.current(tileIndex);
      }
    };

    scene.onBeforeRenderObservable.add(() => {
      const deltaSeconds = Math.min(0.05, engine.getDeltaTime() / 1_000);
      const elapsedSeconds = performance.now() / 1_000;
      seaRipples.forEach((ripple, index) => {
        ripple.position.y = -0.445 + Math.sin(elapsedSeconds * 0.72 + index) * 0.018;
        const pulse = 1 + Math.sin(elapsedSeconds * 0.36 + index * 1.7) * 0.025;
        ripple.scaling.set(pulse, 1, pulse);
      });
      for (const [playerId, root] of pawnRootsRef.current) {
        const path = pawnPathsRef.current.get(playerId) ?? [];
        const target = path[0];
        let walking = false;
        if (target) {
          const direction = target.subtract(root.position);
          direction.y = 0;
          const distance = direction.length();
          const travel = 3.25 * deltaSeconds;
          if (distance <= travel) {
            root.position.x = target.x;
            root.position.z = target.z;
            path.shift();
            walking = path.length > 0;
          } else {
            direction.normalize();
            root.position.addInPlace(direction.scale(travel));
            root.rotation.y = lerpAngle(
              root.rotation.y,
              Math.atan2(direction.x, direction.z),
              Math.min(1, deltaSeconds * 9),
            );
            walking = true;
          }
        }

        const rig = pawnRigsRef.current.get(playerId);
        const importedAnimations = pawnAnimationsRef.current.get(playerId);
        if (importedAnimations) {
          const nextAnimation = walking ? "walk" : "idle";
          if (importedAnimations.current !== nextAnimation) {
            importedAnimations.idle?.stop();
            importedAnimations.walk?.stop();
            importedAnimations[nextAnimation]?.start(true);
            importedAnimations.current = nextAnimation;
          }
        }
        if (walking && rig) {
          const gait = Math.sin(elapsedSeconds * 11);
          rig.leftArm.rotation.x = gait * 0.62;
          rig.rightArm.rotation.x = -gait * 0.62;
          rig.leftLeg.rotation.x = -gait * 0.48;
          rig.rightLeg.rotation.x = gait * 0.48;
          root.position.y = 1.02 + Math.abs(Math.sin(elapsedSeconds * 11)) * 0.055;
        } else if (rig) {
          rig.leftArm.rotation.x *= 0.82;
          rig.rightArm.rotation.x *= 0.82;
          rig.leftLeg.rotation.x *= 0.82;
          rig.rightLeg.rotation.x *= 0.82;
          root.position.y += (1.02 - root.position.y) * 0.2;
        }
        if (walking && elapsedSeconds - lastStepSoundAtRef.current > 0.24) {
          lastStepSoundAtRef.current = elapsedSeconds;
          playGameSound("step");
        }
      }

      const activeDice = diceMeshesRef.current;
      if (activeDice) {
        const animationAge = performance.now() - diceAnimationStartedAtRef.current;
        if (animationAge < 820) {
          const progress = animationAge / 820;
          for (const [index, die] of activeDice.entries()) {
            die.rotation.x += engine.getDeltaTime() * (0.008 + index * 0.001);
            die.rotation.y += engine.getDeltaTime() * (0.011 - index * 0.001);
            die.position.y = DICE_REST_Y + Math.sin(progress * Math.PI) * 1.25;
          }
        } else {
          for (const [index, die] of activeDice.entries()) {
            const settle = Math.min(1, engine.getDeltaTime() / 170);
            const targetRotation =
              diceTargetRotationsRef.current[index] ?? diceTargetRotationsRef.current[0];
            die.position.y += (DICE_REST_Y - die.position.y) * settle;
            die.rotation.x = lerpAngle(die.rotation.x, targetRotation.x, settle);
            die.rotation.y = lerpAngle(die.rotation.y, targetRotation.y, settle);
            die.rotation.z = lerpAngle(die.rotation.z, targetRotation.z, settle);
          }
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);
    engine.runRenderLoop(() => {
      scene.render();
      if (!firstFrameRenderedRef.current) {
        firstFrameRenderedRef.current = true;
        signalReadyRef.current();
      }
    });

    return () => {
      resizeObserver.disconnect();
      pawnRootsRef.current.clear();
      pawnPathsRef.current.clear();
      pawnPositionsRef.current.clear();
      pawnRigsRef.current.clear();
      pawnAnimationsRef.current.clear();
      propertyRootsRef.current = [];
      diceMeshesRef.current = null;
      usingImportedDiceRef.current = false;
      tileMeshesRef.current = [];
      tileMaterialsRef.current = [];
      tilePositionsRef.current = [];
      sceneRef.current = null;
      signalReadyRef.current = () => undefined;
      scene.dispose();
      engine.dispose();
    };
  }, [board]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const activeIds = new Set(players.map((player) => player.id));
    for (const [playerId, root] of pawnRootsRef.current) {
      if (!activeIds.has(playerId)) {
        root.dispose(false, true);
        pawnRootsRef.current.delete(playerId);
        pawnPathsRef.current.delete(playerId);
        pawnPositionsRef.current.delete(playerId);
        pawnRigsRef.current.delete(playerId);
        const animations = pawnAnimationsRef.current.get(playerId);
        for (const animation of animations?.all ?? []) animation.dispose();
        pawnAnimationsRef.current.delete(playerId);
      }
    }

    const occupantsByPosition = new Map<number, LivePlayerVisual[]>();
    for (const player of players) {
      const occupants = occupantsByPosition.get(player.position) ?? [];
      occupants.push(player);
      occupantsByPosition.set(player.position, occupants);
    }

    for (const player of players) {
      let root = pawnRootsRef.current.get(player.id);
      if (!root) {
        const created = createPawn(scene, player);
        root = created.root;
        pawnRootsRef.current.set(player.id, root);
        pawnRigsRef.current.set(player.id, created.rig);
        const expectsImportedAsset = Boolean(characterAssetLocation(player.pawnKey));
        if (expectsImportedAsset) pendingAssetCountRef.current += 1;
        void loadCharacterModel(scene, player, root, created.rig.fallbackRoot)
          .then((animations) => {
            if (animations && !scene.isDisposed && pawnRootsRef.current.has(player.id)) {
              pawnAnimationsRef.current.set(player.id, animations);
            }
          })
          .finally(() => {
            if (expectsImportedAsset) {
              pendingAssetCountRef.current = Math.max(0, pendingAssetCountRef.current - 1);
              signalReadyRef.current();
            }
          });
      }
      const occupants = occupantsByPosition.get(player.position) ?? [player];
      const occupantIndex = occupants.findIndex((candidate) => candidate.id === player.id);
      const [x, z] = tilePositionsRef.current[player.position] ?? [0, 0];
      const angle = (occupantIndex / Math.max(1, occupants.length)) * Math.PI * 2;
      const offset = occupants.length > 1 ? 0.25 : 0;
      const target = new Vector3(x + Math.cos(angle) * offset, 1.02, z + Math.sin(angle) * offset);
      const previousPosition = pawnPositionsRef.current.get(player.id);
      if (previousPosition === undefined) {
        root.position.copyFrom(target);
        pawnPathsRef.current.set(player.id, []);
      } else if (previousPosition !== player.position) {
        pawnPathsRef.current.set(
          player.id,
          buildWalkingPath(
            previousPosition,
            player.position,
            board.tileCount,
            tilePositionsRef.current,
            target,
          ),
        );
      } else if ((pawnPathsRef.current.get(player.id)?.length ?? 0) === 0) {
        const planarDistance = Math.hypot(root.position.x - target.x, root.position.z - target.z);
        if (planarDistance > 0.03) {
          pawnPathsRef.current.set(player.id, [target]);
        }
      }
      pawnPositionsRef.current.set(player.id, player.position);
      const isCurrent = player.id === currentPlayerId;
      root.scaling.setAll(isCurrent ? 1.14 : 1);
      root.setEnabled(player.status !== "BANKRUPT");
    }
  }, [board.tileCount, currentPlayerId, players]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (const root of propertyRootsRef.current) {
      root.dispose(false, true);
    }
    propertyRootsRef.current = [];

    const playerById = new Map(players.map((player) => [player.id, player]));
    const propertyTileById = new Map(
      board.tiles.flatMap((tile) =>
        tile.property ? ([[tile.property.id, tile.position]] as const) : [],
      ),
    );
    for (const property of properties) {
      if (!property.ownerPlayerId) continue;
      const position = propertyTileById.get(property.propertyId);
      if (position === undefined) continue;
      const [x, z] = tilePositionsRef.current[position] ?? [0, 0];
      const owner = playerById.get(property.ownerPlayerId);
      const root = new TransformNode(`property-marker-${property.propertyId}`, scene);
      root.position.set(x, 0.82, z);
      const color = pawnColors[owner?.colorKey ?? ""] ?? "#75C7B5";
      const material = createMaterial(
        scene,
        `property-owner-${property.propertyId}`,
        property.mortgaged ? "#65777A" : color,
      );
      const ownerMarker = CreateCylinder(
        `property-owner-marker-${property.propertyId}`,
        { diameter: 0.48, height: 0.07, tessellation: 20 },
        scene,
      );
      ownerMarker.position.y = 0.035;
      ownerMarker.material = material;
      ownerMarker.parent = root;
      const level = Math.max(0, property.level);
      const fallback = CreateBox(
        `property-building-fallback-${property.propertyId}`,
        { width: 0.28, depth: 0.28, height: 0.34 + level * 0.1 },
        scene,
      );
      fallback.position.y = 0.2;
      fallback.material = material;
      fallback.parent = root;
      void loadPropertyBuilding(scene, root, fallback, level).catch((error: unknown) => {
        console.warn(`Não foi possível carregar a construção ${property.propertyId}.`, error);
      });
      propertyRootsRef.current.push(root);
    }
  }, [board, players, properties]);

  useEffect(() => {
    for (const [index, material] of tileMaterialsRef.current.entries()) {
      material.emissiveColor =
        index === selectedTileIndex ? Color3.FromHexString("#F2B84B").scale(0.58) : Color3.Black();
      const mesh = tileMeshesRef.current[index];
      if (mesh) {
        mesh.scaling.y = index === selectedTileIndex ? 1.8 : 1;
      }
    }
  }, [selectedTileIndex]);

  useEffect(() => {
    const scene = sceneRef.current;
    const diceMeshes = diceMeshesRef.current;
    if (!scene || !diceMeshes || !dice) return;

    diceTargetRotationsRef.current = [
      dieRotationForValue(dice.dieOne),
      dieRotationForValue(dice.dieTwo),
    ];
    if (!usingImportedDiceRef.current) {
      setDiePips(diceMeshes[0] as Mesh, dice.dieOne, scene);
      setDiePips(diceMeshes[1] as Mesh, dice.dieTwo, scene);
    }
    diceAnimationStartedAtRef.current = performance.now();
  }, [dice]);

  return (
    <canvas
      aria-label={`Tabuleiro 3D multiplayer de ${board.name}`}
      className="live-game-canvas"
      ref={canvasRef}
    />
  );
}

function createCenterCity(scene: Scene) {
  const islandMaterial = createMaterial(scene, "live-island", "#4F825F");
  const lawnMaterial = createMaterial(scene, "live-garden-lawn", "#6EA66E");
  const pathMaterial = createMaterial(scene, "live-garden-path", "#E6D6B6");
  const flowerMaterial = createMaterial(scene, "live-garden-flowers", "#E98B85");
  const plazaMaterial = createMaterial(scene, "live-dice-plaza", "#E8D5A9");
  const plazaRimMaterial = createMaterial(scene, "live-dice-plaza-rim", "#1D5960");
  const island = CreateCylinder(
    "live-center-island",
    { diameter: 7.2, height: 0.38, tessellation: 10 },
    scene,
  );
  island.position.y = 0.52;
  island.scaling.z = 0.72;
  island.rotation.y = 0.18;
  island.material = islandMaterial;

  const gardenLawns = [
    [-2.35, -1.3, 1.15, 0.82],
    [2.35, -1.3, 1.15, 0.82],
    [-2.35, 0.85, 1.05, 0.8],
    [2.35, 0.85, 1.05, 0.8],
  ] as const;
  gardenLawns.forEach(([x, z, width, depth], index) => {
    const lawn = CreateBox(`live-garden-lawn-${index}`, { width, depth, height: 0.09 }, scene);
    lawn.position.set(x, 0.76, z);
    lawn.material = lawnMaterial;
    const flowers = CreateBox(
      `live-garden-flowers-${index}`,
      { width: width * 0.72, depth: 0.09, height: 0.055 },
      scene,
    );
    flowers.position.set(x, 0.835, z + depth * 0.22);
    flowers.material = flowerMaterial;
  });
  const gardenPaths = [
    [0, 0, 6, 0.38, 0],
    [0, 0, 5.1, 0.34, Math.PI / 2],
  ] as const;
  gardenPaths.forEach(([x, z, width, depth, rotation], index) => {
    const path = CreateBox(`live-garden-path-${index}`, { width, depth, height: 0.075 }, scene);
    path.position.set(x, 0.78, z);
    path.rotation.y = rotation;
    path.material = pathMaterial;
  });

  const plazaRim = CreateCylinder(
    "live-dice-plaza-rim",
    { diameter: 3.5, height: 0.11, tessellation: 32 },
    scene,
  );
  plazaRim.position.set(0, 0.78, 0.05);
  plazaRim.material = plazaRimMaterial;
  const plaza = CreateCylinder(
    "live-dice-plaza",
    { diameter: 3.18, height: 0.12, tessellation: 32 },
    scene,
  );
  plaza.position.set(0, 0.86, 0.05);
  plaza.material = plazaMaterial;
}

function createSeaRipples(scene: Scene): readonly Mesh[] {
  const rippleMaterial = createMaterial(scene, "live-sea-ripples", "#64D7E8");
  rippleMaterial.alpha = 0.12;
  rippleMaterial.emissiveColor = Color3.FromHexString("#64D7E8").scale(0.3);
  return [20, 27, 35].map((size, index) => {
    const ripple = CreateGround(`live-sea-ripple-${index}`, { width: size, height: size }, scene);
    ripple.position.y = -0.445 - index * 0.008;
    ripple.rotation.y = index * 0.18;
    ripple.material = rippleMaterial;
    return ripple;
  });
}

function createBeach(scene: Scene): void {
  const sandMaterial = createMaterial(scene, "live-beach-sand", "#CFAE72");
  sandMaterial.specularColor = Color3.FromHexString("#6F5A35").scale(0.12);
  const wetSandMaterial = createMaterial(scene, "live-wet-sand", "#927650");

  const wetSand = CreateCylinder(
    "live-wet-sand",
    { diameter: 20.8, height: 0.15, tessellation: 24 },
    scene,
  );
  wetSand.position.y = -0.39;
  wetSand.scaling.z = 0.82;
  wetSand.rotation.y = 0.08;
  wetSand.material = wetSandMaterial;

  const beach = CreateCylinder(
    "live-beach",
    { diameter: 19.6, height: 0.2, tessellation: 24 },
    scene,
  );
  beach.position.y = -0.31;
  beach.scaling.z = 0.8;
  beach.rotation.y = -0.05;
  beach.material = sandMaterial;
}

async function loadSceneAssets(scene: Scene, definition: BoardSceneDefinition): Promise<void> {
  await Promise.all(
    definition.props.map(async (prop) => {
      const asset = getSceneAsset(prop.assetId);
      const imported = await SceneLoader.ImportMeshAsync("", asset.root, asset.file, scene);
      if (scene.isDisposed) {
        for (const mesh of imported.meshes) mesh.dispose(false, true);
        return;
      }
      const placementRoot = new TransformNode(`scene-prop-${prop.id}`, scene);
      placementRoot.position.set(prop.x, prop.y, prop.z);
      placementRoot.rotation.y = prop.rotationY;
      placementRoot.scaling.setAll(prop.scale);
      for (const importedRoot of imported.meshes.filter((mesh) => mesh.parent === null)) {
        importedRoot.parent = placementRoot;
      }
    }),
  );
}

async function loadPropertyBuilding(
  scene: Scene,
  root: TransformNode,
  fallback: Mesh,
  level: number,
): Promise<void> {
  const assetId =
    level >= 3 ? "kenney-tower-large" : level >= 1 ? "kenney-tower-small" : "kenney-structure";
  const asset = getSceneAsset(assetId);
  const imported = await SceneLoader.ImportMeshAsync("", asset.root, asset.file, scene);
  if (scene.isDisposed || root.isDisposed()) {
    for (const mesh of imported.meshes) mesh.dispose(false, true);
    return;
  }
  const modelRoot = new TransformNode(`${root.name}-model`, scene);
  modelRoot.parent = root;
  modelRoot.scaling.setAll(level >= 3 ? 0.105 : 0.092);
  for (const importedRoot of imported.meshes.filter((mesh) => mesh.parent === null)) {
    importedRoot.parent = modelRoot;
  }
  fallback.dispose(false, true);
}

async function loadDiceModels(
  scene: Scene,
): Promise<readonly [TransformNode, TransformNode] | null> {
  const first = await loadSingleDice(scene, "live-die-one", new Vector3(-0.62, DICE_REST_Y, 0.15));
  if (!first || scene.isDisposed) return null;
  const second = await loadSingleDice(scene, "live-die-two", new Vector3(0.62, DICE_REST_Y, 0.15));
  if (!second || scene.isDisposed) {
    first.dispose(false, true);
    return null;
  }
  return [first, second];
}

async function loadSingleDice(
  scene: Scene,
  name: string,
  position: Vector3,
): Promise<TransformNode | null> {
  const previousMaterials = new Set(scene.materials);
  const imported = await SceneLoader.ImportMeshAsync("", diceAsset.root, diceAsset.file, scene);
  if (scene.isDisposed) {
    for (const mesh of imported.meshes) mesh.dispose(false, true);
    return null;
  }

  for (const material of scene.materials) {
    if (previousMaterials.has(material) || !(material instanceof PBRMaterial)) continue;
    const normalizedName = material.name.toLowerCase();
    if (normalizedName.includes("black")) {
      material.albedoColor = Color3.FromHexString("#102630");
      material.emissiveColor = Color3.FromHexString("#07151B").scale(0.25);
    } else if (normalizedName.includes("white")) {
      material.albedoColor = Color3.FromHexString("#FFF7E5");
    }
    material.metallic = 0;
    material.roughness = 0.38;
  }

  for (const plane of imported.meshes.filter((mesh) => mesh.name === "Plane")) {
    plane.dispose(false, true);
  }
  const dieMesh = imported.meshes.find((mesh) => mesh.name.includes("Tärning_Cube"));
  if (!dieMesh || dieMesh.isDisposed()) {
    for (const mesh of imported.meshes) mesh.dispose(false, true);
    return null;
  }

  const bounds = dieMesh.getHierarchyBoundingVectors(true);
  const center = bounds.min.add(bounds.max).scale(0.5);
  const rig = new TransformNode(name, scene);
  const content = new TransformNode(`${name}-model`, scene);
  content.parent = rig;
  content.position.copyFrom(center.scale(-1));
  rig.scaling.setAll(0.76);
  for (const importedRoot of imported.meshes.filter(
    (mesh) => mesh.parent === null && !mesh.isDisposed(),
  )) {
    importedRoot.parent = content;
  }
  rig.position.copyFrom(position);
  return rig;
}

function createStartLine(scene: Scene, [x, z]: readonly [number, number], reward: number): void {
  const dark = createMaterial(scene, "live-start-dark", "#07232D");
  const light = createMaterial(scene, "live-start-light", "#FFF7DB");
  const gold = createMaterial(scene, "live-start-gold", "#F2B84B");
  for (let index = 0; index < 6; index += 1) {
    const stripe = CreateBox(
      `live-start-stripe-${index}`,
      { width: 0.19, depth: 1.13, height: 0.055 },
      scene,
    );
    stripe.position.set(x - 0.475 + index * 0.19, 0.68, z);
    stripe.material = index % 2 === 0 ? dark : light;
  }
  [-0.58, 0.58].forEach((offset, index) => {
    const post = CreateCylinder(
      `live-start-post-${index}`,
      { diameter: 0.08, height: 0.72, tessellation: 8 },
      scene,
    );
    post.position.set(x + offset, 1.02, z);
    post.material = gold;
  });
  const banner = CreateBox("live-start-banner", { width: 1.24, depth: 0.08, height: 0.14 }, scene);
  banner.position.set(x, 1.34, z);
  banner.material = gold;
  banner.metadata = { reward };
}

function createPawn(
  scene: Scene,
  player: LivePlayerVisual,
): { readonly root: TransformNode; readonly rig: PawnRig } {
  const root = new TransformNode(`pawn-${player.id}`, scene);
  const fallbackRoot = new TransformNode(`pawn-fallback-${player.id}`, scene);
  fallbackRoot.parent = root;
  const color = pawnColors[player.colorKey] ?? "#75C7B5";
  const bodyMaterial = createMaterial(scene, `pawn-material-${player.id}`, color);
  const skinMaterial = createMaterial(scene, `pawn-skin-${player.id}`, "#E8B68C");
  const darkMaterial = createMaterial(scene, `pawn-dark-${player.id}`, "#123044");

  const base = CreateCylinder(
    `pawn-base-${player.id}`,
    { diameter: 0.52, height: 0.12, tessellation: 16 },
    scene,
  );
  base.position.y = 0.06;
  base.material = darkMaterial;
  base.parent = root;

  const body = CreateCylinder(
    `pawn-body-${player.id}`,
    { diameterTop: 0.28, diameterBottom: 0.4, height: 0.58, tessellation: 8 },
    scene,
  );
  body.position.y = 0.41;
  body.material = bodyMaterial;
  body.parent = fallbackRoot;

  const leftLeg = createLimb(
    scene,
    fallbackRoot,
    `pawn-left-leg-${player.id}`,
    new Vector3(-0.11, 0.24, 0),
    bodyMaterial,
    0.29,
  );
  const rightLeg = createLimb(
    scene,
    fallbackRoot,
    `pawn-right-leg-${player.id}`,
    new Vector3(0.11, 0.24, 0),
    bodyMaterial,
    0.29,
  );
  const leftArm = createLimb(
    scene,
    fallbackRoot,
    `pawn-left-arm-${player.id}`,
    new Vector3(-0.24, 0.62, 0),
    skinMaterial,
    0.34,
  );
  const rightArm = createLimb(
    scene,
    fallbackRoot,
    `pawn-right-arm-${player.id}`,
    new Vector3(0.24, 0.62, 0),
    skinMaterial,
    0.34,
  );

  const head = CreateSphere(`pawn-head-${player.id}`, { diameter: 0.3, segments: 8 }, scene);
  head.position.y = 0.83;
  head.material = skinMaterial;
  head.parent = fallbackRoot;
  return {
    root,
    rig: { fallbackRoot, leftArm, leftLeg, rightArm, rightLeg },
  };
}

async function loadCharacterModel(
  scene: Scene,
  player: LivePlayerVisual,
  pawnRoot: TransformNode,
  fallbackRoot: TransformNode,
): Promise<PawnAnimationSet | null> {
  const asset = characterAssetLocation(player.pawnKey);
  if (!asset) return null;
  try {
    const imported = await SceneLoader.ImportMeshAsync("", asset.root, asset.file, scene);
    if (scene.isDisposed || pawnRoot.isDisposed()) {
      for (const mesh of imported.meshes) mesh.dispose(false, true);
      for (const animation of imported.animationGroups) animation.dispose();
      return null;
    }
    const importedRoots = imported.meshes.filter((mesh) => mesh.parent === null);
    for (const importedRoot of importedRoots) {
      importedRoot.parent = pawnRoot;
      importedRoot.scaling.setAll(0.48);
      importedRoot.rotation.y = CHARACTER_MODEL_FORWARD_OFFSET;
    }
    fallbackRoot.setEnabled(false);
    const idle =
      imported.animationGroups.find((animation) => animation.name === "Idle") ??
      imported.animationGroups.find((animation) => animation.name === "Idle_Neutral");
    const walk = imported.animationGroups.find((animation) => animation.name === "Walk");
    idle?.start(true);
    return { all: imported.animationGroups, idle, walk, current: "idle" };
  } catch (error) {
    console.warn(`Não foi possível carregar ${player.pawnKey}; usando fallback.`, error);
    return null;
  }
}

function createLimb(
  scene: Scene,
  parent: TransformNode,
  name: string,
  position: Vector3,
  material: StandardMaterial,
  length: number,
): TransformNode {
  const pivot = new TransformNode(`${name}-pivot`, scene);
  pivot.position.copyFrom(position);
  pivot.parent = parent;
  const limb = CreateCylinder(name, { diameter: 0.1, height: length, tessellation: 7 }, scene);
  limb.position.y = -length / 2;
  limb.material = material;
  limb.parent = pivot;
  return pivot;
}

function setDiePips(die: Mesh, value: number, scene: Scene) {
  for (const child of die.getChildMeshes(false)) {
    child.dispose(false, true);
  }
  const pipMaterial = createMaterial(scene, `pip-${die.name}-${value}-${Date.now()}`, "#123044");
  for (const [gridX, gridZ] of pipLayouts[value] ?? pipLayouts[1] ?? []) {
    const pip = CreateSphere(
      `pip-${die.name}-${gridX}-${gridZ}`,
      { diameter: 0.105, segments: 6 },
      scene,
    );
    pip.position.set(gridX * 0.2, 0.425, gridZ * 0.2);
    pip.material = pipMaterial;
    pip.parent = die;
  }
}

function createMaterial(scene: Scene, name: string, hex: string): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = Color3.FromHexString("#172D34").scale(0.35);
  return result;
}

function dieRotationForValue(value: number): Vector3 {
  switch (value) {
    case 1:
      return new Vector3(-Math.PI / 2, 0, 0);
    case 2:
      return Vector3.Zero();
    case 3:
      return new Vector3(0, 0, -Math.PI / 2);
    case 4:
      return new Vector3(0, 0, Math.PI / 2);
    case 5:
      return new Vector3(Math.PI, 0, 0);
    case 6:
      return new Vector3(Math.PI / 2, 0, 0);
    default:
      return Vector3.Zero();
  }
}

function lerpAngle(current: number, target: number, amount: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function buildWalkingPath(
  origin: number,
  destination: number,
  tileCount: number,
  positions: readonly [number, number][],
  finalTarget: Vector3,
): Vector3[] {
  const forwardSteps = (destination - origin + tileCount) % tileCount;
  const backwardSteps = (origin - destination + tileCount) % tileCount;
  const direction = backwardSteps < forwardSteps ? -1 : 1;
  const stepCount = Math.min(forwardSteps, backwardSteps);
  const path: Vector3[] = [];
  for (let step = 1; step <= stepCount; step += 1) {
    const position = (origin + direction * step + tileCount) % tileCount;
    const [x, z] = positions[position] ?? [0, 0];
    path.push(new Vector3(x, 1.02, z));
  }
  if (path.length === 0) {
    path.push(finalTarget);
  } else {
    path[path.length - 1] = finalTarget;
  }
  return path;
}
