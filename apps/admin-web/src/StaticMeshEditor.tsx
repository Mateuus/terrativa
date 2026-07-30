import "@babylonjs/loaders/glTF";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { useEffect, useRef, useState } from "react";
import { frameMeshes } from "./StaticMeshThumbnail";
import {
  createDefaultStaticMeshSettings,
  type StudioWorld,
  type WorldContentAsset,
  type WorldStaticMeshMaterialOverride,
  type WorldStaticMeshSettings,
} from "./worldModel";

interface StaticMeshEditorProps {
  readonly asset: WorldContentAsset;
  readonly readOnly: boolean;
  readonly world: StudioWorld;
  readonly onAddToScene: () => void;
  readonly onClose: () => void;
  readonly onDuplicateToContent: () => void;
  readonly onUpdate: (asset: WorldContentAsset) => void;
}

interface MeshStats {
  readonly meshes: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly materials: number;
}

const defaultMaterial: WorldStaticMeshMaterialOverride = {
  baseColor: "#ffffff",
  metallic: 0,
  roughness: 0.72,
  emissiveColor: "#000000",
  baseColorTextureUrl: "",
};

export function StaticMeshEditor({
  asset,
  onAddToScene,
  onClose,
  onDuplicateToContent,
  onUpdate,
  readOnly,
  world,
}: StaticMeshEditorProps) {
  const settings = asset.staticMesh ?? createDefaultStaticMeshSettings();
  const material = settings.materialOverride ?? defaultMaterial;
  const [stats, setStats] = useState<MeshStats>({
    meshes: 0,
    vertices: 0,
    triangles: 0,
    materials: 0,
  });
  const textureAssets = world.contentAssets.filter((candidate) => candidate.kind === "texture");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function updateSettings(patch: Partial<WorldStaticMeshSettings>) {
    if (readOnly) return;
    onUpdate({ ...asset, staticMesh: { ...settings, ...patch } });
  }

  function updateMaterial(patch: Partial<WorldStaticMeshMaterialOverride>) {
    updateSettings({ materialOverride: { ...material, ...patch } });
  }

  function clearMaterialOverride() {
    if (readOnly) return;
    const { materialOverride: _materialOverride, ...restored } = settings;
    onUpdate({ ...asset, staticMesh: restored });
  }

  return (
    <section
      aria-label={`Editor da malha estática ${asset.name}`}
      aria-modal="true"
      className="static-mesh-editor"
      role="dialog"
    >
      <header className="mesh-editor-titlebar">
        <span className="mesh-editor-logo">◆</span>
        <div>
          <small>MALHA ESTÁTICA</small>
          <strong>{asset.name}</strong>
        </div>
        <span className={`mesh-editor-origin ${readOnly ? "is-engine" : "is-content"}`}>
          {readOnly ? "ENGINE · SOMENTE LEITURA" : "CONTEÚDO DO MUNDO"}
        </span>
        {readOnly && (
          <button className="mesh-editor-copy" onClick={onDuplicateToContent} type="button">
            Duplicar em Conteúdo
          </button>
        )}
        <button className="mesh-editor-add" onClick={onAddToScene} type="button">
          ＋ Adicionar à cena
        </button>
        <button
          aria-label="Fechar editor"
          className="mesh-editor-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>

      <nav className="mesh-editor-menubar" aria-label="Menu do Editor de Malha">
        <button type="button">Arquivo</button>
        <button type="button">Editar</button>
        <button type="button">Recurso</button>
        <button type="button">Colisão</button>
        <button type="button">Janela</button>
        <button type="button">Ferramentas</button>
        <button type="button">Ajuda</button>
      </nav>

      <div className="mesh-editor-toolbar">
        <button type="button">Perspectiva⌄</button>
        <button type="button">Iluminado⌄</button>
        <button type="button">◉ Exposição</button>
        <button type="button">LOD automático⌄</button>
        <span />
        <strong>{asset.url.split("/").at(-1)}</strong>
      </div>

      <div className="mesh-editor-workspace">
        <div className="mesh-editor-viewport">
          <StaticMeshViewport asset={asset} onStats={setStats} settings={settings} />
          <div className="mesh-editor-stats">
            <strong>{asset.name}</strong>
            <span>Tipo: Malha Estática</span>
            <span>Malhas: {stats.meshes.toLocaleString("pt-BR")}</span>
            <span>Vértices: {stats.vertices.toLocaleString("pt-BR")}</span>
            <span>Triângulos: {stats.triangles.toLocaleString("pt-BR")}</span>
            <span>Materiais: {stats.materials.toLocaleString("pt-BR")}</span>
            <span>Colisão: {collisionLabel(settings.collision)}</span>
          </div>
          <div className="mesh-editor-axis">
            <i>X</i>
            <i>Y</i>
            <i>Z</i>
          </div>
        </div>

        <aside className="mesh-editor-details">
          <header>
            <strong>Detalhes</strong>
            <input aria-label="Pesquisar detalhes" placeholder="Pesquisar" />
          </header>

          <EditorSection title="Informações da malha">
            <DetailRow label="Tipo" value="Malha Estática" />
            <DetailRow label="Formato" value={asset.mimeType} />
            <DetailRow label="Origem" value={asset.provider} />
            <DetailRow label="Licença" value={asset.license} />
          </EditorSection>

          <EditorSection title="Colisão">
            <label className="mesh-editor-field">
              <span>Complexidade</span>
              <select
                disabled={readOnly}
                value={settings.collision}
                onChange={(event) =>
                  updateSettings({
                    collision: event.target.value as WorldStaticMeshSettings["collision"],
                  })
                }
              >
                <option value="none">Sem colisão</option>
                <option value="box">Caixa simples</option>
                <option value="mesh">Malha complexa</option>
              </select>
            </label>
            <ToggleField
              checked={settings.castShadow}
              disabled={readOnly}
              label="Projetar sombra"
              onChange={(castShadow) => updateSettings({ castShadow })}
            />
            <ToggleField
              checked={settings.receiveShadow}
              disabled={readOnly}
              label="Receber sombra"
              onChange={(receiveShadow) => updateSettings({ receiveShadow })}
            />
          </EditorSection>

          <EditorSection title="Slots de Material">
            <label className="mesh-editor-color">
              <span>Cor base</span>
              <input
                disabled={readOnly}
                type="color"
                value={material.baseColor}
                onChange={(event) => updateMaterial({ baseColor: event.target.value })}
              />
            </label>
            <RangeField
              disabled={readOnly}
              label="Metálico"
              value={material.metallic}
              onChange={(metallic) => updateMaterial({ metallic })}
            />
            <RangeField
              disabled={readOnly}
              label="Rugosidade"
              value={material.roughness}
              onChange={(roughness) => updateMaterial({ roughness })}
            />
            <label className="mesh-editor-color">
              <span>Emissivo</span>
              <input
                disabled={readOnly}
                type="color"
                value={material.emissiveColor}
                onChange={(event) => updateMaterial({ emissiveColor: event.target.value })}
              />
            </label>
            <label className="mesh-editor-field">
              <span>Textura do mundo</span>
              <select
                disabled={readOnly}
                value={material.baseColorTextureUrl}
                onChange={(event) => updateMaterial({ baseColorTextureUrl: event.target.value })}
              >
                <option value="">Sem override de textura</option>
                {textureAssets.map((texture) => (
                  <option key={texture.id} value={texture.url}>
                    {texture.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mesh-editor-field is-stacked">
              <span>URL da textura</span>
              <input
                disabled={readOnly}
                placeholder="/assets/textura.png"
                value={material.baseColorTextureUrl}
                onChange={(event) => updateMaterial({ baseColorTextureUrl: event.target.value })}
              />
            </label>
            <button
              className="mesh-editor-reset"
              disabled={readOnly || !settings.materialOverride}
              onClick={clearMaterialOverride}
              type="button"
            >
              Restaurar materiais originais
            </button>
          </EditorSection>

          {readOnly && (
            <div className="mesh-editor-readonly">
              Assets da Engine são protegidos. Duplique esta malha em Conteúdo para editar material,
              textura e colisão sem alterar o arquivo original.
            </div>
          )}
        </aside>
      </div>

      <footer className="mesh-editor-statusbar">
        <span>Gaveta de Conteúdo</span>
        <span>Malha carregada</span>
        <span>{readOnly ? "Engine protegida" : "Alterações salvas no mundo"}</span>
      </footer>
    </section>
  );
}

function StaticMeshViewport({
  asset,
  onStats,
  settings,
}: {
  readonly asset: WorldContentAsset;
  readonly onStats: (stats: MeshStats) => void;
  readonly settings: WorldStaticMeshSettings;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window.WebGLRenderingContext === "undefined") {
      setState("error");
      return;
    }
    let disposed = false;
    setState("loading");
    const engine = new Engine(canvas, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#9BB9C7FF");
    const camera = new ArcRotateCamera(
      "mesh-editor-camera",
      -Math.PI * 0.72,
      Math.PI * 0.34,
      4,
      Vector3.Zero(),
      scene,
    );
    camera.lowerRadiusLimit = 0.1;
    camera.upperRadiusLimit = 10_000;
    camera.wheelPrecision = 35;
    camera.panningSensibility = 90;
    camera.attachControl(canvas, true);
    const ambient = new HemisphericLight("mesh-editor-ambient", new Vector3(0.2, 1, 0.1), scene);
    ambient.intensity = 0.85;
    ambient.groundColor = Color3.FromHexString("#33424A");
    const sun = new DirectionalLight("mesh-editor-sun", new Vector3(-0.45, -1, 0.35), scene);
    sun.position = new Vector3(8, 12, -10);
    sun.intensity = 1.5;
    createPreviewFloor(scene);

    void loadMesh(scene, camera, asset, settings)
      .then((stats) => {
        if (disposed) return;
        onStats(stats);
        setState("ready");
      })
      .catch(() => {
        if (!disposed) setState("error");
      });

    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      scene.dispose();
      engine.dispose();
    };
  }, [asset, onStats, settings]);

  return (
    <>
      <canvas aria-label={`Visualização 3D de ${asset.name}`} ref={canvasRef} />
      {state !== "ready" && (
        <div className={`mesh-editor-loading is-${state}`}>
          <span />
          <strong>
            {state === "error" ? "Não foi possível abrir a malha" : "Carregando malha 3D"}
          </strong>
        </div>
      )}
    </>
  );
}

async function loadMesh(
  scene: Scene,
  camera: ArcRotateCamera,
  asset: WorldContentAsset,
  settings: WorldStaticMeshSettings,
): Promise<MeshStats> {
  const { filename, rootUrl } = splitAssetUrl(asset.url);
  const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);
  const meshes = result.meshes.filter(
    (candidate): candidate is Mesh => candidate instanceof Mesh && candidate.getTotalVertices() > 0,
  );
  for (const mesh of meshes) mesh.receiveShadows = settings.receiveShadow;
  if (settings.materialOverride) applyMaterialOverride(scene, meshes, settings.materialOverride);
  frameMeshes(camera, meshes);
  await scene.whenReadyAsync();
  const materials = new Set(meshes.map((mesh) => mesh.material).filter(Boolean));
  return {
    meshes: meshes.length,
    vertices: meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0),
    triangles: meshes.reduce(
      (total, mesh) => total + Math.floor((mesh.getTotalIndices() || 0) / 3),
      0,
    ),
    materials: materials.size,
  };
}

function applyMaterialOverride(
  scene: Scene,
  meshes: readonly Mesh[],
  override: WorldStaticMeshMaterialOverride,
) {
  const material = new PBRMaterial("mesh-editor-material-override", scene);
  material.albedoColor = Color3.FromHexString(override.baseColor);
  material.emissiveColor = Color3.FromHexString(override.emissiveColor);
  material.metallic = override.metallic;
  material.roughness = override.roughness;
  if (override.baseColorTextureUrl.trim()) {
    material.albedoTexture = new Texture(override.baseColorTextureUrl.trim(), scene);
  }
  for (const mesh of meshes) mesh.material = material;
}

function createPreviewFloor(scene: Scene) {
  const floor = MeshBuilder.CreateGround(
    "mesh-editor-floor",
    { width: 40, height: 40, subdivisions: 2 },
    scene,
  );
  const material = new StandardMaterial("mesh-editor-floor-material", scene);
  material.diffuseColor = Color3.FromHexString("#71848C");
  material.specularColor = Color3.FromHexString("#202A30");
  floor.material = material;
  floor.isPickable = false;
  const points: Vector3[][] = [];
  for (let index = -20; index <= 20; index += 1) {
    points.push([new Vector3(index, 0.003, -20), new Vector3(index, 0.003, 20)]);
    points.push([new Vector3(-20, 0.003, index), new Vector3(20, 0.003, index)]);
  }
  const grid = MeshBuilder.CreateLineSystem("mesh-editor-grid", { lines: points }, scene);
  grid.color = Color3.FromHexString("#A8BBC1");
  grid.alpha = 0.42;
  grid.isPickable = false;
}

function EditorSection({
  children,
  title,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <section className="mesh-editor-section">
      <h3>⌄ {title}</h3>
      <div>{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="mesh-editor-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ToggleField({
  checked,
  disabled,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="mesh-editor-toggle">
      <span>{label}</span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function RangeField({
  disabled,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  return (
    <label className="mesh-editor-range">
      <span>{label}</span>
      <input
        disabled={disabled}
        max={1}
        min={0}
        step={0.01}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <b>{value.toFixed(2)}</b>
    </label>
  );
}

function collisionLabel(collision: WorldStaticMeshSettings["collision"]): string {
  if (collision === "none") return "Desativada";
  if (collision === "mesh") return "Malha complexa";
  return "Caixa simples";
}

function splitAssetUrl(url: string): { rootUrl: string; filename: string } {
  const separator = url.lastIndexOf("/");
  return separator < 0
    ? { rootUrl: "", filename: url }
    : { rootUrl: url.slice(0, separator + 1), filename: url.slice(separator + 1) };
}
