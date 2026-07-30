import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Scene } from "@babylonjs/core/scene.js";
import "@babylonjs/loaders/glTF/index.js";
import { useEffect, useRef, useState } from "react";
import { characterAssetLocation } from "./characterAssets";

interface CharacterPicker3DProps {
  readonly accentColor: string;
  readonly label: string;
  readonly pawnKey: string;
}

interface LoadedPreview {
  readonly animations: readonly AnimationGroup[];
  readonly root: TransformNode;
}

const fallbackPalettes = [
  ["#5AC8B5", "#173D4A", "#F3C79D"],
  ["#E08A67", "#583B55", "#DDA57E"],
  ["#E2B84C", "#264D58", "#F1C5A0"],
  ["#8D76D8", "#352E57", "#DCA27D"],
  ["#58A8D1", "#17384C", "#E9B88D"],
] as const;

export function CharacterPicker3D({ accentColor, label, pawnKey }: CharacterPicker3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const previewRef = useRef<LoadedPreview | null>(null);
  const loadVersionRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
    });
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.4));

    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#071D25FF");
    scene.ambientColor = Color3.FromHexString("#2C5660");
    sceneRef.current = scene;

    const camera = new ArcRotateCamera(
      "character-picker-camera",
      -Math.PI / 2,
      Math.PI / 2.35,
      4.25,
      new Vector3(0, 1.25, 0),
      scene,
    );
    camera.lowerRadiusLimit = 3.5;
    camera.upperRadiusLimit = 5.2;
    camera.lowerBetaLimit = 0.82;
    camera.upperBetaLimit = 1.5;
    camera.wheelPrecision = 80;
    camera.pinchPrecision = 100;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);

    const sky = new HemisphericLight("character-picker-sky", new Vector3(-0.2, 1, 0.1), scene);
    sky.intensity = 1.7;
    sky.groundColor = Color3.FromHexString("#123943");
    const key = new DirectionalLight("character-picker-key", new Vector3(-0.7, -1, 0.45), scene);
    key.intensity = 2.6;

    const platformMaterial = material(scene, "character-picker-platform", "#123B47");
    platformMaterial.emissiveColor = Color3.FromHexString("#082731");
    const platform = CreateCylinder(
      "character-picker-platform",
      { diameter: 2.55, height: 0.16, tessellation: 64 },
      scene,
    );
    platform.material = platformMaterial;

    const ringMaterial = material(scene, "character-picker-ring", accentColor);
    ringMaterial.emissiveColor = Color3.FromHexString(accentColor).scale(0.42);
    const ring = CreateTorus(
      "character-picker-ring",
      { diameter: 2.38, thickness: 0.045, tessellation: 64 },
      scene,
    );
    ring.position.y = 0.1;
    ring.material = ringMaterial;

    scene.onBeforeRenderObservable.add(() => {
      const root = previewRef.current?.root;
      if (root) root.rotation.y += engine.getDeltaTime() * 0.00018;
      ring.rotation.y -= engine.getDeltaTime() * 0.00025;
    });

    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      disposePreview(previewRef.current);
      previewRef.current = null;
      sceneRef.current = null;
      scene.dispose();
      engine.dispose();
    };
  }, [accentColor]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const version = ++loadVersionRef.current;
    disposePreview(previewRef.current);
    previewRef.current = null;
    setLoading(true);
    setUsingFallback(false);
    const asset = characterAssetLocation(pawnKey);

    const finishWithFallback = () => {
      if (version !== loadVersionRef.current || scene.isDisposed) return;
      previewRef.current = createFallbackCharacter(scene, pawnKey, accentColor);
      setUsingFallback(true);
      setLoading(false);
    };

    if (!asset) {
      finishWithFallback();
      return;
    }

    void SceneLoader.ImportMeshAsync("", asset.root, asset.file, scene)
      .then((result) => {
        if (version !== loadVersionRef.current || scene.isDisposed) {
          result.animationGroups.forEach((animation) => {
            animation.dispose();
          });
          result.meshes.forEach((mesh) => {
            mesh.dispose(false, true);
          });
          return;
        }

        const root = new TransformNode(`character-preview-${pawnKey}`, scene);
        result.meshes
          .filter((mesh) => !mesh.parent)
          .forEach((mesh) => {
            mesh.parent = root;
          });
        frameCharacter(root, result.meshes);
        root.rotation.y = Math.PI;
        const idle =
          result.animationGroups.find((animation) =>
            animation.name.toLocaleLowerCase().includes("idle"),
          ) ?? result.animationGroups[0];
        idle?.start(true, 1, idle.from, idle.to, false);
        previewRef.current = { animations: result.animationGroups, root };
        setLoading(false);
      })
      .catch(() => finishWithFallback());

    return () => {
      loadVersionRef.current += 1;
    };
  }, [accentColor, pawnKey]);

  return (
    <div className="character-preview">
      <canvas
        aria-label={`Prévia 3D de ${label}. Arraste para girar.`}
        ref={canvasRef}
        role="img"
      />
      <div
        aria-live="polite"
        className={`character-preview__loading ${loading ? "" : "is-hidden"}`}
      >
        <span />
        Carregando personagem 3D
      </div>
      {usingFallback && (
        <small className="character-preview__fallback">
          Prévia estilizada · modelo modular em preparação
        </small>
      )}
    </div>
  );
}

function frameCharacter(root: TransformNode, meshes: readonly AbstractMesh[]) {
  const visibleMeshes = meshes.filter((mesh) => mesh.getTotalVertices() > 0);
  if (visibleMeshes.length === 0) return;

  let minimum = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  let maximum = new Vector3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  );
  visibleMeshes.forEach((mesh) => {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
    maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
  });
  const height = Math.max(0.01, maximum.y - minimum.y);
  const scale = Math.min(1.35, 2.55 / height);
  const center = minimum.add(maximum).scale(0.5);
  root.scaling.setAll(scale);
  root.position.set(-center.x * scale, 0.1 - minimum.y * scale, -center.z * scale);
}

function createFallbackCharacter(
  scene: Scene,
  pawnKey: string,
  accentColor: string,
): LoadedPreview {
  const variant = Number.parseInt(pawnKey.match(/(\d+)$/)?.[1] ?? "1", 10);
  const palette = fallbackPalettes[(variant - 1) % fallbackPalettes.length] ?? fallbackPalettes[0];
  const root = new TransformNode(`fallback-${pawnKey}`, scene);
  const outfit = material(scene, `fallback-outfit-${pawnKey}`, palette[0]);
  const dark = material(scene, `fallback-dark-${pawnKey}`, palette[1]);
  const skin = material(scene, `fallback-skin-${pawnKey}`, palette[2]);
  const accent = material(scene, `fallback-accent-${pawnKey}`, accentColor);
  accent.emissiveColor = Color3.FromHexString(accentColor).scale(0.18);

  const addPart = (
    name: string,
    diameterTop: number,
    diameterBottom: number,
    height: number,
    position: Vector3,
    partMaterial: StandardMaterial,
    rotationZ = 0,
  ) => {
    const part = CreateCylinder(
      `${name}-${pawnKey}`,
      { diameterTop, diameterBottom, height, tessellation: 14 },
      scene,
    );
    part.parent = root;
    part.position.copyFrom(position);
    part.rotation.z = rotationZ;
    part.material = partMaterial;
  };

  addPart("body", 0.48, 0.68, 0.86, new Vector3(0, 1.55, 0), outfit);
  addPart("left-leg", 0.22, 0.26, 0.72, new Vector3(-0.2, 0.74, 0), dark, -0.04);
  addPart("right-leg", 0.22, 0.26, 0.72, new Vector3(0.2, 0.74, 0), dark, 0.04);
  addPart("left-arm", 0.18, 0.21, 0.73, new Vector3(-0.48, 1.48, 0), skin, -0.18);
  addPart("right-arm", 0.18, 0.21, 0.73, new Vector3(0.48, 1.48, 0), skin, 0.18);
  addPart("belt", 0.7, 0.7, 0.13, new Vector3(0, 1.18, 0), accent);

  const head = CreateSphere(`head-${pawnKey}`, { diameter: 0.66, segments: 16 }, scene);
  head.parent = root;
  head.position.set(0, 2.22, 0);
  head.scaling.y = 1.08;
  head.material = skin;
  const hair = CreateSphere(`hair-${pawnKey}`, { diameter: 0.7, segments: 16 }, scene);
  hair.parent = root;
  hair.position.set(0, 2.38, 0.04);
  hair.scaling.set(1.03, 0.62 + (variant % 3) * 0.1, 1.03);
  hair.material = dark;

  root.rotation.y = Math.PI;
  return { animations: [], root };
}

function disposePreview(preview: LoadedPreview | null) {
  if (!preview) return;
  preview.animations.forEach((animation) => {
    animation.dispose();
  });
  preview.root.getChildMeshes().forEach((mesh) => {
    mesh.dispose(false, true);
  });
  preview.root.dispose(false, true);
}

function material(scene: Scene, name: string, color: string) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = Color3.FromHexString(color);
  value.specularColor = Color3.FromHexString("#C5F7F0").scale(0.18);
  return value;
}
