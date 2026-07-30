import {
  type BoardSceneDefinition,
  type BoardSceneProp,
  type BoardSceneTile,
  baixadaSantistaContent,
  createDefaultBoardScene,
  getSceneAsset,
  type SceneAssetId,
  sceneAssetCatalog,
  validateBoardScene,
} from "@terrativa/board-content";
import { BrandMark } from "@terrativa/ui";
import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  lazy,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StudioContentDrawer } from "./StudioContentDrawer";
import { StudioConfirmDialog, StudioTextDialog } from "./StudioDialog";
import { StudioOutliner } from "./StudioOutliner";
import {
  copyStudioSelection,
  pasteStudioClipboard,
  type StudioClipboardItem,
} from "./studioClipboard";
import {
  adaptObjectsToLandscape,
  clearLandscapeSculpting,
  type LandscapeSculptTool,
  resizeLandscape,
} from "./studioLandscape";
import {
  loadStudioLayout,
  resetStudioLayout,
  type StudioLayout,
  saveStudioLayout,
} from "./studioLayout";
import { applyStudioSelectionTransforms, type StudioSelectionTransform } from "./studioTransforms";
import type { CameraView, StudioSelection, TransformTool } from "./WorldCanvas3D";
import {
  createDefaultLandscape,
  createOutlinerFolder,
  createWorld,
  createWorldPackage,
  duplicateWorld,
  loadWorlds,
  type NewWorldInput,
  parseStudioWorld,
  type StudioWorld,
  saveWorlds,
  slugify,
  touchWorld,
  type VehicleAssetId,
  vehicleAssetCatalog,
  type WorldContentAsset,
  type WorldLandscape,
  type WorldPlacedObject,
  type WorldRoute,
  type WorldTemplate,
  type WorldVehicle,
  type WorldWaterBody,
} from "./worldModel";

type AdminView = "dashboard" | "worlds" | "assets" | "studio";
type StudioMenu = "edit" | "file" | "window" | null;
type StudioResizeTarget = "content" | "outliner" | "side";

export const STUDIO_AUTOSAVE_INTERVAL_MS = 30_000;
const STUDIO_HISTORY_LIMIT = 100;

const WorldCanvas3D = lazy(async () => {
  const module = await import("./WorldCanvas3D");
  return { default: module.WorldCanvas3D };
});

export function AdminApp() {
  const [worlds, setWorlds] = useState<StudioWorld[]>(loadWorlds);
  const [route, setRoute] = useState(readRoute);
  const [createOpen, setCreateOpen] = useState(false);
  const [worldPendingRemoval, setWorldPendingRemoval] = useState<StudioWorld | null>(null);
  const activeWorld = worlds.find((world) => world.id === route.worldId) ?? worlds[0];
  const worldsRef = useRef(worlds);
  const savedWorldRevisionsRef = useRef(
    new Map(worlds.map((world) => [world.id, world.updatedAt])),
  );
  worldsRef.current = worlds;

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(view: AdminView, worldId?: string) {
    window.location.hash = view === "studio" && worldId ? `/studio/${worldId}` : `/${view}`;
    setRoute(worldId ? { view, worldId } : { view });
  }

  function updateWorld(next: StudioWorld) {
    setWorlds((current) => current.map((world) => (world.id === next.id ? next : world)));
  }

  function persistWorlds(next: readonly StudioWorld[]) {
    saveWorlds(next);
    savedWorldRevisionsRef.current = new Map(next.map((world) => [world.id, world.updatedAt]));
  }

  function addWorld(input: NewWorldInput) {
    const world = createWorld(input);
    setWorlds((current) => {
      const next = [...current, world];
      persistWorlds(next);
      return next;
    });
    setCreateOpen(false);
    navigate("studio", world.id);
  }

  function copyWorld(world: StudioWorld) {
    const copy = duplicateWorld(world);
    setWorlds((current) => {
      const next = [...current, copy];
      persistWorlds(next);
      return next;
    });
    navigate("studio", copy.id);
  }

  function removeWorld(world: StudioWorld) {
    if (world.slug === "baixada-santista") return;
    setWorldPendingRemoval(world);
  }

  function confirmWorldRemoval() {
    if (!worldPendingRemoval) return;
    setWorlds((current) => {
      const next = current.filter((candidate) => candidate.id !== worldPendingRemoval.id);
      persistWorlds(next);
      return next;
    });
    setWorldPendingRemoval(null);
    navigate("worlds");
  }

  return (
    <div className={`admin-shell ${route.view === "studio" ? "is-studio" : ""}`}>
      <aside className="admin-sidebar">
        <button className="admin-logo" onClick={() => navigate("dashboard")} type="button">
          <BrandMark logoSrc="/assets/terrativa-logo-v1.png" />
          <span>
            <strong>Terrativa</strong>
            <small>Administração</small>
          </span>
        </button>
        <nav className="admin-nav" aria-label="Navegação administrativa">
          <NavButton
            active={route.view === "dashboard"}
            icon="⌂"
            label="Visão geral"
            onClick={() => navigate("dashboard")}
          />
          <NavButton
            active={route.view === "worlds" || route.view === "studio"}
            icon="◉"
            label="Mundos"
            onClick={() => navigate("worlds")}
          />
          <NavButton
            active={route.view === "assets"}
            icon="◇"
            label="Biblioteca"
            onClick={() => navigate("assets")}
          />
          <NavButton icon="▤" label="Conteúdo" onClick={() => navigate("dashboard")} />
          <NavButton icon="♙" label="Jogadores" onClick={() => navigate("dashboard")} />
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-avatar">M</span>
          <span>
            <strong>Mateus</strong>
            <small>Administrador</small>
          </span>
          <button title="Configurações" type="button">
            •••
          </button>
        </div>
      </aside>

      <header className="admin-header">
        <div className="admin-breadcrumb">
          <span>Admin</span>
          <i>/</i>
          <strong>{viewTitle(route.view, activeWorld?.name)}</strong>
        </div>
        <div className="admin-header-actions">
          <span className="admin-system-status">
            <i /> Serviços operacionais
          </span>
          <button className="icon-button" title="Notificações" type="button">
            ◌
          </button>
          <button
            className="admin-primary-button"
            onClick={() => setCreateOpen(true)}
            type="button"
          >
            <b>＋</b> Novo mundo
          </button>
        </div>
      </header>

      <main className="admin-main">
        {route.view === "dashboard" && (
          <Dashboard
            worlds={worlds}
            onCreate={() => setCreateOpen(true)}
            onOpen={(id) => navigate("studio", id)}
          />
        )}
        {route.view === "worlds" && (
          <WorldsPage
            worlds={worlds}
            onCopy={copyWorld}
            onCreate={() => setCreateOpen(true)}
            onOpen={(id) => navigate("studio", id)}
            onRemove={removeWorld}
          />
        )}
        {route.view === "assets" && <AssetsPage />}
        {route.view === "studio" && activeWorld && (
          <WorldStudio
            initialSavedRevision={
              savedWorldRevisionsRef.current.get(activeWorld.id) ?? activeWorld.updatedAt
            }
            key={activeWorld.id}
            onBack={() => navigate("worlds")}
            onSave={() => persistWorlds(worldsRef.current)}
            onUpdate={updateWorld}
            world={activeWorld}
          />
        )}
      </main>

      {createOpen && (
        <CreateWorldDialog
          existingSlugs={worlds.map((world) => world.slug)}
          onClose={() => setCreateOpen(false)}
          onCreate={addWorld}
        />
      )}
      {worldPendingRemoval && (
        <StudioConfirmDialog
          confirmLabel="Excluir mundo"
          description={`O rascunho local de “${worldPendingRemoval.name}” será removido. Esta ação não pode ser desfeita.`}
          onCancel={() => setWorldPendingRemoval(null)}
          onConfirm={confirmWorldRemoval}
          title="Excluir este mundo?"
        />
      )}
    </div>
  );
}

function Dashboard({
  onCreate,
  onOpen,
  worlds,
}: {
  readonly onCreate: () => void;
  readonly onOpen: (id: string) => void;
  readonly worlds: readonly StudioWorld[];
}) {
  const published = worlds.filter((world) => world.status === "published").length;
  return (
    <div className="admin-page">
      <section className="admin-page-heading">
        <div>
          <span className="eyebrow">Central de operações</span>
          <h1>Visão geral</h1>
          <p>Gerencie mundos, conteúdo regional e a experiência 3D da Terrativa.</p>
        </div>
        <button className="admin-primary-button" onClick={onCreate} type="button">
          ＋ Criar mundo
        </button>
      </section>

      <section className="metric-grid">
        <MetricCard
          accent="mint"
          label="Mundos"
          value={worlds.length}
          detail={`${published} publicado${published === 1 ? "" : "s"}`}
        />
        <MetricCard
          accent="gold"
          label="Objetos 3D"
          value={sceneAssetCatalog.length}
          detail="Biblioteca costeira"
        />
        <MetricCard
          accent="blue"
          label="Casas configuradas"
          value={worlds.reduce((total, world) => total + world.scene.tiles.length, 0)}
          detail="Em todos os mundos"
        />
        <MetricCard
          accent="coral"
          label="Rascunhos"
          value={worlds.length - published}
          detail="Aguardando publicação"
        />
      </section>

      <section className="admin-panel recent-worlds">
        <header>
          <div>
            <span className="eyebrow">Projetos recentes</span>
            <h2>Mundos da plataforma</h2>
          </div>
          <button className="text-button" onClick={onCreate} type="button">
            Novo mundo ＋
          </button>
        </header>
        <div className="world-card-grid">
          {worlds.slice(0, 3).map((world) => (
            <WorldCard key={world.id} onOpen={() => onOpen(world.id)} world={world} />
          ))}
        </div>
      </section>
    </div>
  );
}

function WorldsPage({
  onCopy,
  onCreate,
  onOpen,
  onRemove,
  worlds,
}: {
  readonly onCopy: (world: StudioWorld) => void;
  readonly onCreate: () => void;
  readonly onOpen: (id: string) => void;
  readonly onRemove: (world: StudioWorld) => void;
  readonly worlds: readonly StudioWorld[];
}) {
  return (
    <div className="admin-page">
      <section className="admin-page-heading">
        <div>
          <span className="eyebrow">World management</span>
          <h1>Mundos</h1>
          <p>Crie territórios, edite terrenos e publique experiências jogáveis.</p>
        </div>
        <button className="admin-primary-button" onClick={onCreate} type="button">
          ＋ Novo mundo
        </button>
      </section>
      <div className="world-list-toolbar">
        <label className="admin-search">
          ⌕ <input placeholder="Buscar mundo..." />
        </label>
        <span>
          {worlds.length} projeto{worlds.length === 1 ? "" : "s"}
        </span>
      </div>
      <section className="world-card-grid is-large">
        {worlds.map((world) => (
          <WorldCard
            key={world.id}
            onCopy={() => onCopy(world)}
            onOpen={() => onOpen(world.id)}
            {...(world.slug === "baixada-santista" ? {} : { onRemove: () => onRemove(world) })}
            world={world}
          />
        ))}
        <button className="world-create-card" onClick={onCreate} type="button">
          <span>＋</span>
          <strong>Criar novo mundo</strong>
          <small>Comece com um terreno vazio ou um modelo costeiro.</small>
        </button>
      </section>
    </div>
  );
}

function AssetsPage() {
  return (
    <div className="admin-page">
      <section className="admin-page-heading">
        <div>
          <span className="eyebrow">Biblioteca global</span>
          <h1>Assets 3D</h1>
          <p>Modelos disponíveis para todos os mundos da Terrativa.</p>
        </div>
      </section>
      <section className="asset-library-page">
        {sceneAssetCatalog.map((asset) => (
          <article className="asset-library-card" key={asset.id}>
            <AssetGlyph color={asset.swatch} construction={asset.category === "Construções"} />
            <span>{asset.category}</span>
            <strong>{asset.label}</strong>
            <small>{asset.file}</small>
          </article>
        ))}
      </section>
    </div>
  );
}

function WorldStudio({
  initialSavedRevision,
  onBack,
  onSave,
  onUpdate: persistWorldUpdate,
  world,
}: {
  readonly initialSavedRevision: string;
  readonly onBack: () => void;
  readonly onSave: () => void;
  readonly onUpdate: (world: StudioWorld) => void;
  readonly world: StudioWorld;
}) {
  const [selections, setSelections] = useState<StudioSelection[]>([{ kind: "tile", position: 0 }]);
  const selection = selections.at(-1) ?? null;
  const [tool, setTool] = useState<TransformTool>("move");
  const [cameraView, setCameraView] = useState<CameraView>("perspective");
  const [showGrid, setShowGrid] = useState(true);
  const [landscapeTool, setLandscapeTool] = useState<LandscapeSculptTool | null>(null);
  const [landscapeBrushRadius, setLandscapeBrushRadius] = useState(3);
  const [landscapeBrushStrength, setLandscapeBrushStrength] = useState(0.35);
  const [status, setStatus] = useState("Mundo carregado do armazenamento local");
  const [activeMenu, setActiveMenu] = useState<StudioMenu>(null);
  const [layout, setLayout] = useState<StudioLayout>(() => loadStudioLayout(world.id));
  const [savedRevision, setSavedRevision] = useState(initialSavedRevision);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [sceneClipboard, setSceneClipboard] = useState<StudioClipboardItem | null>(null);
  const [outlinerFolderParentId, setOutlinerFolderParentId] = useState<string | null | undefined>(
    undefined,
  );
  const importRef = useRef<HTMLInputElement>(null);
  const copySequenceRef = useRef(0);
  const pasteCountRef = useRef(0);
  const onSaveRef = useRef(onSave);
  const undoStackRef = useRef<StudioWorld[]>([]);
  const redoStackRef = useRef<StudioWorld[]>([]);
  const undoActionRef = useRef<() => void>(() => undefined);
  const redoActionRef = useRef<() => void>(() => undefined);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const saveActionRef = useRef<(mode: "auto" | "manual") => void>(() => undefined);
  const worldRef = useRef(world);
  const savedRevisionRef = useRef(savedRevision);
  onSaveRef.current = onSave;
  worldRef.current = world;
  savedRevisionRef.current = savedRevision;
  const hasUnsavedChanges = world.updatedAt !== savedRevision;
  const sideVisible = layout.showOutliner || layout.showInspector;
  const studioStyle = {
    "--content-height": `${layout.showContentDrawer ? layout.contentHeight : 0}px`,
    "--outliner-height": `${layout.outlinerHeight}px`,
    "--side-width": `${sideVisible ? layout.sideWidth : 0}px`,
  } as CSSProperties;
  const tileByPosition = useMemo(
    () => new Map(baixadaSantistaContent.tiles.map((tile) => [tile.position, tile])),
    [],
  );
  const selectedTile =
    selection?.kind === "tile"
      ? world.scene.tiles.find((tile) => tile.position === selection.position)
      : undefined;
  const selectedLandscape =
    selection?.kind === "landscape" && world.landscape?.id === selection.id
      ? world.landscape
      : undefined;
  const selectedProp =
    selection?.kind === "prop"
      ? world.scene.props.find((prop) => prop.id === selection.id)
      : undefined;
  const selectedWater =
    selection?.kind === "water"
      ? world.waterBodies.find((water) => water.id === selection.id)
      : undefined;
  const selectedRoute =
    selection?.kind === "route"
      ? world.routes.find((route) => route.id === selection.id)
      : undefined;
  const selectedVehicle =
    selection?.kind === "vehicle"
      ? world.vehicles.find((vehicle) => vehicle.id === selection.id)
      : undefined;
  const selectedObject =
    selection?.kind === "object"
      ? world.objects.find((object) => object.id === selection.id)
      : undefined;

  function updateHistoryState() {
    setHistoryState({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }

  function onUpdate(next: StudioWorld) {
    const current = worldRef.current;
    if (next === current) return;
    undoStackRef.current.push(structuredClone(current));
    if (undoStackRef.current.length > STUDIO_HISTORY_LIMIT) undoStackRef.current.shift();
    redoStackRef.current = [];
    worldRef.current = next;
    persistWorldUpdate(next);
    updateHistoryState();
  }

  function undoWorldChange() {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      setStatus("Não há ações para desfazer");
      return;
    }
    const current = worldRef.current;
    const landscapeEdit = didGroundGeometryChange(current, previous);
    redoStackRef.current.push(structuredClone(current));
    worldRef.current = previous;
    persistWorldUpdate(previous);
    if (landscapeEdit && previous.landscape) {
      setSelection({ kind: "landscape", id: previous.landscape.id });
    } else {
      setSelection(null);
    }
    if (!previous.landscape) setLandscapeTool(null);
    setStatus(
      landscapeEdit
        ? "Edição do Landscape desfeita · Ctrl+Y para refazer"
        : "Ação desfeita · Ctrl+Y para refazer",
    );
    setActiveMenu(null);
    updateHistoryState();
  }
  undoActionRef.current = undoWorldChange;

  function redoWorldChange() {
    const next = redoStackRef.current.pop();
    if (!next) {
      setStatus("Não há ações para refazer");
      return;
    }
    const current = worldRef.current;
    const landscapeEdit = didGroundGeometryChange(current, next);
    undoStackRef.current.push(structuredClone(current));
    worldRef.current = next;
    persistWorldUpdate(next);
    if (landscapeEdit && next.landscape) {
      setSelection({ kind: "landscape", id: next.landscape.id });
    } else {
      setSelection(null);
    }
    if (!next.landscape) setLandscapeTool(null);
    setStatus(landscapeEdit ? "Edição do Landscape refeita" : "Ação refeita");
    setActiveMenu(null);
    updateHistoryState();
  }
  redoActionRef.current = redoWorldChange;

  function setSelection(next: StudioSelection | null) {
    setSelections(next ? [next] : []);
  }

  function selectFromStudio(next: StudioSelection | null, additive: boolean) {
    if (!next) {
      if (!additive) setSelections([]);
      return;
    }
    if (!additive) {
      setSelections([next]);
      return;
    }
    setSelections((current) => {
      const key = studioSelectionIdentity(next);
      const exists = current.some((candidate) => studioSelectionIdentity(candidate) === key);
      return exists
        ? current.filter((candidate) => studioSelectionIdentity(candidate) !== key)
        : [...current, next];
    });
  }

  function createSceneFolder(name: string) {
    const current = worldRef.current;
    const parentId =
      outlinerFolderParentId &&
      current.outlinerFolders.some((folder) => folder.id === outlinerFolderParentId)
        ? outlinerFolderParentId
        : null;
    const folder = createOutlinerFolder(name, parentId);
    onUpdate(
      touchWorld(current, {
        outlinerFolders: [...current.outlinerFolders, folder],
      }),
    );
    setOutlinerFolderParentId(undefined);
    setStatus(parentId ? `Subpasta “${folder.name}” criada` : `Pasta “${folder.name}” criada`);
  }

  function moveSelectionsToFolder(folderId: string | null) {
    const current = worldRef.current;
    const destination =
      folderId && current.outlinerFolders.some((folder) => folder.id === folderId)
        ? folderId
        : null;
    const assignments = { ...current.outlinerAssignments };
    let changed = false;
    for (const selected of selections) {
      const key = studioSelectionIdentity(selected);
      if (destination) {
        if (assignments[key] !== destination) {
          assignments[key] = destination;
          changed = true;
        }
      } else if (assignments[key]) {
        delete assignments[key];
        changed = true;
      }
    }
    if (!changed) return;
    onUpdate(touchWorld(current, { outlinerAssignments: assignments }));
    const folderName = current.outlinerFolders.find((folder) => folder.id === destination)?.name;
    setStatus(
      destination
        ? `${selections.length} objeto(s) movido(s) para “${folderName}”`
        : `${selections.length} objeto(s) retirado(s) da pasta`,
    );
  }

  function saveCurrentWorld(mode: "auto" | "manual") {
    const current = worldRef.current;
    if (mode === "auto" && current.updatedAt === savedRevisionRef.current) return;
    onSaveRef.current();
    const savedAt = new Date();
    savedRevisionRef.current = current.updatedAt;
    setSavedRevision(current.updatedAt);
    setLastSavedAt(savedAt);
    setStatus(
      mode === "auto"
        ? `Salvamento automático concluído às ${formatSaveTime(savedAt)}`
        : `Mundo salvo às ${formatSaveTime(savedAt)}`,
    );
  }
  saveActionRef.current = saveCurrentWorld;

  useEffect(() => {
    saveStudioLayout(world.id, layout);
  }, [layout, world.id]);

  useEffect(() => {
    const timer = window.setInterval(
      () => saveActionRef.current("auto"),
      STUDIO_AUTOSAVE_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLocaleLowerCase();

      if (commandKey && key === "s") {
        event.preventDefault();
        saveActionRef.current("manual");
      }
      if (commandKey && key === "z" && !event.shiftKey && !isTextEditingTarget(event.target)) {
        event.preventDefault();
        undoActionRef.current();
      }
      if (
        commandKey &&
        (key === "y" || (key === "z" && event.shiftKey)) &&
        !isTextEditingTarget(event.target)
      ) {
        event.preventDefault();
        redoActionRef.current();
      }
      if (event.key === "Escape") setActiveMenu(null);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    [],
  );

  function togglePanel(panel: "showContentDrawer" | "showInspector" | "showOutliner") {
    setLayout((current) => ({ ...current, [panel]: !current[panel] }));
  }

  function restoreStudioLayout() {
    setLayout(resetStudioLayout());
    setActiveMenu(null);
    setStatus("Layout padrão do Studio restaurado");
  }

  function beginResize(target: StudioResizeTarget, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = layout;
    const move = (pointerEvent: PointerEvent) => {
      if (target === "content") {
        const maximum = Math.max(220, window.innerHeight - 330);
        setLayout((current) => ({
          ...current,
          contentHeight: clamp(initial.contentHeight + startY - pointerEvent.clientY, 160, maximum),
        }));
      }
      if (target === "side") {
        const maximum = Math.max(300, Math.min(620, window.innerWidth - 620));
        setLayout((current) => ({
          ...current,
          sideWidth: clamp(initial.sideWidth + startX - pointerEvent.clientX, 260, maximum),
        }));
      }
      if (target === "outliner") {
        const maximum = Math.max(180, window.innerHeight - layout.contentHeight - 290);
        setLayout((current) => ({
          ...current,
          outlinerHeight: clamp(
            initial.outlinerHeight + pointerEvent.clientY - startY,
            140,
            maximum,
          ),
        }));
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("is-resizing-studio");
      resizeCleanupRef.current = null;
    };
    resizeCleanupRef.current = stop;
    document.body.classList.add("is-resizing-studio");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function resizeWithKeyboard(
    target: StudioResizeTarget,
    event: ReactKeyboardEvent<HTMLHRElement>,
  ) {
    const step = event.shiftKey ? 48 : 16;
    let delta = 0;
    if (target === "side" && event.key === "ArrowLeft") delta = step;
    if (target === "side" && event.key === "ArrowRight") delta = -step;
    if (target === "content" && event.key === "ArrowUp") delta = step;
    if (target === "content" && event.key === "ArrowDown") delta = -step;
    if (target === "outliner" && event.key === "ArrowUp") delta = -step;
    if (target === "outliner" && event.key === "ArrowDown") delta = step;
    if (delta === 0) return;
    event.preventDefault();
    setLayout((current) => {
      if (target === "side") {
        return { ...current, sideWidth: clamp(current.sideWidth + delta, 260, 620) };
      }
      if (target === "content") {
        return { ...current, contentHeight: clamp(current.contentHeight + delta, 160, 520) };
      }
      return { ...current, outlinerHeight: clamp(current.outlinerHeight + delta, 140, 720) };
    });
  }

  function setScene(scene: BoardSceneDefinition) {
    onUpdate(touchWorld(world, { scene }));
    setStatus("Cena alterada");
  }

  function updateTile(patch: Partial<BoardSceneTile>) {
    if (!selectedTile) return;
    setScene({
      ...world.scene,
      tiles: world.scene.tiles.map((tile) =>
        tile.position === selectedTile.position ? { ...tile, ...patch } : tile,
      ),
    });
  }

  function updateProp(patch: Partial<BoardSceneProp>) {
    if (!selectedProp) return;
    setScene({
      ...world.scene,
      props: world.scene.props.map((prop) =>
        prop.id === selectedProp.id ? { ...prop, ...patch } : prop,
      ),
    });
  }

  function updateWater(patch: Partial<WorldWaterBody>) {
    if (!selectedWater) return;
    onUpdate(
      touchWorld(world, {
        waterBodies: world.waterBodies.map((water) =>
          water.id === selectedWater.id ? { ...water, ...patch } : water,
        ),
      }),
    );
  }

  function updateVehicle(patch: Partial<WorldVehicle>) {
    if (!selectedVehicle) return;
    onUpdate(
      touchWorld(world, {
        vehicles: world.vehicles.map((vehicle) =>
          vehicle.id === selectedVehicle.id ? { ...vehicle, ...patch } : vehicle,
        ),
      }),
    );
  }

  function updateObject(patch: Partial<WorldPlacedObject>) {
    if (!selectedObject) return;
    onUpdate(
      touchWorld(world, {
        objects: world.objects.map((object) =>
          object.id === selectedObject.id ? { ...object, ...patch } : object,
        ),
      }),
    );
  }

  function updateRoute(patch: Partial<WorldRoute>) {
    if (!selectedRoute) return;
    onUpdate(
      touchWorld(world, {
        routes: world.routes.map((route) =>
          route.id === selectedRoute.id ? { ...route, ...patch } : route,
        ),
      }),
    );
  }

  function handleTransform(transforms: readonly StudioSelectionTransform[]) {
    onUpdate(applyStudioSelectionTransforms(world, transforms));
    setStatus(
      transforms.length > 1
        ? `${transforms.length} objetos transformados em conjunto`
        : "Objeto transformado",
    );
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
    setScene({ ...world.scene, props: [...world.scene.props, prop] });
    setSelection({ kind: "prop", id });
    setStatus(`${asset.label} adicionado ao centro do mundo`);
  }

  function removeProp() {
    if (!selectedProp) return;
    setScene({
      ...world.scene,
      props: world.scene.props.filter((prop) => prop.id !== selectedProp.id),
    });
    setSelection(null);
  }

  function addWater(kind: WorldWaterBody["kind"]) {
    const id = `${kind}-${Date.now().toString(36)}`;
    const water: WorldWaterBody = {
      id,
      name: kind === "river" ? "Trecho de rio" : "Lago",
      kind,
      x: 0,
      y: 0.52,
      z: 0,
      width: kind === "river" ? 1.2 : 5,
      length: kind === "river" ? 8 : 5,
      rotationY: 0,
      color: "#208FA3",
    };
    onUpdate(touchWorld(world, { waterBodies: [...world.waterBodies, water] }));
    setSelection({ kind: "water", id });
    setStatus(`${water.name} adicionado à cena`);
  }

  function addVehicle(assetId: VehicleAssetId) {
    const asset = vehicleAssetCatalog.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const id = `vehicle-${assetId}-${Date.now().toString(36)}`;
    const vehicle: WorldVehicle = {
      id,
      assetId,
      name: asset.label,
      x: 0,
      y: 0.66,
      z: 0,
      rotationY: 0,
      scale: asset.defaultScale,
    };
    onUpdate(touchWorld(world, { vehicles: [...world.vehicles, vehicle] }));
    setSelection({ kind: "vehicle", id });
    setStatus(`${asset.label} adicionado à cena`);
  }

  function addContentAsset(asset: WorldContentAsset) {
    if (asset.catalogRef?.type === "scene") {
      addAsset(asset.catalogRef.id);
      return;
    }
    if (asset.catalogRef?.type === "vehicle") {
      addVehicle(asset.catalogRef.id);
      return;
    }
    if (asset.kind !== "model") return;
    const id = `object-${Date.now().toString(36)}`;
    const object: WorldPlacedObject = {
      id,
      name: asset.name,
      assetId: asset.id,
      objectType: "static-mesh",
      mobility: "static",
      x: 0,
      y: 0.7,
      z: 0,
      rotationY: 0,
      scale: asset.defaultScale,
    };
    onUpdate(touchWorld(world, { objects: [...world.objects, object] }));
    setSelection({ kind: "object", id });
    setStatus(`${asset.name} adicionado à cena`);
  }

  function removeWorldElement() {
    if (selectedWater) {
      onUpdate(
        touchWorld(world, {
          waterBodies: world.waterBodies.filter((water) => water.id !== selectedWater.id),
        }),
      );
    }
    if (selectedVehicle) {
      onUpdate(
        touchWorld(world, {
          vehicles: world.vehicles.filter((vehicle) => vehicle.id !== selectedVehicle.id),
        }),
      );
    }
    if (selectedObject) {
      onUpdate(
        touchWorld(world, {
          objects: world.objects.filter((object) => object.id !== selectedObject.id),
        }),
      );
    }
    setSelection(null);
  }

  function deleteSelection(active: StudioSelection) {
    if (active.kind === "tile" || active.kind === "route") {
      setStatus("Casas e rotas oficiais são protegidas. Edite pelo Inspetor.");
      return;
    }
    if (active.kind === "landscape") {
      removeLandscape();
      return;
    }
    if (active.kind === "prop") {
      setScene({
        ...world.scene,
        props: world.scene.props.filter((prop) => prop.id !== active.id),
      });
    }
    if (active.kind === "water") {
      onUpdate(
        touchWorld(world, {
          waterBodies: world.waterBodies.filter((water) => water.id !== active.id),
        }),
      );
    }
    if (active.kind === "vehicle") {
      onUpdate(
        touchWorld(world, {
          vehicles: world.vehicles.filter((vehicle) => vehicle.id !== active.id),
        }),
      );
    }
    if (active.kind === "object") {
      onUpdate(
        touchWorld(world, {
          objects: world.objects.filter((object) => object.id !== active.id),
        }),
      );
    }
    setSelection(null);
    setStatus("Objeto removido da cena");
  }

  function duplicateSelection(active: StudioSelection) {
    const item = copyStudioSelection(world, active);
    if (!item) {
      setStatus("Casas e rotas oficiais não podem ser duplicadas.");
      return;
    }
    placeClipboardItem(item, 0.8, "Objeto duplicado");
  }

  function copySelection(active: StudioSelection) {
    const item = copyStudioSelection(world, active);
    if (!item) {
      setStatus("Selecione um objeto editável para copiar.");
      return;
    }
    setSceneClipboard(item);
    pasteCountRef.current = 0;
    setStatus(`${item.label} copiado · Ctrl+V para colar`);
  }

  function pasteSelection() {
    if (!sceneClipboard) {
      setStatus("A área de transferência do Studio está vazia.");
      return;
    }
    pasteCountRef.current += 1;
    placeClipboardItem(
      sceneClipboard,
      0.8 * pasteCountRef.current,
      `${sceneClipboard.label} colado na cena`,
    );
  }

  function placeClipboardItem(item: StudioClipboardItem, offset: number, message: string) {
    copySequenceRef.current += 1;
    const suffix = `${Date.now().toString(36)}-${copySequenceRef.current.toString(36)}`;
    const pasted = pasteStudioClipboard(world, item, suffix, offset);
    onUpdate(pasted.world);
    setSelection(pasted.selection);
    setStatus(message);
  }

  function createLandscape() {
    if (world.landscape) {
      setSelection({ kind: "landscape", id: world.landscape.id });
      setLandscapeTool("raise");
      setStatus("Modo Landscape ativado");
      return;
    }
    const landscape = createDefaultLandscape(world.terrain.size);
    onUpdate(touchWorld(world, { landscape }));
    setSelection({ kind: "landscape", id: landscape.id });
    setLandscapeTool("raise");
    setStatus("Landscape criado · arraste no terreno para esculpir");
  }

  function updateLandscape(
    patch: Partial<Pick<WorldLandscape, "depth" | "name" | "resolution" | "visible" | "width">>,
  ) {
    if (!world.landscape) return;
    const landscape =
      patch.width !== undefined || patch.depth !== undefined || patch.resolution !== undefined
        ? {
            ...resizeLandscape(world.landscape, patch),
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
          }
        : { ...world.landscape, ...patch };
    const nextWorld = touchWorld(world, {
      landscape,
      terrain:
        patch.width !== undefined || patch.depth !== undefined
          ? { ...world.terrain, size: Math.max(landscape.width, landscape.depth) }
          : world.terrain,
    });
    const affectsGround =
      patch.width !== undefined || patch.depth !== undefined || patch.resolution !== undefined;
    onUpdate(affectsGround ? adaptObjectsToLandscape(world, nextWorld) : nextWorld);
    setStatus(
      affectsGround
        ? "Landscape atualizado · objetos readaptados ao solo"
        : "Propriedades do Landscape atualizadas",
    );
  }

  function commitLandscapeSculpt(landscape: WorldLandscape) {
    const current = worldRef.current;
    onUpdate(adaptObjectsToLandscape(current, touchWorld(current, { landscape })));
    setSelection({ kind: "landscape", id: landscape.id });
    setStatus("Escultura aplicada · objetos readaptados · Ctrl+Z para desfazer");
  }

  function clearLandscape() {
    if (!world.landscape) return;
    const nextWorld = touchWorld(world, {
      landscape: clearLandscapeSculpting(world.landscape),
    });
    onUpdate(adaptObjectsToLandscape(world, nextWorld));
    setStatus("Escultura restaurada · objetos readaptados ao solo");
  }

  function removeLandscape() {
    if (!world.landscape) return;
    onUpdate(touchWorld(world, { landscape: null }));
    setLandscapeTool(null);
    setSelection(null);
    setStatus("Landscape removido · Ctrl+Z para desfazer");
  }

  function updateTerrain<K extends keyof StudioWorld["terrain"]>(
    field: K,
    value: StudioWorld["terrain"][K],
  ) {
    const normalizedValue =
      field === "size" && typeof value === "number" ? Math.min(2_048, Math.max(4, value)) : value;
    const nextWorld = touchWorld(world, {
      terrain: { ...world.terrain, [field]: normalizedValue },
      landscape:
        field === "size" && typeof normalizedValue === "number" && world.landscape
          ? resizeLandscape(world.landscape, { width: normalizedValue, depth: normalizedValue })
          : world.landscape,
    });
    const affectsGround = [
      "elevation",
      "roughness",
      "seed",
      "shape",
      "size",
      "waterLevel",
    ].includes(field);
    onUpdate(affectsGround ? adaptObjectsToLandscape(world, nextWorld) : nextWorld);
    setStatus(
      affectsGround ? "Terreno atualizado · objetos readaptados ao solo" : "Ambiente atualizado",
    );
  }

  function updateSurface<K extends keyof BoardSceneDefinition["surface"]>(
    field: K,
    value: BoardSceneDefinition["surface"][K],
  ) {
    setScene({ ...world.scene, surface: { ...world.scene.surface, [field]: value } });
  }

  function updateServer<K extends keyof StudioWorld["server"]>(
    field: K,
    value: StudioWorld["server"][K],
  ) {
    onUpdate(touchWorld(world, { server: { ...world.server, [field]: value } }));
  }

  async function publishWorld() {
    setStatus("Publicando mundo…");
    try {
      const response = await fetch("/__terrativa-studio/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          createWorldPackage({ ...world, scene: validateBoardScene(world.scene) }),
        ),
      });
      const payload = (await response.json()) as { message?: unknown };
      if (!response.ok)
        throw new Error(
          typeof payload.message === "string" ? payload.message : "Falha ao publicar",
        );
      onUpdate(touchWorld(world, { status: "published" }));
      setStatus(typeof payload.message === "string" ? payload.message : "Mundo publicado");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao publicar");
    }
  }

  function exportWorld() {
    downloadJson(world, `terrativa-world-${world.slug}.json`);
    setStatus("Pacote do mundo exportado");
  }

  async function importWorld(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const candidate = JSON.parse(await file.text()) as unknown;
      const payload =
        candidate && typeof candidate === "object" && "world" in candidate
          ? (candidate as { world: unknown }).world
          : candidate;
      const imported = parseStudioWorld(payload);
      onUpdate(
        touchWorld(
          {
            ...imported,
            id: world.id,
            slug: world.slug,
            status: "draft",
            scene: { ...imported.scene, boardSlug: world.slug },
          },
          {},
        ),
      );
      setSelection(null);
      setStatus("Mundo 3D completo importado");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Arquivo de mundo inválido");
    }
  }

  function restoreWorld() {
    const scene =
      world.slug === "baixada-santista"
        ? createDefaultBoardScene(world.slug, 36)
        : createDefaultBoardScene(world.slug, world.scene.tiles.length);
    setScene(scene);
    setSelection({ kind: "tile", position: 0 });
  }

  return (
    <div
      className={`world-studio ${layout.showContentDrawer ? "" : "is-content-hidden"} ${
        sideVisible ? "" : "is-side-hidden"
      }`}
      style={studioStyle}
    >
      <header className="world-studio-header">
        <nav className="studio-menu" aria-label="Menu do Studio">
          <div className="studio-menu-group">
            <button
              aria-expanded={activeMenu === "file"}
              onClick={() => setActiveMenu((current) => (current === "file" ? null : "file"))}
              type="button"
            >
              Arquivo
            </button>
            {activeMenu === "file" && (
              <div className="studio-menu-dropdown" role="menu">
                <button
                  onClick={() => {
                    saveCurrentWorld("manual");
                    setActiveMenu(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span>Salvar mundo atual</span>
                  <kbd>Ctrl+S</kbd>
                </button>
                <button
                  onClick={() => {
                    exportWorld();
                    setActiveMenu(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span>Exportar mundo…</span>
                </button>
                <button
                  onClick={() => {
                    importRef.current?.click();
                    setActiveMenu(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span>Importar mundo…</span>
                </button>
              </div>
            )}
          </div>
          <div className="studio-menu-group">
            <button
              aria-expanded={activeMenu === "edit"}
              onClick={() => setActiveMenu((current) => (current === "edit" ? null : "edit"))}
              type="button"
            >
              Editar
            </button>
            {activeMenu === "edit" && (
              <div className="studio-menu-dropdown" role="menu">
                <button
                  disabled={historyState.undo === 0}
                  onClick={undoWorldChange}
                  role="menuitem"
                  type="button"
                >
                  <span>Desfazer última ação</span>
                  <kbd>Ctrl+Z</kbd>
                </button>
                <button
                  disabled={historyState.redo === 0}
                  onClick={redoWorldChange}
                  role="menuitem"
                  type="button"
                >
                  <span>Refazer ação</span>
                  <kbd>Ctrl+Y</kbd>
                </button>
              </div>
            )}
          </div>
          <div className="studio-menu-group">
            <button
              aria-expanded={activeMenu === "window"}
              onClick={() => setActiveMenu((current) => (current === "window" ? null : "window"))}
              type="button"
            >
              Janela
            </button>
            {activeMenu === "window" && (
              <div className="studio-menu-dropdown is-window" role="menu">
                <button
                  aria-checked={layout.showOutliner}
                  onClick={() => togglePanel("showOutliner")}
                  role="menuitemcheckbox"
                  type="button"
                >
                  <b>{layout.showOutliner ? "✓" : ""}</b>
                  <span>Organizador</span>
                </button>
                <button
                  aria-checked={layout.showInspector}
                  onClick={() => togglePanel("showInspector")}
                  role="menuitemcheckbox"
                  type="button"
                >
                  <b>{layout.showInspector ? "✓" : ""}</b>
                  <span>Inspetor</span>
                </button>
                <button
                  aria-checked={layout.showContentDrawer}
                  onClick={() => togglePanel("showContentDrawer")}
                  role="menuitemcheckbox"
                  type="button"
                >
                  <b>{layout.showContentDrawer ? "✓" : ""}</b>
                  <span>Gaveta de Conteúdo</span>
                </button>
                <div className="studio-menu-separator" />
                <button onClick={restoreStudioLayout} role="menuitem" type="button">
                  <span>Restaurar layout padrão</span>
                </button>
              </div>
            )}
          </div>
          <button type="button">Ferramentas</button>
          <button type="button">Compilar</button>
          <button type="button">Plataformas</button>
          <button type="button">Ajuda</button>
        </nav>
        <div className="world-title">
          <button className="icon-button" onClick={onBack} title="Voltar aos mundos" type="button">
            ←
          </button>
          <span className="world-title-icon">◈</span>
          <div>
            <span>World Studio / {world.status === "published" ? "Publicado" : "Rascunho"}</span>
            <strong>{world.name}</strong>
          </div>
        </div>
        <span
          className={`world-save-state ${hasUnsavedChanges ? "has-unsaved-changes" : "is-saved"}`}
          title={
            lastSavedAt
              ? `Último salvamento: ${lastSavedAt.toLocaleString("pt-BR")}`
              : "Salvamento automático a cada 30 segundos"
          }
        >
          <i /> {status}
          {hasUnsavedChanges ? " · não salvo" : ""}
        </span>
        <button
          className="studio-save-button"
          onClick={() => saveCurrentWorld("manual")}
          title="Salvar mundo atual (Ctrl+S)"
          type="button"
        >
          ▣ Salvar
        </button>
        <button className="studio-header-button" onClick={exportWorld} type="button">
          Exportar
        </button>
        <button
          className="studio-header-button"
          onClick={() => importRef.current?.click()}
          type="button"
        >
          Importar
        </button>
        <input
          hidden
          accept="application/json"
          ref={importRef}
          onChange={(event) => void importWorld(event)}
          type="file"
        />
        <button className="admin-primary-button" onClick={() => void publishWorld()} type="button">
          Publicar mundo
        </button>
      </header>

      <section className="world-viewport">
        <div className="world-toolbar">
          <div className="tool-group">
            <ToolButton
              active={tool === "move"}
              label="Mover"
              onClick={() => setTool("move")}
              symbol="↔"
            />
            <ToolButton
              active={tool === "rotate"}
              label="Rotacionar"
              onClick={() => setTool("rotate")}
              symbol="↻"
            />
            <ToolButton
              active={tool === "scale"}
              label="Escalar"
              onClick={() => setTool("scale")}
              symbol="⤢"
            />
          </div>
          <span className="toolbar-separator" />
          <div className="tool-group">
            <ToolButton
              active={cameraView === "perspective"}
              label="Perspectiva"
              onClick={() => setCameraView("perspective")}
              symbol="◇"
            />
            <ToolButton
              active={cameraView === "top"}
              label="Vista superior"
              onClick={() => setCameraView("top")}
              symbol="▣"
            />
            <ToolButton
              active={showGrid}
              label="Grade"
              onClick={() => setShowGrid((value) => !value)}
              symbol="#"
            />
          </div>
          <button
            className={`toolbar-action landscape-mode-button ${landscapeTool ? "is-active" : ""}`}
            onClick={() => {
              if (!world.landscape) {
                createLandscape();
                return;
              }
              setSelection({ kind: "landscape", id: world.landscape.id });
              setLandscapeTool((current) => (current ? null : "raise"));
              setStatus(landscapeTool ? "Modo Landscape encerrado" : "Modo Landscape ativado");
            }}
            type="button"
          >
            {world.landscape ? "Landscape" : "＋ Criar Landscape"}
          </button>
          <button className="toolbar-reset" onClick={restoreWorld} type="button">
            Restaurar cena
          </button>
          <button className="toolbar-action" onClick={() => addWater("river")} type="button">
            ＋ Rio
          </button>
          <button className="toolbar-action" onClick={() => addWater("lake")} type="button">
            ＋ Lago
          </button>
        </div>
        <div className="canvas-frame">
          {landscapeTool && world.landscape && (
            <div className="landscape-tools-panel">
              <div className="landscape-panel-heading">
                <strong>LANDSCAPE</strong>
                <span>
                  <button
                    aria-label="Desfazer edição do Landscape"
                    disabled={historyState.undo === 0}
                    onClick={undoWorldChange}
                    title="Desfazer última edição (Ctrl+Z)"
                    type="button"
                  >
                    ↶ Desfazer
                  </button>
                  <button
                    aria-label="Refazer edição do Landscape"
                    disabled={historyState.redo === 0}
                    onClick={redoWorldChange}
                    title="Refazer edição (Ctrl+Y)"
                    type="button"
                  >
                    ↷ Refazer
                  </button>
                </span>
              </div>
              <div className="landscape-tool-buttons">
                {(
                  [
                    ["raise", "Elevar"],
                    ["lower", "Abaixar"],
                    ["smooth", "Suavizar"],
                    ["flatten", "Achatar"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={landscapeTool === value ? "is-active" : ""}
                    key={value}
                    onClick={() => setLandscapeTool(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label>
                <span>Raio {landscapeBrushRadius.toFixed(1)} m</span>
                <input
                  max={12}
                  min={0.5}
                  step={0.5}
                  type="range"
                  value={landscapeBrushRadius}
                  onChange={(event) => setLandscapeBrushRadius(Number(event.target.value))}
                />
              </label>
              <label>
                <span>Força {landscapeBrushStrength.toFixed(2)}</span>
                <input
                  max={2}
                  min={0.05}
                  step={0.05}
                  type="range"
                  value={landscapeBrushStrength}
                  onChange={(event) => setLandscapeBrushStrength(Number(event.target.value))}
                />
              </label>
              <button
                className="landscape-close"
                onClick={() => setLandscapeTool(null)}
                type="button"
              >
                Concluir
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="canvas-loading">
                <span />
                <strong>Preparando motor 3D</strong>
                <small>Carregando terreno, iluminação e assets…</small>
              </div>
            }
          >
            <WorldCanvas3D
              cameraView={cameraView}
              landscapeBrushRadius={landscapeBrushRadius}
              landscapeBrushStrength={landscapeBrushStrength}
              landscapeTool={landscapeTool}
              onCopySelection={copySelection}
              onDeleteSelection={deleteSelection}
              onDuplicateSelection={duplicateSelection}
              onPasteSelection={pasteSelection}
              onSculptLandscape={commitLandscapeSculpt}
              onSelect={selectFromStudio}
              onToggleGrid={() => setShowGrid((value) => !value)}
              onToolChange={setTool}
              onTransform={handleTransform}
              selection={selection}
              selections={selections}
              showGrid={showGrid}
              tool={tool}
              world={world}
            />
          </Suspense>
          <div className="viewport-hint">
            <span>
              {landscapeTool
                ? "LMB + arrastar: esculpir Landscape"
                : "LMB: selecionar · Ctrl+clique: seleção múltipla"}
            </span>
            <span>RMB + mouse: girar câmera</span>
            <span>WASD: mover · Q/E: altura</span>
            <span>1/2/3: mover/girar/escalar</span>
            <span>Centro do gizmo: mover livre</span>
            <span>Ctrl+C/V: copiar/colar · Ctrl+D: duplicar</span>
            <span>F: focar · Del: apagar</span>
          </div>
          <div className="viewport-stats">
            <span>WEBGL</span>
            <b>
              {world.scene.tiles.length +
                world.scene.props.length +
                world.waterBodies.length +
                world.vehicles.length +
                world.objects.length +
                (world.landscape ? 1 : 0)}{" "}
              objetos
            </b>
            {selections.length > 1 && <strong>{selections.length} selecionados</strong>}
          </div>
          <div className="axis-widget">
            <i className="axis-y">Y</i>
            <i className="axis-x">X</i>
            <i className="axis-z">Z</i>
          </div>
        </div>
      </section>

      <hr
        aria-label="Redimensionar painéis laterais"
        aria-orientation="vertical"
        aria-valuemax={620}
        aria-valuemin={260}
        aria-valuenow={layout.sideWidth}
        className="studio-splitter side-width-splitter"
        onKeyDown={(event) => resizeWithKeyboard("side", event)}
        onPointerDown={(event) => beginResize("side", event)}
        tabIndex={0}
        title="Arraste para redimensionar Organizador e Inspetor"
      />
      <aside
        className={`world-side-stack ${layout.showOutliner ? "" : "is-outliner-hidden"} ${
          layout.showInspector ? "" : "is-inspector-hidden"
        }`}
      >
        <StudioOutliner
          onCreateFolder={setOutlinerFolderParentId}
          onMoveSelections={moveSelectionsToFolder}
          onSelect={selectFromStudio}
          selection={selection}
          selections={selections}
          world={world}
        />
        <hr
          aria-label="Redimensionar Organizador"
          aria-orientation="horizontal"
          aria-valuemax={720}
          aria-valuemin={140}
          aria-valuenow={layout.outlinerHeight}
          className="studio-splitter outliner-height-splitter"
          onKeyDown={(event) => resizeWithKeyboard("outliner", event)}
          onPointerDown={(event) => beginResize("outliner", event)}
          tabIndex={0}
          title="Arraste para aumentar ou diminuir o Organizador"
        />
        <section className="world-inspector">
          <div className="panel-heading">
            <span>Inspetor</span>
            <strong>
              {selectedLandscape
                ? selectedLandscape.name
                : selectedTile
                  ? `Casa ${selectedTile.position}`
                  : selectedProp
                    ? getSceneAsset(selectedProp.assetId).label
                    : selectedWater
                      ? selectedWater.name
                      : selectedRoute
                        ? "Segmento de rota"
                        : selectedVehicle
                          ? selectedVehicle.name
                          : selectedObject
                            ? selectedObject.name
                            : "Ambiente"}
            </strong>
          </div>
          {selections.length > 1 && (
            <div className="multi-selection-summary">
              <b>{selections.length}</b>
              <span>
                <strong>Objetos selecionados</strong>
                <small>O gizmo move, gira e escala o grupo pelo centro coletivo.</small>
              </span>
            </div>
          )}
          {selectedLandscape && (
            <>
              <SelectionSummary
                color={world.terrain.groundColor}
                label={selectedLandscape.name}
                detail={`LANDSCAPE · ${(selectedLandscape.resolution + 1) ** 2} VÉRTICES`}
              />
              <LandscapeInspector
                landscape={selectedLandscape}
                onChange={updateLandscape}
                onClear={clearLandscape}
                onRemove={removeLandscape}
                onSculpt={() => setLandscapeTool("raise")}
              />
            </>
          )}
          {selectedTile && (
            <>
              <SelectionSummary
                color="#75C7B5"
                label={
                  tileByPosition.get(selectedTile.position)?.name ?? `Casa ${selectedTile.position}`
                }
                detail={tileByPosition.get(selectedTile.position)?.type ?? "TILE"}
              />
              <TransformInspector includeY={false} onChange={updateTile} value={selectedTile} />
            </>
          )}
          {selectedProp && (
            <>
              <SelectionSummary
                color={getSceneAsset(selectedProp.assetId).swatch}
                label={getSceneAsset(selectedProp.assetId).label}
                detail={`MALHA ESTÁTICA · ${selectedProp.id}`}
              />
              <TransformInspector includeY onChange={updateProp} value={selectedProp} />
              <button className="danger-button" onClick={removeProp} type="button">
                Remover da cena
              </button>
            </>
          )}
          {selectedWater && (
            <>
              <SelectionSummary
                color={selectedWater.color}
                label={selectedWater.name}
                detail={selectedWater.kind === "river" ? "ÁGUA / RIO" : "ÁGUA / LAGO"}
              />
              <section className="inspector-section">
                <h3>Forma da água</h3>
                <div className="field-grid">
                  <NumberField
                    label="Posição X"
                    value={selectedWater.x}
                    onChange={(x) => updateWater({ x })}
                  />
                  <NumberField
                    label="Posição Z"
                    value={selectedWater.z}
                    onChange={(z) => updateWater({ z })}
                  />
                  <NumberField
                    label="Largura"
                    value={selectedWater.width}
                    onChange={(width) => updateWater({ width })}
                  />
                  <NumberField
                    label="Comprimento"
                    value={selectedWater.length}
                    onChange={(length) => updateWater({ length })}
                  />
                  <NumberField
                    label="Rotação"
                    step={5}
                    value={Math.round((selectedWater.rotationY * 180) / Math.PI)}
                    onChange={(degrees) => updateWater({ rotationY: (degrees * Math.PI) / 180 })}
                  />
                  <ColorField
                    label="Cor"
                    value={selectedWater.color}
                    onChange={(color) => updateWater({ color })}
                  />
                </div>
              </section>
              <button className="danger-button" onClick={removeWorldElement} type="button">
                Remover água
              </button>
            </>
          )}
          {selectedVehicle && (
            <>
              <SelectionSummary
                color={
                  vehicleAssetCatalog.find((asset) => asset.id === selectedVehicle.assetId)
                    ?.color ?? "#75C7B5"
                }
                label={selectedVehicle.name}
                detail="VEÍCULO / TRANSPORTE"
              />
              <TransformInspector includeY onChange={updateVehicle} value={selectedVehicle} />
              <button className="danger-button" onClick={removeWorldElement} type="button">
                Remover veículo
              </button>
            </>
          )}
          {selectedObject && (
            <>
              <SelectionSummary
                color="#7FA6C9"
                label={selectedObject.name}
                detail="MALHA ESTÁTICA · MOBILIDADE ESTÁTICA"
              />
              <TransformInspector includeY onChange={updateObject} value={selectedObject} />
              <button className="danger-button" onClick={removeWorldElement} type="button">
                Remover objeto
              </button>
            </>
          )}
          {selectedRoute && (
            <>
              <SelectionSummary
                color={
                  selectedRoute.mode === "car"
                    ? "#F2B84B"
                    : selectedRoute.mode === "boat"
                      ? "#5CBFE0"
                      : "#A8E1D3"
                }
                label={`Casa ${selectedRoute.fromPosition} → ${selectedRoute.toPosition}`}
                detail="ROTA JOGÁVEL"
              />
              <section className="inspector-section">
                <h3>Deslocamento automático</h3>
                <label className="select-field">
                  <span>Modo do percurso</span>
                  <select
                    value={selectedRoute.mode}
                    onChange={(event) =>
                      updateRoute({ mode: event.target.value as WorldRoute["mode"] })
                    }
                  >
                    <option value="walk">Caminhar</option>
                    <option value="car">Ir de carro</option>
                    <option value="boat">Ir de barco</option>
                  </select>
                </label>
                <NumberField
                  label="Velocidade"
                  step={0.1}
                  value={selectedRoute.speed}
                  onChange={(speed) => updateRoute({ speed })}
                />
                {selectedRoute.mode === "car" && (
                  <label className="select-field">
                    <span>Veículo padrão</span>
                    <select
                      value={selectedRoute.vehicleAssetId ?? "taxi"}
                      onChange={(event) =>
                        updateRoute({ vehicleAssetId: event.target.value as VehicleAssetId })
                      }
                    >
                      {vehicleAssetCatalog.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="inspector-help">
                  Quando o jogador cair nesse trecho, o cliente poderá animar o peão caminhando ou
                  embarcar no veículo até o próximo ponto.
                </p>
              </section>
            </>
          )}
          {!selection && (
            <div className="empty-selection">
              <span>◇</span>
              <strong>Nenhum objeto selecionado</strong>
              <small>Clique em uma casa ou objeto na cena 3D.</small>
            </div>
          )}
          <TerrainInspector onSurface={updateSurface} onTerrain={updateTerrain} world={world} />
          <section className="inspector-section">
            <h3>Servidor multiplayer</h3>
            <div className="field-grid">
              <NumberField
                label="Jogadores"
                max={100}
                step={1}
                value={world.server.maxPlayers}
                onChange={(value) => updateServer("maxPlayers", Math.round(value))}
              />
              <NumberField
                label="Tick rate"
                max={60}
                step={1}
                value={world.server.tickRate}
                onChange={(value) => updateServer("tickRate", Math.round(value))}
              />
            </div>
            <label className="select-field">
              <span>Região</span>
              <select
                value={world.server.region}
                onChange={(event) =>
                  updateServer("region", event.target.value as StudioWorld["server"]["region"])
                }
              >
                <option value="auto">Automática</option>
                <option value="sa-east">América do Sul</option>
              </select>
            </label>
            <p className="inspector-help">
              Autoridade no servidor · uma sala por shard · scripts somente em sandbox.
            </p>
          </section>
        </section>
      </aside>
      <hr
        aria-label="Redimensionar Gaveta de Conteúdo"
        aria-orientation="horizontal"
        aria-valuemax={520}
        aria-valuemin={160}
        aria-valuenow={layout.contentHeight}
        className="studio-splitter content-height-splitter"
        onKeyDown={(event) => resizeWithKeyboard("content", event)}
        onPointerDown={(event) => beginResize("content", event)}
        tabIndex={0}
        title="Arraste para aumentar ou diminuir a Gaveta de Conteúdo"
      />
      <StudioContentDrawer
        onAddAsset={addContentAsset}
        onStatus={setStatus}
        onUpdate={onUpdate}
        world={world}
      />
      {outlinerFolderParentId !== undefined && (
        <StudioTextDialog
          confirmLabel={outlinerFolderParentId ? "Criar subpasta" : "Criar pasta"}
          description={
            outlinerFolderParentId
              ? `A subpasta será criada dentro de “${
                  world.outlinerFolders.find((folder) => folder.id === outlinerFolderParentId)
                    ?.name ?? "Pasta"
                }”.`
              : "A pasta será criada na raiz deste mundo."
          }
          initialValue={outlinerFolderParentId ? "Nova subpasta" : "Nova pasta"}
          inputLabel="Nome da pasta"
          onCancel={() => setOutlinerFolderParentId(undefined)}
          onConfirm={createSceneFolder}
          title={outlinerFolderParentId ? "Nova subpasta" : "Nova pasta no Organizador"}
        />
      )}
    </div>
  );
}

function LandscapeInspector({
  landscape,
  onChange,
  onClear,
  onRemove,
  onSculpt,
}: {
  readonly landscape: WorldLandscape;
  readonly onChange: (
    patch: Partial<Pick<WorldLandscape, "depth" | "name" | "resolution" | "visible" | "width">>,
  ) => void;
  readonly onClear: () => void;
  readonly onRemove: () => void;
  readonly onSculpt: () => void;
}) {
  return (
    <>
      <section className="inspector-section">
        <h3>Gerenciar Landscape</h3>
        <label className="inspector-field">
          <span>Nome</span>
          <input
            type="text"
            value={landscape.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <div className="field-grid">
          <NumberField
            label="Largura"
            max={2_048}
            step={1}
            value={landscape.width}
            onChange={(width) => onChange({ width })}
          />
          <NumberField
            label="Profundidade"
            max={2_048}
            step={1}
            value={landscape.depth}
            onChange={(depth) => onChange({ depth })}
          />
          <NumberField
            label="Resolução"
            max={64}
            step={1}
            value={landscape.resolution}
            onChange={(resolution) => onChange({ resolution: Math.round(resolution) })}
          />
          <label className="landscape-visible-field">
            <span>Visibilidade</span>
            <input
              checked={landscape.visible}
              type="checkbox"
              onChange={(event) => onChange({ visible: event.target.checked })}
            />
            <b>{landscape.visible ? "Visível" : "Oculto"}</b>
          </label>
        </div>
        <div className="landscape-inspector-actions">
          <button onClick={onSculpt} type="button">
            Esculpir
          </button>
          <button onClick={onClear} type="button">
            Restaurar relevo
          </button>
        </div>
        <p className="inspector-help">
          A largura e a profundidade aumentam ou diminuem o terreno. A resolução controla a
          quantidade de vértices disponíveis para escultura.
        </p>
      </section>
      <button className="danger-button" onClick={onRemove} type="button">
        Remover Landscape
      </button>
    </>
  );
}

function TerrainInspector({
  onSurface,
  onTerrain,
  world,
}: {
  readonly onSurface: <K extends keyof BoardSceneDefinition["surface"]>(
    field: K,
    value: BoardSceneDefinition["surface"][K],
  ) => void;
  readonly onTerrain: <K extends keyof StudioWorld["terrain"]>(
    field: K,
    value: StudioWorld["terrain"][K],
  ) => void;
  readonly world: StudioWorld;
}) {
  return (
    <section className="inspector-section">
      <h3>Terreno e ambiente</h3>
      <div className="field-grid">
        <NumberField
          label="Tamanho"
          value={world.terrain.size}
          onChange={(value) => onTerrain("size", value)}
        />
        <NumberField
          label="Elevação"
          value={world.terrain.elevation}
          onChange={(value) => onTerrain("elevation", value)}
        />
        <NumberField
          label="Relevo"
          max={1}
          step={0.05}
          value={world.terrain.roughness}
          onChange={(value) => onTerrain("roughness", value)}
        />
        <NumberField
          label="Nível da água"
          value={world.terrain.waterLevel}
          onChange={(value) => onTerrain("waterLevel", value)}
        />
        <NumberField
          label="Semente"
          step={1}
          value={world.terrain.seed}
          onChange={(value) => onTerrain("seed", Math.round(value))}
        />
        <NumberField
          label="Sol"
          step={0.05}
          value={world.terrain.sunIntensity}
          onChange={(value) => onTerrain("sunIntensity", value)}
        />
      </div>
      <div className="field-grid">
        <ColorField
          label="Terreno"
          value={world.terrain.groundColor}
          onChange={(value) => onTerrain("groundColor", value)}
        />
        <ColorField
          label="Água"
          value={world.terrain.waterColor}
          onChange={(value) => onTerrain("waterColor", value)}
        />
        <ColorField
          label="Céu"
          value={world.terrain.skyColor}
          onChange={(value) => onTerrain("skyColor", value)}
        />
        <ColorField
          label="Tabuleiro"
          value={world.scene.surface.baseColor}
          onChange={(value) => onSurface("baseColor", value)}
        />
      </div>
    </section>
  );
}

function TransformInspector({
  includeY,
  onChange,
  value,
}: {
  readonly includeY: boolean;
  readonly onChange: (patch: Record<string, number>) => void;
  readonly value: {
    readonly x: number;
    readonly z: number;
    readonly rotationY: number;
    readonly scale: number;
  } & Partial<{ readonly y: number }>;
}) {
  return (
    <section className="inspector-section">
      <h3>Transformação</h3>
      <div className="field-grid">
        <NumberField label="Posição X" value={value.x} onChange={(x) => onChange({ x })} />
        <NumberField label="Posição Z" value={value.z} onChange={(z) => onChange({ z })} />
        {includeY && (
          <NumberField label="Altura Y" value={value.y ?? 0} onChange={(y) => onChange({ y })} />
        )}
        <NumberField
          label="Rotação"
          step={5}
          value={Math.round((value.rotationY * 180) / Math.PI)}
          onChange={(degrees) => onChange({ rotationY: (degrees * Math.PI) / 180 })}
        />
        <NumberField
          label="Escala"
          step={0.05}
          value={value.scale}
          onChange={(scale) => onChange({ scale })}
        />
      </div>
    </section>
  );
}

function CreateWorldDialog({
  existingSlugs,
  onClose,
  onCreate,
}: {
  readonly existingSlugs: readonly string[];
  readonly onClose: () => void;
  readonly onCreate: (input: NewWorldInput) => void;
}) {
  const [name, setName] = useState("Novo território");
  const [slug, setSlug] = useState("novo-territorio");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<WorldTemplate>("island");
  const [tileCount, setTileCount] = useState(36);
  const valid =
    name.trim().length >= 2 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    !existingSlugs.includes(slug);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onCreate({ name: name.trim(), slug, description: description.trim(), template, tileCount });
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="create-world-dialog" onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">World builder</span>
            <h2>Criar novo mundo</h2>
            <p>Escolha uma base. Tudo poderá ser alterado no Studio 3D.</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="template-grid">
          <TemplateButton
            active={template === "island"}
            label="Ilha procedural"
            detail="Terreno orgânico com água"
            symbol="◉"
            onClick={() => setTemplate("island")}
          />
          <TemplateButton
            active={template === "coastal"}
            label="Cidade costeira"
            detail="Construções e cenário"
            symbol="▥"
            onClick={() => setTemplate("coastal")}
          />
          <TemplateButton
            active={template === "flat"}
            label="Base plana"
            detail="Mundo limpo e neutro"
            symbol="▱"
            onClick={() => setTemplate("flat")}
          />
        </div>
        <div className="dialog-fields">
          <label>
            <span>Nome do mundo</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug(slugify(event.target.value));
              }}
            />
          </label>
          <label>
            <span>Identificador</span>
            <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
            <small>
              {existingSlugs.includes(slug)
                ? "Este identificador já existe."
                : "Usado na URL e nos arquivos publicados."}
            </small>
          </label>
          <label className="is-wide">
            <span>Descrição</span>
            <textarea
              placeholder="Contexto e objetivo deste território…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            <span>Número de casas</span>
            <select
              value={tileCount}
              onChange={(event) => setTileCount(Number(event.target.value))}
            >
              <option value={24}>24 casas</option>
              <option value={36}>36 casas</option>
              <option value={48}>48 casas</option>
              <option value={60}>60 casas</option>
            </select>
          </label>
        </div>
        <footer>
          <button className="secondary-button" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="admin-primary-button" disabled={!valid} type="submit">
            Criar e abrir Studio
          </button>
        </footer>
      </form>
    </div>
  );
}

function WorldCard({
  onCopy,
  onOpen,
  onRemove,
  world,
}: {
  readonly onCopy?: () => void;
  readonly onOpen: () => void;
  readonly onRemove?: () => void;
  readonly world: StudioWorld;
}) {
  return (
    <article className="world-card">
      <button className={`world-preview is-${world.template}`} onClick={onOpen} type="button">
        <div className="preview-island">
          <i />
          <i />
          <i />
          <b />
        </div>
        <span className={`status-badge is-${world.status}`}>
          {world.status === "published" ? "Publicado" : "Rascunho"}
        </span>
      </button>
      <div className="world-card-content">
        <span>
          {world.template === "coastal"
            ? "Mundo costeiro"
            : world.template === "island"
              ? "Ilha procedural"
              : "Base plana"}
        </span>
        <h3>{world.name}</h3>
        <p>{world.description || "Mundo Terrativa em desenvolvimento."}</p>
        <div>
          <small>{world.scene.tiles.length} casas</small>
          <small>{world.scene.props.length} objetos</small>
          <small>Seed {world.terrain.seed}</small>
        </div>
      </div>
      <footer>
        <button className="secondary-button" onClick={onOpen} type="button">
          Abrir Studio
        </button>
        {onCopy && (
          <button className="icon-button" onClick={onCopy} title="Duplicar" type="button">
            ⧉
          </button>
        )}
        {onRemove && (
          <button
            className="icon-button is-danger"
            onClick={onRemove}
            title="Excluir"
            type="button"
          >
            ×
          </button>
        )}
      </footer>
    </article>
  );
}

function NavButton({
  active = false,
  icon,
  label,
  onClick,
}: {
  readonly active?: boolean;
  readonly icon: string;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button className={active ? "is-active" : ""} onClick={onClick} type="button">
      <i>{icon}</i>
      <span>{label}</span>
    </button>
  );
}

function MetricCard({
  accent,
  detail,
  label,
  value,
}: {
  readonly accent: string;
  readonly detail: string;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <article className={`metric-card is-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <i>↗</i>
    </article>
  );
}

function ToolButton({
  active,
  label,
  onClick,
  symbol,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly symbol: string;
}) {
  return (
    <button className={active ? "is-active" : ""} onClick={onClick} title={label} type="button">
      <b>{symbol}</b>
      <span>{label}</span>
    </button>
  );
}

function TemplateButton({
  active,
  detail,
  label,
  onClick,
  symbol,
}: {
  readonly active: boolean;
  readonly detail: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly symbol: string;
}) {
  return (
    <button className={active ? "is-active" : ""} onClick={onClick} type="button">
      <i>{symbol}</i>
      <strong>{label}</strong>
      <small>{detail}</small>
    </button>
  );
}

function SelectionSummary({
  color,
  detail,
  label,
}: {
  readonly color: string;
  readonly detail: string;
  readonly label: string;
}) {
  return (
    <div className="selection-summary">
      <i style={{ "--selection-color": color } as CSSProperties} />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function AssetGlyph({
  color,
  construction,
}: {
  readonly color: string;
  readonly construction: boolean;
}) {
  return (
    <span
      className={`asset-glyph ${construction ? "is-building" : "is-scenery"}`}
      style={{ "--asset-color": color } as CSSProperties}
    >
      <i />
      <b />
    </span>
  );
}

function NumberField({
  label,
  max,
  onChange,
  step = 0.1,
  value,
}: {
  readonly label: string;
  readonly max?: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly value: number;
}) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        max={max}
        step={step}
        type="number"
        value={round(value)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
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
    <label className="inspector-field color-input">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function readRoute(): { view: AdminView; worldId?: string } {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "studio" && parts[1]) return { view: "studio", worldId: parts[1] };
  if (parts[0] === "worlds" || parts[0] === "assets" || parts[0] === "dashboard")
    return { view: parts[0] };
  return { view: "dashboard" };
}

function viewTitle(view: AdminView, worldName?: string): string {
  if (view === "studio") return `Mundos / ${worldName ?? "Studio"}`;
  if (view === "worlds") return "Mundos";
  if (view === "assets") return "Biblioteca 3D";
  return "Visão geral";
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function formatSaveTime(value: Date): string {
  return value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function studioSelectionIdentity(selection: StudioSelection): string {
  return selection.kind === "tile"
    ? `tile:${selection.position}`
    : `${selection.kind}:${selection.id}`;
}

function didGroundGeometryChange(first: StudioWorld, second: StudioWorld): boolean {
  const terrainFields = ["elevation", "roughness", "seed", "shape", "size", "waterLevel"] as const;
  if (terrainFields.some((field) => first.terrain[field] !== second.terrain[field])) return true;
  const firstLandscape = first.landscape;
  const secondLandscape = second.landscape;
  if (!firstLandscape || !secondLandscape) return firstLandscape !== secondLandscape;
  if (
    firstLandscape.width !== secondLandscape.width ||
    firstLandscape.depth !== secondLandscape.depth ||
    firstLandscape.resolution !== secondLandscape.resolution ||
    firstLandscape.heightData.length !== secondLandscape.heightData.length
  ) {
    return true;
  }
  return firstLandscape.heightData.some(
    (height, index) => height !== secondLandscape.heightData[index],
  );
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
