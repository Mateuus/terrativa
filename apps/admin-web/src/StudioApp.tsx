import {
  type BoardSceneDefinition,
  type BoardSceneProp,
  type BoardSceneTile,
  baixadaSantistaContent,
  baixadaSantistaScene,
  createDefaultBoardScene,
  getSceneAsset,
  type SceneAssetId,
  sceneAssetCatalog,
  validateBoardScene,
} from "@terrativa/board-content";
import { BrandMark } from "@terrativa/ui";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "terrativa.map-studio.baixada-santista.v1";
const VIEW_SIZE = 24;
const HALF_VIEW = VIEW_SIZE / 2;

type Selection =
  | { readonly kind: "tile"; readonly position: number }
  | { readonly kind: "prop"; readonly id: string };

interface DragState {
  readonly pointerId: number;
  readonly selection: Selection;
  readonly offsetX: number;
  readonly offsetZ: number;
}

export function StudioApp() {
  const [scene, setScene] = useState<BoardSceneDefinition>(readInitialScene);
  const [selection, setSelection] = useState<Selection>({ kind: "tile", position: 0 });
  const [status, setStatus] = useState("Alterações salvas localmente");
  const [gridSize, setGridSize] = useState(0.25);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const tileByPosition = useMemo(
    () => new Map(baixadaSantistaContent.tiles.map((tile) => [tile.position, tile])),
    [],
  );
  const selectedTile =
    selection.kind === "tile"
      ? scene.tiles.find((tile) => tile.position === selection.position)
      : undefined;
  const selectedProp =
    selection.kind === "prop" ? scene.props.find((prop) => prop.id === selection.id) : undefined;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
    setStatus("Alterações salvas localmente");
  }, [scene]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport || event.pointerId !== drag.pointerId) return;
      const world = clientToWorld(event.clientX, event.clientY, viewport);
      const x = snap(world.x - drag.offsetX, gridSize);
      const z = snap(world.z - drag.offsetZ, gridSize);
      setScene((current) => moveSelection(current, drag.selection, x, z));
      setStatus("Editando…");
    };
    const end = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [gridSize]);

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    nextSelection: Selection,
    x: number,
    z: number,
  ) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    const world = clientToWorld(event.clientX, event.clientY, viewport);
    dragRef.current = {
      pointerId: event.pointerId,
      selection: nextSelection,
      offsetX: world.x - x,
      offsetZ: world.z - z,
    };
    setSelection(nextSelection);
  }

  function addAsset(assetId: SceneAssetId) {
    const asset = getSceneAsset(assetId);
    const id = `${assetId}-${Date.now().toString(36)}`;
    const prop: BoardSceneProp = {
      id,
      assetId,
      x: 0,
      y: asset.category === "Construções" ? 0.68 : -0.14,
      z: 0,
      rotationY: 0,
      scale: asset.defaultScale,
    };
    setScene((current) => ({ ...current, props: [...current.props, prop] }));
    setSelection({ kind: "prop", id });
    setStatus(`${asset.label} adicionado`);
  }

  function removeSelectedProp() {
    if (!selectedProp) return;
    setScene((current) => ({
      ...current,
      props: current.props.filter((prop) => prop.id !== selectedProp.id),
    }));
    setSelection({ kind: "tile", position: 0 });
  }

  function updateTile(patch: Partial<BoardSceneTile>) {
    if (!selectedTile) return;
    setScene((current) => ({
      ...current,
      tiles: current.tiles.map((tile) =>
        tile.position === selectedTile.position ? { ...tile, ...patch } : tile,
      ),
    }));
  }

  function updateProp(patch: Partial<BoardSceneProp>) {
    if (!selectedProp) return;
    setScene((current) => ({
      ...current,
      props: current.props.map((prop) =>
        prop.id === selectedProp.id ? { ...prop, ...patch } : prop,
      ),
    }));
  }

  function updateSurface(field: keyof BoardSceneDefinition["surface"], value: string | number) {
    setScene((current) => ({
      ...current,
      surface: { ...current.surface, [field]: value },
    }));
  }

  function resetScene() {
    const reset = createDefaultBoardScene(
      baixadaSantistaContent.slug,
      baixadaSantistaContent.tileCount,
    );
    setScene(reset);
    setSelection({ kind: "tile", position: 0 });
    setStatus("Layout padrão restaurado");
  }

  function exportScene() {
    downloadJson(scene, `terrativa-${scene.boardSlug}-scene.json`);
    setStatus("JSON exportado");
  }

  async function importScene(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const candidate: unknown = JSON.parse(await file.text());
      const imported = validateBoardScene(candidate);
      if (imported.boardSlug !== baixadaSantistaContent.slug) {
        throw new Error("O arquivo pertence a outro tabuleiro.");
      }
      setScene(imported);
      setSelection({ kind: "tile", position: 0 });
      setStatus("Mapa importado com sucesso");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível importar o mapa");
    }
  }

  async function publishScene() {
    setStatus("Publicando no jogo…");
    try {
      const response = await fetch("/__terrativa-studio/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validateBoardScene(scene)),
      });
      const payload = (await response.json()) as { message?: unknown };
      if (!response.ok) {
        throw new Error(
          typeof payload.message === "string" ? payload.message : "Falha ao publicar",
        );
      }
      setStatus("Publicado. Recarregue a partida para ver o novo mapa.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao publicar o mapa");
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-brand">
          <BrandMark logoSrc="/assets/terrativa-logo-v1.png" />
          <div>
            <span>Editor oficial</span>
            <strong>Map Studio</strong>
          </div>
        </div>
        <div className="studio-project">
          <span>Projeto atual</span>
          <strong>{baixadaSantistaContent.name}</strong>
          <em>
            {scene.tiles.length} casas · {scene.props.length} objetos
          </em>
        </div>
        <div className="studio-actions">
          <span className="studio-status">{status}</span>
          <button className="is-quiet" onClick={exportScene} type="button">
            Exportar
          </button>
          <button className="is-quiet" onClick={() => importRef.current?.click()} type="button">
            Importar
          </button>
          <input
            accept="application/json"
            hidden
            onChange={(event) => void importScene(event)}
            ref={importRef}
            type="file"
          />
          <button className="is-primary" onClick={() => void publishScene()} type="button">
            Publicar no jogo
          </button>
        </div>
      </header>

      <aside className="studio-library">
        <header>
          <span>Biblioteca</span>
          <strong>Assets do mapa</strong>
        </header>
        {(["Construções", "Cenário"] as const).map((category) => (
          <section className="studio-asset-group" key={category}>
            <h2>{category}</h2>
            <div className="studio-asset-grid">
              {sceneAssetCatalog
                .filter((asset) => asset.category === category)
                .map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => addAsset(asset.id)}
                    title={`Adicionar ${asset.label}`}
                    type="button"
                  >
                    <span
                      className={`studio-asset-icon is-${asset.category === "Construções" ? "building" : "scenery"}`}
                      style={{ "--asset-color": asset.swatch } as React.CSSProperties}
                    />
                    <strong>{asset.label}</strong>
                    <small>Arraste após adicionar</small>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </aside>

      <section className="studio-workspace">
        <div className="studio-toolbar">
          <div>
            <strong>Vista superior</strong>
            <span>Arraste casas e objetos livremente</span>
          </div>
          <label>
            Grade
            <select onChange={(event) => setGridSize(Number(event.target.value))} value={gridSize}>
              <option value="0">Livre</option>
              <option value="0.1">0,10 m</option>
              <option value="0.25">0,25 m</option>
              <option value="0.5">0,50 m</option>
              <option value="1">1,00 m</option>
            </select>
          </label>
          <button className="is-quiet" onClick={resetScene} type="button">
            Restaurar padrão
          </button>
        </div>

        <div className="studio-viewport-frame">
          <div className="studio-ruler studio-ruler--horizontal" />
          <div className="studio-ruler studio-ruler--vertical" />
          <div
            aria-label="Área editável do mapa"
            className="studio-viewport"
            ref={viewportRef}
            role="application"
            style={
              {
                "--surface-color": scene.surface.baseColor,
                "--edge-color": scene.surface.edgeColor,
                "--surface-width": `${(scene.surface.width / VIEW_SIZE) * 100}%`,
                "--surface-depth": `${(scene.surface.depth / VIEW_SIZE) * 100}%`,
              } as React.CSSProperties
            }
          >
            <div className="studio-water" />
            <div className="studio-surface" />
            <div className="studio-axis studio-axis--x" />
            <div className="studio-axis studio-axis--z" />
            {scene.tiles.map((tile) => {
              const content = tileByPosition.get(tile.position);
              const city = baixadaSantistaContent.cities.find(
                (item) => item.key === content?.cityKey,
              );
              const active = selection.kind === "tile" && selection.position === tile.position;
              return (
                <button
                  aria-label={`Casa ${tile.position}: ${content?.name ?? "Sem nome"}`}
                  className={`studio-tile ${active ? "is-selected" : ""}`}
                  key={tile.position}
                  onPointerDown={(event) =>
                    startDrag(event, { kind: "tile", position: tile.position }, tile.x, tile.z)
                  }
                  style={
                    {
                      left: worldPercent(tile.x),
                      top: worldPercent(tile.z),
                      "--tile-color": city?.accentColor ?? "#75C7B5",
                      "--tile-rotation": `${tile.rotationY}rad`,
                      "--tile-scale": tile.scale,
                    } as React.CSSProperties
                  }
                  title={`${tile.position} · ${content?.name ?? ""}`}
                  type="button"
                >
                  <span>{tile.position}</span>
                </button>
              );
            })}
            {scene.props.map((prop) => {
              const asset = getSceneAsset(prop.assetId);
              const active = selection.kind === "prop" && selection.id === prop.id;
              return (
                <button
                  aria-label={asset.label}
                  className={`studio-prop ${active ? "is-selected" : ""} ${
                    asset.category === "Construções" ? "is-building" : "is-scenery"
                  }`}
                  key={prop.id}
                  onPointerDown={(event) =>
                    startDrag(event, { kind: "prop", id: prop.id }, prop.x, prop.z)
                  }
                  style={
                    {
                      left: worldPercent(prop.x),
                      top: worldPercent(prop.z),
                      "--prop-color": asset.swatch,
                      "--prop-rotation": `${prop.rotationY}rad`,
                      "--prop-size": Math.max(0.65, Math.min(1.8, prop.scale / asset.defaultScale)),
                    } as React.CSSProperties
                  }
                  title={asset.label}
                  type="button"
                >
                  <span />
                </button>
              );
            })}
          </div>
          <div className="studio-legend">
            <span>
              <i className="is-tile" /> Casa
            </span>
            <span>
              <i className="is-building" /> Construção
            </span>
            <span>
              <i className="is-scenery" /> Cenário
            </span>
          </div>
        </div>
      </section>

      <aside className="studio-inspector">
        <header>
          <span>Inspetor</span>
          <strong>
            {selectedTile
              ? `Casa ${selectedTile.position}`
              : selectedProp
                ? getSceneAsset(selectedProp.assetId).label
                : "Cena"}
          </strong>
        </header>

        {selectedTile && (
          <>
            <div className="studio-selection-summary">
              <span
                style={{
                  background:
                    baixadaSantistaContent.cities.find(
                      (city) => city.key === tileByPosition.get(selectedTile.position)?.cityKey,
                    )?.accentColor ?? "#75C7B5",
                }}
              />
              <div>
                <strong>{tileByPosition.get(selectedTile.position)?.name}</strong>
                <small>{tileByPosition.get(selectedTile.position)?.type}</small>
              </div>
            </div>
            <TransformFields value={selectedTile} onChange={updateTile} />
          </>
        )}

        {selectedProp && (
          <>
            <div className="studio-selection-summary">
              <span style={{ background: getSceneAsset(selectedProp.assetId).swatch }} />
              <div>
                <strong>{getSceneAsset(selectedProp.assetId).label}</strong>
                <small>{selectedProp.id}</small>
              </div>
            </div>
            <TransformFields value={selectedProp} onChange={updateProp} includeY />
            <button className="studio-delete" onClick={removeSelectedProp} type="button">
              Remover objeto
            </button>
          </>
        )}

        <section className="studio-scene-settings">
          <h2>Base do tabuleiro</h2>
          <div className="studio-field-row">
            <NumberField
              label="Largura"
              onChange={(value) => updateSurface("width", value)}
              value={scene.surface.width}
            />
            <NumberField
              label="Profundidade"
              onChange={(value) => updateSurface("depth", value)}
              value={scene.surface.depth}
            />
          </div>
          <div className="studio-field-row">
            <ColorField
              label="Superfície"
              onChange={(value) => updateSurface("baseColor", value)}
              value={scene.surface.baseColor}
            />
            <ColorField
              label="Borda"
              onChange={(value) => updateSurface("edgeColor", value)}
              value={scene.surface.edgeColor}
            />
          </div>
        </section>

        <div className="studio-tip">
          <strong>Dica do Studio</strong>
          <p>
            Posicione primeiro as casas e depois componha o centro com construções. “Publicar no
            jogo” grava esta cena no pacote oficial durante o desenvolvimento local.
          </p>
        </div>
      </aside>
    </main>
  );
}

function TransformFields({
  includeY = false,
  onChange,
  value,
}: {
  readonly includeY?: boolean;
  readonly onChange: (patch: Record<string, number>) => void;
  readonly value: {
    readonly x: number;
    readonly z: number;
    readonly rotationY: number;
    readonly scale: number;
  } & Partial<{ readonly y: number }>;
}) {
  return (
    <section className="studio-transform">
      <h2>Transformação</h2>
      <div className="studio-field-row">
        <NumberField label="Posição X" onChange={(x) => onChange({ x })} value={value.x} />
        <NumberField label="Posição Z" onChange={(z) => onChange({ z })} value={value.z} />
      </div>
      {includeY && (
        <NumberField label="Altura Y" onChange={(y) => onChange({ y })} value={value.y ?? 0} />
      )}
      <div className="studio-field-row">
        <NumberField
          label="Rotação"
          onChange={(degrees) => onChange({ rotationY: (degrees * Math.PI) / 180 })}
          step={5}
          value={Math.round((value.rotationY * 180) / Math.PI)}
        />
        <NumberField
          label="Escala"
          onChange={(scale) => onChange({ scale })}
          step={0.05}
          value={value.scale}
        />
      </div>
    </section>
  );
}

function NumberField({
  label,
  onChange,
  step = 0.1,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly value: number;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      <input
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        step={step}
        type="number"
        value={round(value)}
      />
    </label>
  );
}

function ColorField({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="studio-field studio-color-field">
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} type="color" value={value} />
    </label>
  );
}

function readInitialScene(): BoardSceneDefinition {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored
      ? validateBoardScene(JSON.parse(stored) as unknown)
      : structuredClone(baixadaSantistaScene);
  } catch {
    return structuredClone(baixadaSantistaScene);
  }
}

function moveSelection(
  scene: BoardSceneDefinition,
  selection: Selection,
  x: number,
  z: number,
): BoardSceneDefinition {
  return selection.kind === "tile"
    ? {
        ...scene,
        tiles: scene.tiles.map((tile) =>
          tile.position === selection.position ? { ...tile, x, z } : tile,
        ),
      }
    : {
        ...scene,
        props: scene.props.map((prop) => (prop.id === selection.id ? { ...prop, x, z } : prop)),
      };
}

function clientToWorld(clientX: number, clientY: number, element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  return {
    x: ((clientX - bounds.left) / bounds.width) * VIEW_SIZE - HALF_VIEW,
    z: ((clientY - bounds.top) / bounds.height) * VIEW_SIZE - HALF_VIEW,
  };
}

function worldPercent(value: number): string {
  return `${((value + HALF_VIEW) / VIEW_SIZE) * 100}%`;
}

function snap(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : round(value);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
