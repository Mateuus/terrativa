import "@babylonjs/loaders/glTF";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  type Mesh,
  PBRMaterial,
  Scene,
  SceneLoader,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { useEffect, useState } from "react";
import type { WorldContentAsset } from "./worldModel";

const thumbnailCache = new Map<string, Promise<string | null>>();
let renderQueue = Promise.resolve();
let thumbnailEngine: Engine | null = null;
let thumbnailCanvas: HTMLCanvasElement | null = null;

export function StaticMeshThumbnail({ asset }: { readonly asset: WorldContentAsset }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    void requestThumbnail(asset).then((value) => {
      if (!active) return;
      setThumbnail(value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [asset]);

  if (thumbnail) {
    return (
      <img alt={`Prévia 3D de ${asset.name}`} className="static-mesh-thumbnail" src={thumbnail} />
    );
  }
  return (
    <span className={`static-mesh-thumbnail-fallback ${loaded ? "is-fallback" : "is-loading"}`}>
      {loaded ? "◇" : ""}
    </span>
  );
}

function requestThumbnail(asset: WorldContentAsset): Promise<string | null> {
  const cacheKey = `${asset.url}:${JSON.stringify(asset.staticMesh?.materialOverride ?? null)}`;
  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;
  const pending = new Promise<string | null>((resolve) => {
    renderQueue = renderQueue
      .then(async () => resolve(await renderThumbnail(asset)))
      .catch(() => resolve(null));
  });
  thumbnailCache.set(cacheKey, pending);
  return pending;
}

async function renderThumbnail(asset: WorldContentAsset): Promise<string | null> {
  if (
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    typeof window.WebGLRenderingContext === "undefined"
  ) {
    return null;
  }
  const { canvas, engine } = getThumbnailRuntime();
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#17232B00");
  const camera = new ArcRotateCamera(
    "thumbnail-camera",
    -Math.PI * 0.72,
    Math.PI * 0.34,
    4,
    Vector3.Zero(),
    scene,
  );
  const ambient = new HemisphericLight("thumbnail-ambient", new Vector3(0.2, 1, 0.1), scene);
  ambient.intensity = 1.1;
  const key = new DirectionalLight("thumbnail-key", new Vector3(-0.5, -1, 0.45), scene);
  key.position = new Vector3(4, 7, -5);
  key.intensity = 1.4;
  try {
    const { filename, rootUrl } = splitAssetUrl(asset.url);
    const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);
    const meshes = result.meshes as Mesh[];
    const override = asset.staticMesh?.materialOverride;
    if (override) {
      const material = new PBRMaterial("thumbnail-material-override", scene);
      material.albedoColor = Color3.FromHexString(override.baseColor);
      material.emissiveColor = Color3.FromHexString(override.emissiveColor);
      material.metallic = override.metallic;
      material.roughness = override.roughness;
      if (override.baseColorTextureUrl.trim()) {
        material.albedoTexture = new Texture(override.baseColorTextureUrl.trim(), scene);
      }
      for (const mesh of meshes) {
        if (mesh.getTotalVertices() > 0) mesh.material = material;
      }
    }
    frameMeshes(camera, meshes);
    await scene.whenReadyAsync();
    scene.render();
    scene.render();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    scene.dispose();
  }
}

function getThumbnailRuntime(): { canvas: HTMLCanvasElement; engine: Engine } {
  if (!thumbnailCanvas) {
    thumbnailCanvas = document.createElement("canvas");
    thumbnailCanvas.width = 180;
    thumbnailCanvas.height = 140;
  }
  if (!thumbnailEngine) {
    thumbnailEngine = new Engine(thumbnailCanvas, true, {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      stencil: true,
    });
  }
  return { canvas: thumbnailCanvas, engine: thumbnailEngine };
}

export function frameMeshes(camera: ArcRotateCamera, meshes: readonly Mesh[]): void {
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
  let hasGeometry = false;
  for (const mesh of meshes) {
    if (mesh.getTotalVertices() === 0) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, box.minimumWorld);
    maximum = Vector3.Maximize(maximum, box.maximumWorld);
    hasGeometry = true;
  }
  if (!hasGeometry) return;
  const center = minimum.add(maximum).scale(0.5);
  const radius = Math.max(0.35, maximum.subtract(minimum).length() * 0.5);
  camera.setTarget(center);
  camera.radius = radius * 2.75;
  camera.minZ = Math.max(0.01, radius / 100);
  camera.maxZ = Math.max(100, radius * 20);
}

function splitAssetUrl(url: string): { rootUrl: string; filename: string } {
  const separator = url.lastIndexOf("/");
  return separator < 0
    ? { rootUrl: "", filename: url }
    : { rootUrl: url.slice(0, separator + 1), filename: url.slice(separator + 1) };
}
