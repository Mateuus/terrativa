import "@babylonjs/loaders/glTF";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GizmoManager,
  HemisphericLight,
  HighlightLayer,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointerDragBehavior,
  PointerEventTypes,
  Quaternion,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import {
  type BoardSceneProp,
  type BoardSceneTile,
  baixadaSantistaContent,
  getSceneAsset,
} from "@terrativa/board-content";
import { useEffect, useRef } from "react";
import {
  getLandscapeSurfaceHeight,
  type LandscapeSculptTool,
  sculptLandscape,
} from "./studioLandscape";
import type { StudioSelectionTransform } from "./studioTransforms";
import type { StudioWorld } from "./worldModel";
import {
  getVehicleAsset,
  type WorldContentAsset,
  type WorldLandscape,
  type WorldPlacedObject,
  type WorldRoute,
  type WorldVehicle,
  type WorldWaterBody,
} from "./worldModel";

export type StudioSelection =
  | { readonly kind: "landscape"; readonly id: string }
  | { readonly kind: "tile"; readonly position: number }
  | { readonly kind: "prop"; readonly id: string }
  | { readonly kind: "water"; readonly id: string }
  | { readonly kind: "route"; readonly id: string }
  | { readonly kind: "vehicle"; readonly id: string }
  | { readonly kind: "object"; readonly id: string };

export type TransformTool = "move" | "rotate" | "scale";
export type CameraView = "perspective" | "top";
export interface StudioTransformPatch {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly rotationY?: number;
  readonly scale?: number;
  readonly width?: number;
  readonly length?: number;
}

interface WorldCanvas3DProps {
  readonly world: StudioWorld;
  readonly selection: StudioSelection | null;
  readonly selections: readonly StudioSelection[];
  readonly tool: TransformTool;
  readonly cameraView: CameraView;
  readonly showGrid: boolean;
  readonly landscapeTool: LandscapeSculptTool | null;
  readonly landscapeBrushRadius: number;
  readonly landscapeBrushStrength: number;
  readonly onSelect: (selection: StudioSelection | null, additive: boolean) => void;
  readonly onCopySelection?: (selection: StudioSelection) => void;
  readonly onDeleteSelection?: (selection: StudioSelection) => void;
  readonly onDuplicateSelection?: (selection: StudioSelection) => void;
  readonly onPasteSelection?: () => void;
  readonly onSculptLandscape?: (landscape: WorldLandscape) => void;
  readonly onToolChange?: (tool: TransformTool) => void;
  readonly onToggleGrid?: () => void;
  readonly onTransform: (transforms: readonly StudioSelectionTransform[]) => void;
  readonly onReady?: () => void;
}

interface Runtime {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  readonly gizmos: GizmoManager;
  readonly highlight: HighlightLayer;
  readonly nodes: Map<string, TransformNode>;
  readonly loading: Set<string>;
  readonly keys: Set<string>;
  readonly freeMoveHandle: Mesh;
  readonly freeMoveDrag: PointerDragBehavior;
  readonly selectionPivot: TransformNode;
  readonly landscapeBrush: Mesh;
  groupNodes: TransformNode[];
  freeMoveTarget: TransformNode | null;
  freeMoveActive: boolean;
  sculptActive: boolean;
  sculptLandscape: WorldLandscape | null;
  lastSculptX: number;
  lastSculptZ: number;
  terrainSignature: string;
  grid: Mesh | null;
  gridVisible: boolean;
  disposed: boolean;
  rightMouseDown: boolean;
  leftMouseOrbit: boolean;
  orbitDragDistance: number;
  suppressNextPick: boolean;
  cameraSpeed: number;
  lastPointerX: number;
  lastPointerY: number;
}

const tileContent = new Map(baixadaSantistaContent.tiles.map((tile) => [tile.position, tile]));
const cityColors = new Map(
  baixadaSantistaContent.cities.map((city) => [city.key, city.accentColor]),
);

export function WorldCanvas3D({
  cameraView,
  landscapeBrushRadius,
  landscapeBrushStrength,
  landscapeTool,
  onCopySelection,
  onDeleteSelection,
  onDuplicateSelection,
  onPasteSelection,
  onReady,
  onSculptLandscape,
  onSelect,
  onToggleGrid,
  onToolChange,
  onTransform,
  selection,
  selections,
  showGrid,
  tool,
  world,
}: WorldCanvas3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const worldRef = useRef(world);
  const selectionRef = useRef(selection);
  const selectionsRef = useRef(selections);
  const gridVisibleRef = useRef(showGrid);
  const onSelectRef = useRef(onSelect);
  const onTransformRef = useRef(onTransform);
  const onCopySelectionRef = useRef(onCopySelection);
  const onDeleteSelectionRef = useRef(onDeleteSelection);
  const onDuplicateSelectionRef = useRef(onDuplicateSelection);
  const onPasteSelectionRef = useRef(onPasteSelection);
  const onSculptLandscapeRef = useRef(onSculptLandscape);
  const onToolChangeRef = useRef(onToolChange);
  const onToggleGridRef = useRef(onToggleGrid);
  const landscapeToolRef = useRef(landscapeTool);
  const landscapeBrushRadiusRef = useRef(landscapeBrushRadius);
  const landscapeBrushStrengthRef = useRef(landscapeBrushStrength);

  worldRef.current = world;
  selectionRef.current = selection;
  selectionsRef.current = selections;
  gridVisibleRef.current = showGrid;
  onSelectRef.current = onSelect;
  onTransformRef.current = onTransform;
  onCopySelectionRef.current = onCopySelection;
  onDeleteSelectionRef.current = onDeleteSelection;
  onDuplicateSelectionRef.current = onDuplicateSelection;
  onPasteSelectionRef.current = onPasteSelection;
  onSculptLandscapeRef.current = onSculptLandscape;
  onToolChangeRef.current = onToolChange;
  onToggleGridRef.current = onToggleGrid;
  landscapeToolRef.current = landscapeTool;
  landscapeBrushRadiusRef.current = landscapeBrushRadius;
  landscapeBrushStrengthRef.current = landscapeBrushStrength;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#9FD4DDFF");
    scene.ambientColor = new Color3(0.32, 0.38, 0.38);

    const camera = new ArcRotateCamera(
      "studio-camera",
      -Math.PI * 0.72,
      Math.PI * 0.32,
      31,
      new Vector3(0, 0.8, 0),
      scene,
    );
    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 75;
    camera.lowerBetaLimit = 0.12;
    camera.upperBetaLimit = Math.PI * 0.49;
    camera.wheelPrecision = 30;
    camera.panningSensibility = 70;
    camera.attachControl(canvas, true);
    camera.inputs.removeByType("ArcRotateCameraPointersInput");
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

    const ambient = new HemisphericLight("studio-ambient", new Vector3(0.2, 1, 0.1), scene);
    ambient.intensity = 0.72;
    ambient.groundColor = Color3.FromHexString("#29464A");
    const sun = new DirectionalLight("studio-sun", new Vector3(-0.45, -1, 0.36), scene);
    sun.position = new Vector3(18, 30, -22);
    sun.intensity = worldRef.current.terrain.sunIntensity;

    const gizmos = new GizmoManager(scene);
    gizmos.usePointerToAttachGizmos = false;
    gizmos.clearGizmoOnEmptyPointerEvent = false;
    gizmos.positionGizmoEnabled = true;
    if (gizmos.gizmos.positionGizmo) {
      gizmos.gizmos.positionGizmo.planarGizmoEnabled = true;
    }

    const highlight = new HighlightLayer("studio-selection", scene);
    highlight.innerGlow = false;
    highlight.outerGlow = true;

    const freeMoveMaterial = new StandardMaterial("studio-free-move-material", scene);
    freeMoveMaterial.diffuseColor = Color3.FromHexString("#FFD05A");
    freeMoveMaterial.emissiveColor = Color3.FromHexString("#7A5D12");
    freeMoveMaterial.specularColor = Color3.Black();
    freeMoveMaterial.backFaceCulling = false;
    const freeMoveHandle = MeshBuilder.CreatePlane(
      "studio-free-move-handle",
      { size: 0.32 },
      scene,
    );
    freeMoveHandle.material = freeMoveMaterial;
    freeMoveHandle.billboardMode = Mesh.BILLBOARDMODE_ALL;
    freeMoveHandle.metadata = { studioGizmoHandle: "screen-translate" };
    freeMoveHandle.renderingGroupId = 3;
    freeMoveHandle.enableEdgesRendering();
    freeMoveHandle.edgesWidth = 2;
    freeMoveHandle.edgesColor = Color4.FromHexString("#151515FF");
    freeMoveHandle.setEnabled(false);
    const freeMoveDrag = new PointerDragBehavior();
    freeMoveDrag.moveAttached = false;
    freeMoveDrag.dragDeltaRatio = 1;
    freeMoveDrag.updateDragPlane = true;
    freeMoveDrag.detachCameraControls = false;
    freeMoveHandle.addBehavior(freeMoveDrag);
    const selectionPivot = new TransformNode("studio-multi-selection-pivot", scene);
    selectionPivot.setEnabled(false);

    const landscapeBrushMaterial = new StandardMaterial("landscape-brush-material", scene);
    landscapeBrushMaterial.diffuseColor = Color3.FromHexString("#E8B24B");
    landscapeBrushMaterial.emissiveColor = Color3.FromHexString("#A96E10");
    landscapeBrushMaterial.disableLighting = true;
    const landscapeBrush = MeshBuilder.CreateTorus(
      "landscape-brush",
      { diameter: 2, thickness: 0.055, tessellation: 48 },
      scene,
    );
    landscapeBrush.material = landscapeBrushMaterial;
    landscapeBrush.isPickable = false;
    landscapeBrush.renderingGroupId = 3;
    landscapeBrush.setEnabled(false);

    const runtime: Runtime = {
      engine,
      scene,
      camera,
      gizmos,
      highlight,
      nodes: new Map(),
      loading: new Set(),
      keys: new Set(),
      freeMoveHandle,
      freeMoveDrag,
      selectionPivot,
      landscapeBrush,
      groupNodes: [],
      freeMoveTarget: null,
      freeMoveActive: false,
      sculptActive: false,
      sculptLandscape: null,
      lastSculptX: Number.NaN,
      lastSculptZ: Number.NaN,
      terrainSignature: "",
      grid: null,
      gridVisible: gridVisibleRef.current,
      disposed: false,
      rightMouseDown: false,
      leftMouseOrbit: false,
      orbitDragDistance: 0,
      suppressNextPick: false,
      cameraSpeed: 5,
      lastPointerX: 0,
      lastPointerY: 0,
    };
    runtimeRef.current = runtime;
    syncRuntime(runtime, worldRef.current);

    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      if ("button" in pointerInfo.event && pointerInfo.event.button !== 0) return;
      if (landscapeToolRef.current) return;
      if (runtime.suppressNextPick) {
        runtime.suppressNextPick = false;
        return;
      }
      const metadata = pointerInfo.pickInfo?.pickedMesh?.metadata as
        | { selection?: StudioSelection; studioGizmoHandle?: string }
        | undefined;
      if (metadata?.studioGizmoHandle) return;
      const additive = pointerInfo.event.ctrlKey || pointerInfo.event.metaKey;
      onSelectRef.current(metadata?.selection ?? null, additive);
    });

    const commitTransform = () => {
      const transforms = collectSelectionTransforms(runtime, selectionsRef.current);
      if (transforms.length === 0) return;
      detachSelectionGroup(runtime);
      onTransformRef.current(transforms);
    };
    freeMoveDrag.onDragStartObservable.add(() => {
      runtime.freeMoveActive = true;
      runtime.leftMouseOrbit = false;
      freeMoveMaterial.emissiveColor = Color3.FromHexString("#E2AA28");
    });
    freeMoveDrag.onDragObservable.add((event) => {
      const target = runtime.freeMoveTarget;
      if (!target) return;
      target.position.addInPlace(event.delta);
    });
    freeMoveDrag.onDragEndObservable.add(() => {
      runtime.freeMoveActive = false;
      freeMoveMaterial.emissiveColor = Color3.FromHexString("#7A5D12");
      commitTransform();
    });
    canvas.addEventListener("pointerup", commitTransform);

    const onPointerDown = (event: PointerEvent) => {
      canvas.focus();
      if (event.button === 2) {
        runtime.rightMouseDown = true;
        runtime.orbitDragDistance = 0;
        runtime.lastPointerX = event.clientX;
        runtime.lastPointerY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
      if (event.button === 0) {
        const picked = scene.pick(event.offsetX, event.offsetY);
        if (
          landscapeToolRef.current &&
          worldRef.current.landscape &&
          picked?.pickedMesh?.name === "world-terrain" &&
          picked.pickedPoint
        ) {
          runtime.sculptActive = true;
          runtime.sculptLandscape = structuredClone(worldRef.current.landscape);
          runtime.lastSculptX = Number.NaN;
          runtime.lastSculptZ = Number.NaN;
          applyLandscapeBrush(
            runtime,
            worldRef.current,
            picked.pickedPoint,
            landscapeToolRef.current,
            landscapeBrushRadiusRef.current,
            landscapeBrushStrengthRef.current,
          );
          runtime.suppressNextPick = true;
          canvas.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
        const metadata = picked?.pickedMesh?.metadata as
          | { selection?: StudioSelection; studioGizmoHandle?: string }
          | undefined;
        if (!metadata?.selection && !metadata?.studioGizmoHandle && !runtime.gizmos.isHovered) {
          runtime.leftMouseOrbit = true;
          runtime.orbitDragDistance = 0;
          runtime.lastPointerX = event.clientX;
          runtime.lastPointerY = event.clientY;
          canvas.setPointerCapture(event.pointerId);
        }
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const landscapePick = scene.pick(event.offsetX, event.offsetY);
      updateLandscapeBrushCursor(
        runtime,
        Boolean(landscapeToolRef.current),
        landscapeBrushRadiusRef.current,
        landscapePick?.pickedMesh?.name === "world-terrain"
          ? (landscapePick.pickedPoint ?? null)
          : null,
      );
      if (runtime.sculptActive && event.buttons === 1 && landscapePick?.pickedPoint) {
        applyLandscapeBrush(
          runtime,
          worldRef.current,
          landscapePick.pickedPoint,
          landscapeToolRef.current,
          landscapeBrushRadiusRef.current,
          landscapeBrushStrengthRef.current,
        );
        event.preventDefault();
        return;
      }
      if (!runtime.rightMouseDown && !runtime.leftMouseOrbit) return;
      const dx = event.clientX - runtime.lastPointerX;
      const dy = event.clientY - runtime.lastPointerY;
      runtime.lastPointerX = event.clientX;
      runtime.lastPointerY = event.clientY;
      runtime.orbitDragDistance += Math.abs(dx) + Math.abs(dy);
      if (runtime.leftMouseOrbit && runtime.orbitDragDistance > 4) {
        runtime.suppressNextPick = true;
      }
      runtime.camera.alpha -= dx * 0.004;
      runtime.camera.beta = Math.min(
        Math.PI * 0.49,
        Math.max(0.05, runtime.camera.beta + dy * 0.004),
      );
      event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 0 && runtime.sculptActive) {
        runtime.sculptActive = false;
        const sculpted = runtime.sculptLandscape;
        runtime.sculptLandscape = null;
        if (sculpted) onSculptLandscapeRef.current?.(sculpted);
        if (canvas.hasPointerCapture(event.pointerId))
          canvas.releasePointerCapture(event.pointerId);
        queueMicrotask(() => {
          runtime.suppressNextPick = false;
        });
        event.preventDefault();
        return;
      }
      if (event.button === 2) runtime.rightMouseDown = false;
      if (event.button === 0) runtime.leftMouseOrbit = false;
      if (event.button === 0 || event.button === 2) {
        if (canvas.hasPointerCapture(event.pointerId))
          canvas.releasePointerCapture(event.pointerId);
        queueMicrotask(() => {
          runtime.suppressNextPick = false;
        });
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (runtime.rightMouseDown) {
        runtime.cameraSpeed = Math.min(
          30,
          Math.max(0.5, runtime.cameraSpeed * (event.deltaY < 0 ? 1.15 : 0.87)),
        );
      } else {
        runtime.camera.radius = Math.min(
          runtime.camera.upperRadiusLimit ?? 75,
          Math.max(
            runtime.camera.lowerRadiusLimit ?? 4,
            runtime.camera.radius * (event.deltaY < 0 ? 0.9 : 1.1),
          ),
        );
      }
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!event.ctrlKey && ["w", "a", "s", "d", "q", "e"].includes(key)) {
        runtime.keys.add(key);
        event.preventDefault();
      }
      if (event.repeat) return;
      if (key === "1") onToolChangeRef.current?.("move");
      if (key === "2") onToolChangeRef.current?.("rotate");
      if (key === "3") onToolChangeRef.current?.("scale");
      if (key === "g") onToggleGridRef.current?.();
      if (key === "escape") onSelectRef.current(null, false);
      if (key === "f") focusSelection(runtime, selectionsRef.current);
      if ((key === "delete" || key === "backspace") && selectionRef.current) {
        onDeleteSelectionRef.current?.(selectionRef.current);
        event.preventDefault();
      }
      if (key === "d" && event.ctrlKey && selectionRef.current) {
        onDuplicateSelectionRef.current?.(selectionRef.current);
        event.preventDefault();
      }
      if (key === "c" && event.ctrlKey && selectionRef.current) {
        onCopySelectionRef.current?.(selectionRef.current);
        event.preventDefault();
      }
      if (key === "v" && event.ctrlKey) {
        onPasteSelectionRef.current?.();
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => runtime.keys.delete(event.key.toLowerCase());
    const onBlur = () => {
      runtime.keys.clear();
      runtime.rightMouseDown = false;
      runtime.leftMouseOrbit = false;
      runtime.sculptActive = false;
      runtime.sculptLandscape = null;
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("blur", onBlur);
    canvas.addEventListener("contextmenu", onContextMenu);

    engine.runRenderLoop(() => {
      updateCameraFlight(runtime);
      updateFreeMoveHandle(runtime);
      scene.render();
    });
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    onReady?.();

    return () => {
      runtime.disposed = true;
      canvas.removeEventListener("pointerup", commitTransform);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("blur", onBlur);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", resize);
      scene.dispose();
      engine.dispose();
      runtimeRef.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    detachSelectionGroup(runtime);
    syncRuntime(runtime, world);
    attachSelection(runtime, selectionsRef.current);
  }, [world]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    attachSelection(runtime, selections);
  }, [selections]);

  useEffect(() => {
    const gizmos = runtimeRef.current?.gizmos;
    if (!gizmos) return;
    gizmos.positionGizmoEnabled = tool === "move";
    gizmos.rotationGizmoEnabled = tool === "rotate";
    gizmos.scaleGizmoEnabled = tool === "scale";
    const runtime = runtimeRef.current;
    if (runtime) {
      runtime.freeMoveDrag.enabled = tool === "move";
      runtime.freeMoveHandle.setEnabled(tool === "move" && Boolean(runtime.freeMoveTarget));
    }
  }, [tool]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.landscapeBrush.setEnabled(false);
    runtime.gizmos.attachToNode(landscapeTool ? null : runtime.freeMoveTarget);
    runtime.freeMoveHandle.setEnabled(
      !landscapeTool && tool === "move" && Boolean(runtime.freeMoveTarget),
    );
  }, [landscapeTool, tool]);

  useEffect(() => {
    const camera = runtimeRef.current?.camera;
    if (!camera) return;
    if (cameraView === "top") {
      camera.alpha = -Math.PI / 2;
      camera.beta = 0.08;
      camera.radius = 35;
      camera.target.set(0, 0, 0);
    } else {
      camera.alpha = -Math.PI * 0.72;
      camera.beta = Math.PI * 0.32;
      camera.radius = 31;
      camera.target.set(0, 0.8, 0);
    }
  }, [cameraView]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.gridVisible = showGrid;
    runtime.grid?.setEnabled(showGrid);
  }, [showGrid]);

  return (
    <canvas
      aria-label={`Editor 3D do mundo ${world.name}`}
      className="world-canvas"
      ref={canvasRef}
      tabIndex={0}
    />
  );
}

function syncRuntime(runtime: Runtime, world: StudioWorld): void {
  const { scene } = runtime;
  scene.clearColor = Color4.FromHexString(`${world.terrain.skyColor}FF`);
  const sun = scene.getLightByName("studio-sun");
  if (sun) sun.intensity = world.terrain.sunIntensity;

  syncTerrain(runtime, world);
  syncBoard(runtime);
  syncTiles(runtime, world.scene.tiles);
  syncProps(runtime, world.scene.props);
  syncWaterBodies(runtime, world.waterBodies);
  syncRoutes(runtime, world);
  syncVehicles(runtime, world.vehicles);
  syncObjects(runtime, world.objects, world.contentAssets);
}

function syncTerrain(runtime: Runtime, world: StudioWorld): void {
  const signature = JSON.stringify({
    ...world.terrain,
    landscape: world.landscape,
    surface: world.scene.surface,
  });
  if (runtime.terrainSignature === signature) return;
  runtime.terrainSignature = signature;

  for (const name of ["world-terrain", "world-water", "world-board", "editor-grid"]) {
    runtime.scene.getMeshByName(name)?.dispose(false, true);
  }

  if (world.landscape?.visible) {
    const terrain = MeshBuilder.CreateGround(
      "world-terrain",
      {
        width: world.landscape.width,
        height: world.landscape.depth,
        subdivisions: world.landscape.resolution,
        updatable: true,
      },
      runtime.scene,
    );
    updateLandscapeMesh(terrain, world, world.landscape);
    const terrainMaterial = new StandardMaterial("terrain-material", runtime.scene);
    terrainMaterial.diffuseColor = Color3.FromHexString(world.terrain.groundColor);
    terrainMaterial.specularColor = new Color3(0.05, 0.06, 0.04);
    terrainMaterial.roughness = 0.9;
    terrain.material = terrainMaterial;
    terrain.metadata = {
      selection: { kind: "landscape", id: world.landscape.id } satisfies StudioSelection,
    };
    terrain.isPickable = true;
  }

  const water = MeshBuilder.CreateGround(
    "world-water",
    { width: world.terrain.size * 2.7, height: world.terrain.size * 2.7 },
    runtime.scene,
  );
  water.position.y = world.terrain.waterLevel;
  const waterMaterial = new StandardMaterial("water-material", runtime.scene);
  waterMaterial.diffuseColor = Color3.FromHexString(world.terrain.waterColor);
  waterMaterial.emissiveColor = Color3.FromHexString(world.terrain.waterColor).scale(0.18);
  waterMaterial.specularColor = new Color3(0.8, 0.95, 1);
  waterMaterial.alpha = 0.88;
  water.material = waterMaterial;
  water.isPickable = false;

  const board = MeshBuilder.CreateBox(
    "world-board",
    {
      width: world.scene.surface.width,
      depth: world.scene.surface.depth,
      height: 0.55,
    },
    runtime.scene,
  );
  board.position.y = 0.18;
  const boardMaterial = new StandardMaterial("board-material", runtime.scene);
  boardMaterial.diffuseColor = Color3.FromHexString(world.scene.surface.baseColor);
  boardMaterial.specularColor = new Color3(0.08, 0.08, 0.06);
  board.material = boardMaterial;
  board.enableEdgesRendering();
  board.edgesColor = Color4.FromHexString(`${world.scene.surface.edgeColor}FF`);
  board.edgesWidth = 5;
  board.isPickable = false;

  const half = Math.ceil(
    Math.max(world.landscape?.width ?? world.terrain.size, world.landscape?.depth ?? 0) / 2,
  );
  const lines: Vector3[][] = [];
  for (let value = -half; value <= half; value += 1) {
    lines.push([new Vector3(-half, 0.5, value), new Vector3(half, 0.5, value)]);
    lines.push([new Vector3(value, 0.5, -half), new Vector3(value, 0.5, half)]);
  }
  const grid = MeshBuilder.CreateLineSystem("editor-grid", { lines }, runtime.scene);
  grid.color = Color3.FromHexString("#7AC7C3");
  grid.alpha = 0.16;
  grid.isPickable = false;
  runtime.grid = grid;
  grid.setEnabled(runtime.gridVisible);
}

function syncBoard(runtime: Runtime): void {
  const board = runtime.scene.getMeshByName("world-board");
  if (!board) return;
  board.scaling.set(1, 1, 1);
}

function syncTiles(runtime: Runtime, tiles: readonly BoardSceneTile[]): void {
  const validKeys = new Set(tiles.map((tile) => `tile:${tile.position}`));
  disposeMissing(runtime, "tile:", validKeys);
  for (const tile of tiles) {
    const key = `tile:${tile.position}`;
    let node = runtime.nodes.get(key) as Mesh | undefined;
    if (!node) {
      node = MeshBuilder.CreateBox(key, { width: 0.84, depth: 0.84, height: 0.18 }, runtime.scene);
      const material = new StandardMaterial(`${key}-material`, runtime.scene);
      const content = tileContent.get(tile.position);
      material.diffuseColor = Color3.FromHexString(
        cityColors.get(content?.cityKey ?? "") ?? "#75C7B5",
      );
      material.specularColor = new Color3(0.12, 0.12, 0.1);
      node.material = material;
      node.metadata = { selection: { kind: "tile", position: tile.position } };
      runtime.nodes.set(key, node);
    }
    node.position.set(tile.x, 0.58, tile.z);
    node.rotation.y = tile.rotationY;
    node.scaling.setAll(tile.scale);
  }
}

function syncProps(runtime: Runtime, props: readonly BoardSceneProp[]): void {
  const validKeys = new Set(props.map((prop) => `prop:${prop.id}`));
  disposeMissing(runtime, "prop:", validKeys);
  for (const prop of props) {
    const key = `prop:${prop.id}`;
    let root = runtime.nodes.get(key);
    if (!root) {
      root = new TransformNode(key, runtime.scene);
      root.metadata = { selection: { kind: "prop", id: prop.id } };
      runtime.nodes.set(key, root);
      const placeholder = MeshBuilder.CreateBox(
        `${key}:loading`,
        { width: 0.7, height: 0.8, depth: 0.7 },
        runtime.scene,
      );
      placeholder.parent = root;
      placeholder.position.y = 0.4;
      placeholder.metadata = root.metadata;
      const material = new StandardMaterial(`${key}:loading-material`, runtime.scene);
      material.diffuseColor = Color3.FromHexString(getSceneAsset(prop.assetId).swatch);
      material.alpha = 0.65;
      placeholder.material = material;
      void loadProp(runtime, root, prop);
    }
    root.position.set(prop.x, prop.y, prop.z);
    root.rotation.y = prop.rotationY;
    root.scaling.setAll(prop.scale);
  }
}

function syncWaterBodies(runtime: Runtime, waterBodies: readonly WorldWaterBody[]): void {
  const validKeys = new Set(waterBodies.map((water) => `water:${water.id}`));
  disposeMissing(runtime, "water:", validKeys);
  for (const water of waterBodies) {
    const key = `water:${water.id}`;
    let mesh = runtime.nodes.get(key) as Mesh | undefined;
    if (!mesh) {
      mesh = MeshBuilder.CreateBox(key, { width: 1, height: 0.08, depth: 1 }, runtime.scene);
      mesh.metadata = { selection: { kind: "water", id: water.id } };
      runtime.nodes.set(key, mesh);
    }
    mesh.position.set(water.x, water.y, water.z);
    mesh.rotation.y = water.rotationY;
    mesh.scaling.set(water.width, 1, water.length);
    const material =
      (mesh.material as StandardMaterial | null) ??
      new StandardMaterial(`${key}-material`, runtime.scene);
    material.diffuseColor = Color3.FromHexString(water.color);
    material.emissiveColor = Color3.FromHexString(water.color).scale(0.16);
    material.specularColor = new Color3(0.8, 0.95, 1);
    material.alpha = 0.87;
    mesh.material = material;
  }
}

function syncRoutes(runtime: Runtime, world: StudioWorld): void {
  const validKeys = new Set(world.routes.map((route) => `route:${route.id}`));
  disposeMissing(runtime, "route:", validKeys);
  const tileMap = new Map(world.scene.tiles.map((tile) => [tile.position, tile]));
  for (const route of world.routes) {
    const from = tileMap.get(route.fromPosition);
    const to = tileMap.get(route.toPosition);
    if (!from || !to) continue;
    const key = `route:${route.id}`;
    const path = [
      new Vector3(from.x, 0.72, from.z),
      new Vector3((from.x + to.x) / 2, 0.72, (from.z + to.z) / 2),
      new Vector3(to.x, 0.72, to.z),
    ];
    let mesh = runtime.nodes.get(key) as Mesh | undefined;
    mesh = MeshBuilder.CreateTube(
      key,
      {
        path,
        radius: route.mode === "car" ? 0.1 : 0.055,
        tessellation: 8,
        cap: Mesh.CAP_ALL,
        ...(mesh ? { instance: mesh } : {}),
      },
      runtime.scene,
    );
    mesh.metadata = { selection: { kind: "route", id: route.id } };
    const material =
      (mesh.material as StandardMaterial | null) ??
      new StandardMaterial(`${key}-material`, runtime.scene);
    material.diffuseColor = routeColor(route);
    material.emissiveColor = routeColor(route).scale(0.28);
    mesh.material = material;
    runtime.nodes.set(key, mesh);
  }
}

function syncVehicles(runtime: Runtime, vehicles: readonly WorldVehicle[]): void {
  const validKeys = new Set(vehicles.map((vehicle) => `vehicle:${vehicle.id}`));
  disposeMissing(runtime, "vehicle:", validKeys);
  for (const vehicle of vehicles) {
    const key = `vehicle:${vehicle.id}`;
    let root = runtime.nodes.get(key);
    if (!root) {
      root = new TransformNode(key, runtime.scene);
      root.metadata = { selection: { kind: "vehicle", id: vehicle.id } };
      runtime.nodes.set(key, root);
      const placeholder = MeshBuilder.CreateBox(
        `${key}:loading`,
        { width: 1.5, height: 0.55, depth: 0.85 },
        runtime.scene,
      );
      placeholder.parent = root;
      placeholder.position.y = 0.28;
      placeholder.metadata = root.metadata;
      const material = new StandardMaterial(`${key}:loading-material`, runtime.scene);
      material.diffuseColor = Color3.FromHexString(getVehicleAsset(vehicle.assetId).color);
      placeholder.material = material;
      void loadVehicle(runtime, root, vehicle);
    }
    root.position.set(vehicle.x, vehicle.y, vehicle.z);
    root.rotation.y = vehicle.rotationY;
    root.scaling.setAll(vehicle.scale);
  }
}

function syncObjects(
  runtime: Runtime,
  objects: readonly WorldPlacedObject[],
  assets: readonly WorldContentAsset[],
): void {
  const validKeys = new Set(objects.map((object) => `object:${object.id}`));
  disposeMissing(runtime, "object:", validKeys);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  for (const object of objects) {
    const key = `object:${object.id}`;
    const asset = assetMap.get(object.assetId);
    let root = runtime.nodes.get(key);
    if (!root) {
      root = new TransformNode(key, runtime.scene);
      root.metadata = {
        selection: { kind: "object", id: object.id },
        staticMeshSignature: "",
        loadVersion: 0,
      };
      runtime.nodes.set(key, root);
    }
    if (asset) {
      const metadata = root.metadata as {
        selection: StudioSelection;
        staticMeshSignature: string;
        loadVersion: number;
      };
      const signature = JSON.stringify({ staticMesh: asset.staticMesh ?? null, url: asset.url });
      if (metadata.staticMeshSignature !== signature) {
        metadata.staticMeshSignature = signature;
        metadata.loadVersion += 1;
        reloadWorldObject(runtime, root, object, asset, metadata.loadVersion);
      }
    }
    root.position.set(object.x, object.y, object.z);
    root.rotation.y = object.rotationY;
    root.scaling.setAll(object.scale);
  }
}

function reloadWorldObject(
  runtime: Runtime,
  root: TransformNode,
  object: WorldPlacedObject,
  asset: WorldContentAsset,
  loadVersion: number,
) {
  for (const child of root.getChildren()) child.dispose(false, true);
  runtime.loading.delete(`object:${object.id}`);
  const placeholder = MeshBuilder.CreateBox(
    `object:${object.id}:loading`,
    { width: 1, height: 1, depth: 1 },
    runtime.scene,
  );
  placeholder.parent = root;
  placeholder.position.y = 0.5;
  placeholder.metadata = root.metadata;
  const material = new StandardMaterial(`object:${object.id}:loading-material`, runtime.scene);
  material.diffuseColor = Color3.FromHexString("#8FA5A3");
  placeholder.material = material;
  void loadWorldObject(runtime, root, object, asset, loadVersion);
}

async function loadProp(
  runtime: Runtime,
  root: TransformNode,
  prop: BoardSceneProp,
): Promise<void> {
  const key = `prop:${prop.id}`;
  if (runtime.loading.has(key)) return;
  runtime.loading.add(key);
  try {
    const asset = getSceneAsset(prop.assetId);
    const result = await SceneLoader.ImportMeshAsync("", asset.root, asset.file, runtime.scene);
    if (runtime.disposed || runtime.nodes.get(key) !== root) {
      for (const mesh of result.meshes) mesh.dispose(false, true);
      return;
    }
    runtime.scene.getMeshByName(`${key}:loading`)?.dispose(false, true);
    for (const mesh of result.meshes) {
      if (!mesh.parent) mesh.parent = root;
      mesh.metadata = root.metadata;
      mesh.isPickable = true;
    }
  } catch (error) {
    console.warn(`Não foi possível carregar ${prop.assetId}`, error);
  } finally {
    runtime.loading.delete(key);
  }
}

async function loadVehicle(
  runtime: Runtime,
  root: TransformNode,
  vehicle: WorldVehicle,
): Promise<void> {
  const key = `vehicle:${vehicle.id}`;
  if (runtime.loading.has(key)) return;
  runtime.loading.add(key);
  try {
    const asset = getVehicleAsset(vehicle.assetId);
    const result = await SceneLoader.ImportMeshAsync("", asset.root, asset.file, runtime.scene);
    if (runtime.disposed || runtime.nodes.get(key) !== root) {
      for (const mesh of result.meshes) mesh.dispose(false, true);
      return;
    }
    runtime.scene.getMeshByName(`${key}:loading`)?.dispose(false, true);
    for (const mesh of result.meshes) {
      if (!mesh.parent) mesh.parent = root;
      mesh.metadata = root.metadata;
      mesh.isPickable = true;
    }
  } catch (error) {
    console.warn(`Não foi possível carregar o veículo ${vehicle.assetId}`, error);
  } finally {
    runtime.loading.delete(key);
  }
}

async function loadWorldObject(
  runtime: Runtime,
  root: TransformNode,
  object: WorldPlacedObject,
  asset: WorldContentAsset,
  loadVersion: number,
): Promise<void> {
  const key = `object:${object.id}`;
  if (runtime.loading.has(key)) return;
  runtime.loading.add(key);
  try {
    const slash = asset.url.lastIndexOf("/");
    const assetRoot = slash >= 0 ? asset.url.slice(0, slash + 1) : "/";
    const assetFile = slash >= 0 ? asset.url.slice(slash + 1) : asset.url;
    const result = await SceneLoader.ImportMeshAsync("", assetRoot, assetFile, runtime.scene);
    const metadata = root.metadata as { loadVersion?: number };
    if (
      runtime.disposed ||
      runtime.nodes.get(key) !== root ||
      metadata.loadVersion !== loadVersion
    ) {
      for (const mesh of result.meshes) mesh.dispose(false, true);
      return;
    }
    runtime.scene.getMeshByName(`${key}:loading`)?.dispose(false, true);
    for (const mesh of result.meshes) {
      if (!mesh.parent) mesh.parent = root;
      mesh.metadata = root.metadata;
      mesh.isPickable = true;
      if (mesh instanceof Mesh) applyStaticMeshSettings(runtime.scene, mesh, asset);
    }
  } catch (error) {
    console.warn(`Não foi possível carregar ${asset.name}`, error);
  } finally {
    runtime.loading.delete(key);
  }
}

function applyStaticMeshSettings(scene: Scene, mesh: Mesh, asset: WorldContentAsset) {
  const settings = asset.staticMesh;
  if (!settings) return;
  mesh.receiveShadows = settings.receiveShadow;
  mesh.checkCollisions = settings.collision !== "none";
  mesh.metadata = {
    ...(mesh.metadata as Record<string, unknown>),
    collision: settings.collision,
    castShadow: settings.castShadow,
    mobility: "static",
  };
  const override = settings.materialOverride;
  if (!override) return;
  const material = new PBRMaterial(`${mesh.name}:material-override`, scene);
  material.albedoColor = Color3.FromHexString(override.baseColor);
  material.emissiveColor = Color3.FromHexString(override.emissiveColor);
  material.metallic = override.metallic;
  material.roughness = override.roughness;
  if (override.baseColorTextureUrl.trim()) {
    material.albedoTexture = new Texture(override.baseColorTextureUrl.trim(), scene);
  }
  mesh.material = material;
}

function disposeMissing(runtime: Runtime, prefix: string, validKeys: ReadonlySet<string>): void {
  for (const [key, node] of runtime.nodes) {
    if (!key.startsWith(prefix) || validKeys.has(key)) continue;
    node.dispose(false, true);
    runtime.nodes.delete(key);
  }
}

function updateLandscapeMesh(
  terrainMesh: Mesh,
  world: StudioWorld,
  landscape: WorldLandscape,
): void {
  const positions = terrainMesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = terrainMesh.getIndices();
  if (!positions || !indices) return;
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index] ?? 0;
    const z = positions[index + 2] ?? 0;
    positions[index + 1] =
      getLandscapeSurfaceHeight(world.terrain, landscape, x, z) ?? world.terrain.waterLevel;
  }
  const normals = new Array<number>(positions.length).fill(0);
  VertexData.ComputeNormals(positions, indices, normals);
  terrainMesh.updateVerticesData(VertexBuffer.PositionKind, positions);
  terrainMesh.updateVerticesData(VertexBuffer.NormalKind, normals);
  terrainMesh.refreshBoundingInfo();
}

function updateLandscapeBrushCursor(
  runtime: Runtime,
  active: boolean,
  radius: number,
  point: Vector3 | null,
): void {
  if (!active || !point) {
    runtime.landscapeBrush.setEnabled(false);
    return;
  }
  runtime.landscapeBrush.position.set(point.x, point.y + 0.08, point.z);
  runtime.landscapeBrush.scaling.set(radius, 1, radius);
  runtime.landscapeBrush.setEnabled(true);
}

function applyLandscapeBrush(
  runtime: Runtime,
  world: StudioWorld,
  point: Vector3,
  tool: LandscapeSculptTool | null,
  radius: number,
  strength: number,
): void {
  const landscape = runtime.sculptLandscape;
  if (!tool || !landscape) return;
  const cellSize = Math.min(
    landscape.width / landscape.resolution,
    landscape.depth / landscape.resolution,
  );
  if (
    Number.isFinite(runtime.lastSculptX) &&
    Math.hypot(point.x - runtime.lastSculptX, point.z - runtime.lastSculptZ) < cellSize * 0.2
  ) {
    return;
  }
  runtime.lastSculptX = point.x;
  runtime.lastSculptZ = point.z;
  runtime.sculptLandscape = sculptLandscape(landscape, {
    tool,
    x: point.x,
    z: point.z,
    radius,
    strength,
  });
  const mesh = runtime.scene.getMeshByName("world-terrain");
  if (mesh instanceof Mesh) updateLandscapeMesh(mesh, world, runtime.sculptLandscape);
}

function studioSelectionKey(selection: StudioSelection): string {
  if (selection.kind === "tile") return `tile:${selection.position}`;
  return `${selection.kind}:${selection.id}`;
}

function attachSelection(runtime: Runtime, selections: readonly StudioSelection[]): void {
  detachSelectionGroup(runtime);
  runtime.highlight.removeAllMeshes();
  const entries: Array<{ selection: StudioSelection; node: TransformNode }> = [];
  for (const selection of selections) {
    if (selection.kind === "route") continue;
    const node =
      selection.kind === "landscape"
        ? runtime.scene.getMeshByName("world-terrain")
        : runtime.nodes.get(studioSelectionKey(selection));
    if (node) entries.push({ selection, node });
  }
  const transformEntries = entries.filter((entry) => entry.selection.kind !== "landscape");
  let target: TransformNode | null = transformEntries[0]?.node ?? null;
  if (transformEntries.length > 1) {
    const center = transformEntries
      .reduce((total, entry) => total.addInPlace(entry.node.getAbsolutePosition()), Vector3.Zero())
      .scale(1 / transformEntries.length);
    const pivot = runtime.selectionPivot;
    pivot.position.copyFrom(center);
    pivot.rotation.setAll(0);
    pivot.scaling.setAll(1);
    pivot.setEnabled(true);
    for (const { node } of transformEntries) node.setParent(pivot, true);
    runtime.groupNodes = transformEntries.map((entry) => entry.node);
    target = pivot;
  }
  const active = selections.at(-1);
  const activeKey = active ? studioSelectionKey(active) : "";
  for (const { node, selection } of entries) {
    const color = Color3.FromHexString(
      studioSelectionKey(selection) === activeKey ? "#FFD05A" : "#59BFEA",
    );
    for (const mesh of node.getChildMeshes(false)) {
      if (mesh instanceof Mesh) runtime.highlight.addMesh(mesh, color);
    }
    if (node instanceof Mesh) runtime.highlight.addMesh(node, color);
  }
  runtime.gizmos.attachToNode(target);
  runtime.freeMoveTarget = target;
  runtime.freeMoveHandle.setEnabled(Boolean(target) && runtime.gizmos.positionGizmoEnabled);
}

function detachSelectionGroup(runtime: Runtime): void {
  if (runtime.groupNodes.length === 0) return;
  runtime.gizmos.attachToNode(null);
  runtime.freeMoveTarget = null;
  for (const node of runtime.groupNodes) {
    if (!node.isDisposed() && node.parent === runtime.selectionPivot) node.setParent(null, true);
  }
  runtime.groupNodes = [];
  runtime.selectionPivot.setEnabled(false);
  runtime.selectionPivot.position.setAll(0);
  runtime.selectionPivot.rotation.setAll(0);
  runtime.selectionPivot.scaling.setAll(1);
}

function collectSelectionTransforms(
  runtime: Runtime,
  selections: readonly StudioSelection[],
): StudioSelectionTransform[] {
  const transforms: StudioSelectionTransform[] = [];
  for (const selection of selections) {
    if (selection.kind === "route") continue;
    const node = runtime.nodes.get(studioSelectionKey(selection));
    if (!node) continue;
    node.computeWorldMatrix(true);
    const scale = Vector3.One();
    const rotation = Quaternion.Identity();
    const position = Vector3.Zero();
    node.getWorldMatrix().decompose(scale, rotation, position);
    transforms.push({
      selection,
      patch: {
        x: round(position.x),
        y: round(position.y),
        z: round(position.z),
        rotationY: round(rotation.toEulerAngles().y),
        scale: round(scale.x),
        width: round(scale.x),
        length: round(scale.z),
      },
    });
  }
  return transforms;
}

function routeColor(route: WorldRoute): Color3 {
  if (route.mode === "car") return Color3.FromHexString("#F2B84B");
  if (route.mode === "boat") return Color3.FromHexString("#5CBFE0");
  return Color3.FromHexString("#A8E1D3");
}

function focusSelection(runtime: Runtime, selections: readonly StudioSelection[]): void {
  const positions = selections
    .filter((selection) => selection.kind !== "route")
    .map((selection) => runtime.nodes.get(studioSelectionKey(selection))?.getAbsolutePosition())
    .filter((position): position is Vector3 => Boolean(position));
  if (positions.length === 0) return;
  const center = positions
    .reduce((total, position) => total.addInPlace(position), Vector3.Zero())
    .scale(1 / positions.length);
  runtime.camera.target.copyFrom(center);
  runtime.camera.radius = Math.min(18, Math.max(4, runtime.camera.radius * 0.55));
}

function updateFreeMoveHandle(runtime: Runtime): void {
  const target = runtime.freeMoveTarget;
  if (!target || !runtime.freeMoveHandle.isEnabled()) return;
  const position = target.getAbsolutePosition();
  runtime.freeMoveHandle.position.copyFrom(position);
  const distance = Vector3.Distance(runtime.camera.position, position);
  const scale = Math.min(2.4, Math.max(0.65, distance * 0.038));
  runtime.freeMoveHandle.scaling.setAll(scale);
}

function updateCameraFlight(runtime: Runtime): void {
  if (runtime.keys.size === 0) return;
  const delta = Math.min(0.05, runtime.engine.getDeltaTime() / 1000);
  const amount = runtime.cameraSpeed * delta;
  const forward = runtime.camera.target.subtract(runtime.camera.position);
  forward.y = 0;
  if (forward.lengthSquared() < 0.0001) return;
  forward.normalize();
  const right = new Vector3(forward.z, 0, -forward.x);
  const movement = Vector3.Zero();
  if (runtime.keys.has("w")) movement.addInPlace(forward.scale(amount));
  if (runtime.keys.has("s")) movement.addInPlace(forward.scale(-amount));
  if (runtime.keys.has("d")) movement.addInPlace(right.scale(amount));
  if (runtime.keys.has("a")) movement.addInPlace(right.scale(-amount));
  if (runtime.keys.has("e")) movement.y += amount;
  if (runtime.keys.has("q")) movement.y -= amount;
  runtime.camera.target.addInPlace(movement);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
