import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreatePolyhedron } from "@babylonjs/core/Meshes/Builders/polyhedronBuilder.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { Scene } from "@babylonjs/core/scene.js";
import type { BoardContent } from "@terrativa/board-content";
import { useEffect, useRef } from "react";

function material(scene: Scene, name: string, color: Color3) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = color;
  value.specularColor = Color3.Black();
  return value;
}

function createBoard(scene: Scene, content: BoardContent) {
  const board = new Mesh("board-root", scene);
  const sand = material(scene, "sand", Color3.FromHexString("#D8C59D"));
  const dark = material(scene, "board-edge", Color3.FromHexString("#123742"));
  const green = material(scene, "island", Color3.FromHexString("#6C9B68"));
  const trunk = material(scene, "trunk", Color3.FromHexString("#875D45"));

  const base = CreateBox("board-base", { width: 12.8, depth: 12.8, height: 0.45 }, scene);
  base.material = dark;
  base.parent = board;

  const inset = CreateBox("board-inset", { width: 11.9, depth: 11.9, height: 0.28 }, scene);
  inset.position.y = 0.35;
  inset.material = sand;
  inset.parent = board;

  const positions = Array.from({ length: content.tileCount }, (_, index) =>
    perimeterPosition(index, content.tileCount, 5.25),
  );
  const sourceColors =
    content.groups.length > 0
      ? content.groups.map((group) => group.color)
      : content.cities.map((city) => city.accentColor);
  const tileMaterials = sourceColors.map((color, index) =>
    material(scene, `tile-${index}`, Color3.FromHexString(color)),
  );

  positions.forEach(([x, z], index) => {
    const corner = Math.abs(((index / content.tileCount) * 4) % 1) < 0.01;
    const tile = CreateBox(
      `space-${index}`,
      {
        width: corner ? 1.08 : 0.95,
        depth: corner ? 1.08 : 0.95,
        height: 0.16 + (index % 3) * 0.035,
      },
      scene,
    );
    tile.position.set(x, 0.62, z);
    tile.material = tileMaterials[index % Math.max(1, tileMaterials.length)] ?? sand;
    tile.parent = board;
  });

  const island = CreateCylinder("island", { diameter: 6.3, height: 0.34, tessellation: 10 }, scene);
  island.position.y = 0.63;
  island.scaling.z = 0.7;
  island.rotation.y = 0.2;
  island.material = green;
  island.parent = board;

  const buildings = [
    [-1.6, 1.2, 1.2, 1.8, "#F0D2A0"],
    [-0.25, 1.35, 1.0, 2.4, "#E57F69"],
    [1.25, 0.95, 1.15, 1.5, "#F4E5C3"],
    [0.3, -1.25, 1.45, 1.1, "#5B8EA1"],
  ] as const;

  buildings.forEach(([x, z, width, height, color], index) => {
    const building = CreateBox(`building-${index}`, { width, depth: width * 0.72, height }, scene);
    building.position.set(x, 0.8 + height / 2, z);
    building.rotation.y = index * 0.17;
    building.material = material(scene, `building-material-${index}`, Color3.FromHexString(color));
    building.parent = board;
  });

  const treePositions = [
    [-2.25, -1.35],
    [-1.7, -1.7],
    [1.8, 1.45],
    [2.15, 0.75],
  ] as const;

  treePositions.forEach(([x, z], index) => {
    const stem = CreateCylinder(
      `tree-stem-${index}`,
      { diameter: 0.18, height: 0.65, tessellation: 6 },
      scene,
    );
    stem.position.set(x, 1.25, z);
    stem.material = trunk;
    stem.parent = board;

    const crown = CreatePolyhedron(`tree-crown-${index}`, { type: 2, size: 0.55 }, scene);
    crown.position.set(x, 1.75, z);
    crown.material = green;
    crown.parent = board;
  });

  board.rotation.y = -0.15;
  return board;
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

interface GameCanvasProps {
  readonly board: BoardContent;
}

export function GameCanvas({ board }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
    });
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));

    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#07181FFF");

    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 3.8,
      Math.PI / 3.15,
      19,
      new Vector3(0.8, 0.3, 0),
      scene,
    );
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 24;
    camera.lowerBetaLimit = 0.62;
    camera.upperBetaLimit = 1.28;
    camera.wheelPrecision = 35;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);

    const sky = new HemisphericLight("sky", new Vector3(0.2, 1, 0.1), scene);
    sky.intensity = 1.35;
    sky.groundColor = Color3.FromHexString("#164A52");

    const sun = new DirectionalLight("sun", new Vector3(-0.45, -1, 0.35), scene);
    sun.intensity = 2.4;

    const boardMesh = createBoard(scene, board);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scene.onBeforeRenderObservable.add(() => {
      if (!reduceMotion) boardMesh.rotation.y += engine.getDeltaTime() * 0.000018;
    });

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);
    engine.runRenderLoop(() => scene.render());

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, [board]);

  return (
    <canvas aria-label={`Prévia 3D de ${board.name}`} className="game-canvas" ref={canvasRef} />
  );
}
