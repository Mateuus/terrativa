import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type { StudioSelection } from "./WorldCanvas3D";
import type { StudioWorld, WorldOutlinerFolder } from "./worldModel";

interface StudioOutlinerProps {
  readonly world: StudioWorld;
  readonly selection: StudioSelection | null;
  readonly selections: readonly StudioSelection[];
  readonly onCreateFolder: (parentId: string | null) => void;
  readonly onMoveSelections: (folderId: string | null) => void;
  readonly onSelect: (selection: StudioSelection, additive: boolean) => void;
}

interface OutlinerItem {
  readonly key: string;
  readonly assignmentKey: string;
  readonly label: string;
  readonly type: string;
  readonly selection: StudioSelection;
}

interface OutlinerGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly OutlinerItem[];
}

export function StudioOutliner({
  onCreateFolder,
  onMoveSelections,
  onSelect,
  selection,
  selections,
  world,
}: StudioOutlinerProps) {
  const [query, setQuery] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const groups = useMemo<readonly OutlinerGroup[]>(
    () => [
      {
        id: "landscape",
        label: "Terreno",
        items: world.landscape
          ? [
              {
                key: `landscape-${world.landscape.id}`,
                assignmentKey: `landscape:${world.landscape.id}`,
                label: world.landscape.name,
                type: "Landscape",
                selection: {
                  kind: "landscape",
                  id: world.landscape.id,
                } satisfies StudioSelection,
              },
            ]
          : [],
      },
      {
        id: "board",
        label: "Tabuleiro",
        items: world.scene.tiles.map(
          (tile): OutlinerItem => ({
            key: `tile-${tile.position}`,
            assignmentKey: `tile:${tile.position}`,
            label: `Casa ${tile.position}`,
            type: "Ponto jogável",
            selection: { kind: "tile", position: tile.position },
          }),
        ),
      },
      {
        id: "actors",
        label: "Atores",
        items: [
          ...world.scene.props.map(
            (prop): OutlinerItem => ({
              key: `prop-${prop.id}`,
              assignmentKey: `prop:${prop.id}`,
              label: prop.id,
              type: "StaticMesh",
              selection: { kind: "prop", id: prop.id },
            }),
          ),
          ...world.objects.map(
            (object): OutlinerItem => ({
              key: `object-${object.id}`,
              assignmentKey: `object:${object.id}`,
              label: object.name,
              type: "Malha Estática",
              selection: { kind: "object", id: object.id },
            }),
          ),
          ...world.vehicles.map(
            (vehicle): OutlinerItem => ({
              key: `vehicle-${vehicle.id}`,
              assignmentKey: `vehicle:${vehicle.id}`,
              label: vehicle.name,
              type: "Veículo",
              selection: { kind: "vehicle", id: vehicle.id },
            }),
          ),
        ],
      },
      {
        id: "environment",
        label: "Ambiente",
        items: world.waterBodies.map(
          (water): OutlinerItem => ({
            key: `water-${water.id}`,
            assignmentKey: `water:${water.id}`,
            label: water.name,
            type: water.kind === "river" ? "Rio" : "Lago",
            selection: { kind: "water", id: water.id },
          }),
        ),
      },
      {
        id: "routes",
        label: "Rotas",
        items: world.routes.map(
          (route): OutlinerItem => ({
            key: `route-${route.id}`,
            assignmentKey: `route:${route.id}`,
            label: `${route.fromPosition} → ${route.toPosition}`,
            type: route.mode,
            selection: { kind: "route", id: route.id },
          }),
        ),
      },
    ],
    [world],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const allItems = groups.flatMap((group) => group.items);
  const validFolderIds = new Set(world.outlinerFolders.map((folder) => folder.id));
  const assignedFolder = (item: OutlinerItem) => {
    const folderId = world.outlinerAssignments[item.assignmentKey];
    return folderId && validFolderIds.has(folderId) ? folderId : null;
  };
  const selectedKeys = new Set(selections.map(selectionIdentity));
  const hasAssignedSelection = [...selectedKeys].some(
    (key) => world.outlinerAssignments[key] && validFolderIds.has(world.outlinerAssignments[key]),
  );
  const actorCount = allItems.length;

  useEffect(() => {
    if (activeFolderId && !validFolderIds.has(activeFolderId)) setActiveFolderId(null);
  }, [activeFolderId, validFolderIds]);

  function toggleCollapsed(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function matchesItem(item: OutlinerItem) {
    return (
      !normalizedQuery ||
      `${item.label} ${item.type}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
    );
  }

  function folderMatches(folder: WorldOutlinerFolder, visited = new Set<string>()): boolean {
    if (!normalizedQuery) return true;
    if (visited.has(folder.id)) return false;
    visited.add(folder.id);
    if (folder.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery)) return true;
    if (allItems.some((item) => assignedFolder(item) === folder.id && matchesItem(item))) {
      return true;
    }
    return world.outlinerFolders
      .filter((candidate) => candidate.parentId === folder.id)
      .some((child) => folderMatches(child, new Set(visited)));
  }

  function renderItem(item: OutlinerItem, depth = 0) {
    return (
      <button
        className={`outliner-item ${isSelected(selections, item.selection) ? "is-selected" : ""} ${
          selection && sameSelection(selection, item.selection) ? "is-active" : ""
        }`}
        key={item.key}
        onClick={(event) => onSelect(item.selection, event.ctrlKey || event.metaKey)}
        style={{ "--outliner-depth": depth } as CSSProperties}
        title={`${item.label} · ${item.type}`}
        type="button"
      >
        <span>◇</span>
        <strong>{item.label}</strong>
        <small>{item.type}</small>
      </button>
    );
  }

  function renderFolder(folder: WorldOutlinerFolder, depth: number, visited: ReadonlySet<string>) {
    if (visited.has(folder.id) || !folderMatches(folder)) return null;
    const nextVisited = new Set(visited).add(folder.id);
    const children = world.outlinerFolders.filter((candidate) => candidate.parentId === folder.id);
    const items = allItems.filter(
      (item) => assignedFolder(item) === folder.id && matchesItem(item),
    );
    const collapseKey = `folder:${folder.id}`;
    const isCollapsed = !normalizedQuery && collapsed.has(collapseKey);
    return (
      <div className="outliner-folder" key={folder.id}>
        <div
          className={`outliner-folder-row ${activeFolderId === folder.id ? "is-active" : ""}`}
          style={{ "--outliner-depth": depth } as CSSProperties}
        >
          <button
            aria-label={`${isCollapsed ? "Expandir" : "Recolher"} pasta ${folder.name}`}
            className="outliner-collapse-button"
            onClick={() => toggleCollapsed(collapseKey)}
            title={isCollapsed ? "Expandir pasta" : "Recolher pasta"}
            type="button"
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
          <button
            className="outliner-folder-select"
            onClick={() => setActiveFolderId(folder.id)}
            title={`Selecionar pasta ${folder.name}`}
            type="button"
          >
            <b>▰</b>
            <strong>{folder.name}</strong>
            <small>{items.length}</small>
          </button>
          <button
            aria-label={`Criar subpasta em ${folder.name}`}
            className="outliner-folder-add"
            onClick={() => onCreateFolder(folder.id)}
            title="Criar subpasta"
            type="button"
          >
            +
          </button>
        </div>
        {!isCollapsed && (
          <div className="outliner-folder-children">
            {children.map((child) => renderFolder(child, depth + 1, nextVisited))}
            {items.map((item) => renderItem(item, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const worldCollapsed = !normalizedQuery && collapsed.has("world");

  return (
    <section className="studio-outliner">
      <header className="studio-panel-tab">
        <strong>Organizador</strong>
        <div className="outliner-actions">
          <button onClick={() => onCreateFolder(null)} title="Criar pasta na raiz" type="button">
            + Pasta
          </button>
          <button
            disabled={!activeFolderId || selections.length === 0}
            onClick={() => activeFolderId && onMoveSelections(activeFolderId)}
            title="Mover os objetos selecionados para a pasta ativa"
            type="button"
          >
            Mover aqui
          </button>
          <button
            disabled={!hasAssignedSelection}
            onClick={() => onMoveSelections(null)}
            title="Retirar os objetos selecionados da pasta"
            type="button"
          >
            Retirar
          </button>
        </div>
        <span>{actorCount} atores</span>
      </header>
      <label className="outliner-search">
        ⌕
        <input
          aria-label="Pesquisar objetos da cena"
          placeholder="Pesquisar..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="outliner-tree">
        <button
          aria-expanded={!worldCollapsed}
          className="outliner-world-row"
          onClick={() => toggleCollapsed("world")}
          type="button"
        >
          <span>{worldCollapsed ? "▸" : "▾"}</span>
          <b>◭</b>
          <strong>{world.name}</strong>
          <small>Mundo</small>
        </button>
        {!worldCollapsed && (
          <>
            <div className="outliner-custom-folders">
              {world.outlinerFolders
                .filter((folder) => folder.parentId === null)
                .map((folder) => renderFolder(folder, 0, new Set()))}
            </div>
            {groups.map((group) => {
              const groupLabelMatches = group.label
                .toLocaleLowerCase("pt-BR")
                .includes(normalizedQuery);
              const items = group.items.filter(
                (item) => !assignedFolder(item) && (groupLabelMatches || matchesItem(item)),
              );
              if (normalizedQuery && items.length === 0) return null;
              const collapseKey = `group:${group.id}`;
              const isCollapsed = !normalizedQuery && collapsed.has(collapseKey);
              return (
                <div className="outliner-group" key={group.id}>
                  <button
                    aria-expanded={!isCollapsed}
                    className="outliner-group-label"
                    onClick={() => toggleCollapsed(collapseKey)}
                    type="button"
                  >
                    <span>{isCollapsed ? "▸" : "▾"}</span>
                    <b>▰</b>
                    <strong>{group.label}</strong>
                    <small>{items.length}</small>
                  </button>
                  {!isCollapsed && items.map((item) => renderItem(item))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

function selectionIdentity(selection: StudioSelection): string {
  return selection.kind === "tile"
    ? `tile:${selection.position}`
    : `${selection.kind}:${selection.id}`;
}

function isSelected(selections: readonly StudioSelection[], candidate: StudioSelection): boolean {
  return selections.some((selection) => sameSelection(selection, candidate));
}

function sameSelection(first: StudioSelection, second: StudioSelection): boolean {
  if (first.kind !== second.kind) return false;
  if (first.kind === "tile" && second.kind === "tile") return first.position === second.position;
  return first.kind !== "tile" && second.kind !== "tile" && first.id === second.id;
}
