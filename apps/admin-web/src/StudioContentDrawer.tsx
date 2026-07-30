import { type ChangeEvent, type CSSProperties, useMemo, useRef, useState } from "react";
import { StaticMeshEditor } from "./StaticMeshEditor";
import { StaticMeshThumbnail } from "./StaticMeshThumbnail";
import { StudioTextDialog } from "./StudioDialog";
import {
  createDefaultStaticMeshSettings,
  createFolder,
  createScript,
  ENGINE_CONTENT_ROOT_ID,
  isEngineContentFolder,
  type StudioWorld,
  touchWorld,
  WORLD_CONTENT_ROOT_ID,
  type WorldContentAsset,
  type WorldContentFolder,
  type WorldScript,
} from "./worldModel";

interface StudioContentDrawerProps {
  readonly world: StudioWorld;
  readonly onUpdate: (world: StudioWorld) => void;
  readonly onAddAsset: (asset: WorldContentAsset) => void;
  readonly onStatus: (status: string) => void;
}

export function StudioContentDrawer({
  onAddAsset,
  onStatus,
  onUpdate,
  world,
}: StudioContentDrawerProps) {
  const [folderId, setFolderId] = useState(WORLD_CONTENT_ROOT_ID);
  const [expandedFolderIds, setExpandedFolderIds] = useState(
    () => new Set([WORLD_CONTENT_ROOT_ID, ENGINE_CONTENT_ROOT_ID]),
  );
  const [query, setQuery] = useState("");
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [creationDialog, setCreationDialog] = useState<"folder" | "script" | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const activeScript = world.scripts.find((script) => script.id === activeScriptId);
  const editingAsset = world.contentAssets.find((asset) => asset.id === editingAssetId);
  const activeScriptIsEngine = activeScript ? isEngineContentFolder(activeScript.folderId) : false;
  const assets = useMemo(
    () =>
      world.contentAssets.filter(
        (asset) =>
          asset.folderId === folderId &&
          (!query.trim() ||
            asset.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),
      ),
    [folderId, query, world.contentAssets],
  );
  const scripts = world.scripts.filter((script) => script.folderId === folderId);
  const engineFolder = isEngineContentFolder(folderId);
  const folderTree = useMemo(
    () => flattenFolderTree(world.contentFolders, expandedFolderIds),
    [expandedFolderIds, world.contentFolders],
  );

  function addFolder() {
    if (engineFolder) return;
    setCreationDialog("folder");
  }

  function confirmFolder(name: string) {
    if (engineFolder) {
      setCreationDialog(null);
      return;
    }
    onUpdate(
      touchWorld(world, {
        contentFolders: [...world.contentFolders, createFolder(name, folderId)],
      }),
    );
    setCreationDialog(null);
  }

  function addScript() {
    if (engineFolder) return;
    setCreationDialog("script");
  }

  function confirmScript(name: string) {
    if (engineFolder) {
      setCreationDialog(null);
      return;
    }
    const script = createScript(name, folderId === WORLD_CONTENT_ROOT_ID ? "scripts" : folderId);
    onUpdate(touchWorld(world, { scripts: [...world.scripts, script] }));
    setFolderId(script.folderId);
    setActiveScriptId(script.id);
    setCreationDialog(null);
  }

  function updateScript(script: WorldScript, patch: Partial<WorldScript>) {
    if (isEngineContentFolder(script.folderId)) return;
    onUpdate(
      touchWorld(world, {
        scripts: world.scripts.map((candidate) =>
          candidate.id === script.id ? { ...candidate, ...patch } : candidate,
        ),
      }),
    );
  }

  function updateContentAsset(asset: WorldContentAsset) {
    if (asset.source === "bundled") return;
    onUpdate(
      touchWorld(world, {
        contentAssets: world.contentAssets.map((candidate) =>
          candidate.id === asset.id ? asset : candidate,
        ),
      }),
    );
  }

  function duplicateAssetToContent(asset: WorldContentAsset) {
    const editableAsset = structuredClone(asset);
    Reflect.deleteProperty(editableAsset, "catalogRef");
    const id = `project-mesh-${Date.now().toString(36)}`;
    const copy: WorldContentAsset = {
      ...editableAsset,
      id,
      name: `${asset.name} Cópia`,
      folderId: "uploads",
      source: "project",
      provider: `${asset.provider} · cópia editável`,
      staticMesh: structuredClone(asset.staticMesh ?? createDefaultStaticMeshSettings()),
    };
    onUpdate(touchWorld(world, { contentAssets: [...world.contentAssets, copy] }));
    setFolderId("uploads");
    setEditingAssetId(id);
    onStatus(`${copy.name} criada em Conteúdo/Importados`);
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (engineFolder) {
      onStatus("A pasta Engine é somente leitura. Importe o asset em Conteúdo.");
      return;
    }
    onStatus(`Importando ${file.name}…`);
    try {
      const response = await fetch(
        `/__terrativa-studio/assets?world=${encodeURIComponent(world.slug)}`,
        {
          method: "POST",
          headers: {
            "content-type": file.type || "application/octet-stream",
            "x-asset-name": encodeURIComponent(file.name),
          },
          body: file,
        },
      );
      const payload = (await response.json()) as {
        id?: unknown;
        url?: unknown;
        name?: unknown;
        mimeType?: unknown;
        size?: unknown;
      };
      if (
        !response.ok ||
        typeof payload.id !== "string" ||
        typeof payload.url !== "string" ||
        typeof payload.name !== "string"
      ) {
        throw new Error("O servidor recusou o asset.");
      }
      const asset: WorldContentAsset = {
        id: payload.id,
        name: payload.name,
        kind: assetKind(file),
        folderId: folderId === WORLD_CONTENT_ROOT_ID ? "uploads" : folderId,
        source: "uploaded",
        url: payload.url,
        mimeType: typeof payload.mimeType === "string" ? payload.mimeType : file.type,
        size: typeof payload.size === "number" ? payload.size : file.size,
        license: "Definida pelo autor do mundo",
        provider: "Upload do administrador",
        defaultScale: 1,
        ...(assetKind(file) === "model"
          ? {
              modelType: "static-mesh" as const,
              staticMesh: createDefaultStaticMeshSettings(),
            }
          : {}),
      };
      onUpdate(touchWorld(world, { contentAssets: [...world.contentAssets, asset] }));
      setFolderId(asset.folderId);
      onStatus(`${file.name} importado para o mundo`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Falha ao importar asset");
    }
  }

  return (
    <section className="studio-content-drawer">
      <header>
        <strong>Gaveta de Conteúdo</strong>
        <span className={`drawer-scope-badge ${engineFolder ? "is-engine" : "is-content"}`}>
          {engineFolder ? "Engine · somente leitura" : "Conteúdo do mundo"}
        </span>
        <button
          disabled={engineFolder}
          onClick={addFolder}
          title={engineFolder ? "Selecione uma pasta de Conteúdo para criar arquivos" : undefined}
          type="button"
        >
          ＋ Pasta
        </button>
        <button
          disabled={engineFolder}
          onClick={() => uploadRef.current?.click()}
          title={engineFolder ? "Assets da Engine não podem ser alterados" : undefined}
          type="button"
        >
          ⇧ Importar
        </button>
        <button
          disabled={engineFolder}
          onClick={addScript}
          title={engineFolder ? "Scripts do mundo ficam em Conteúdo" : undefined}
          type="button"
        >
          JS Novo script
        </button>
        <label>
          ⌕
          <input
            placeholder="Pesquisar em Conteúdo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <input
          accept=".glb,.gltf,.png,.jpg,.jpeg,.webp,.mp3,.ogg,.wav,.json"
          hidden
          ref={uploadRef}
          onChange={(event) => void uploadAsset(event)}
          type="file"
        />
      </header>
      <div className="content-drawer-body">
        <nav className="content-folder-tree" aria-label="Pastas do mundo">
          {folderTree.map(({ depth, folder, hasChildren }) => (
            <div
              className={`content-folder-row ${
                folder.id === folderId ? "is-active" : ""
              } ${isEngineContentFolder(folder.id) ? "is-engine" : "is-content"}`}
              key={folder.id}
              style={{ "--folder-depth": depth } as CSSProperties}
            >
              <button
                aria-label={`${expandedFolderIds.has(folder.id) ? "Recolher" : "Expandir"} ${folder.name}`}
                className="content-folder-toggle"
                disabled={!hasChildren}
                onClick={() => setExpandedFolderIds((current) => toggleFolder(current, folder.id))}
                type="button"
              >
                {hasChildren ? (expandedFolderIds.has(folder.id) ? "▾" : "›") : ""}
              </button>
              <button
                className="content-folder-name"
                onClick={() => {
                  setFolderId(folder.id);
                  setActiveScriptId(null);
                  if (hasChildren) {
                    setExpandedFolderIds((current) => new Set(current).add(folder.id));
                  }
                }}
                type="button"
              >
                <b>{isEngineContentFolder(folder.id) ? "◆" : "▰"}</b>
                <span>{folder.name}</span>
                {folder.id === ENGINE_CONTENT_ROOT_ID && <small>LOCK</small>}
              </button>
            </div>
          ))}
        </nav>
        <div className="content-assets">
          <div className="content-breadcrumb">
            <span>{folderPath(world, folderId)}</span>
            <b className={engineFolder ? "is-engine" : "is-content"}>
              {engineFolder ? "ENGINE" : "MUNDO"}
            </b>
          </div>
          <div className="content-grid">
            {world.contentFolders
              .filter((folder) => folder.parentId === folderId)
              .map((folder) => (
                <button
                  className="content-card is-folder"
                  key={folder.id}
                  onDoubleClick={() => setFolderId(folder.id)}
                  type="button"
                >
                  <span>▰</span>
                  <strong>{folder.name}</strong>
                  <small>Pasta</small>
                </button>
              ))}
            {assets.map((asset) => (
              <article
                className={`content-card is-asset ${asset.source === "bundled" ? "is-engine" : ""}`}
                key={asset.id}
              >
                <button
                  className="content-card-open"
                  onDoubleClick={() => asset.kind === "model" && setEditingAssetId(asset.id)}
                  title={
                    asset.kind === "model"
                      ? "Clique duas vezes para abrir o Editor de Malha Estática"
                      : asset.name
                  }
                  type="button"
                >
                  {asset.kind === "model" ? (
                    <StaticMeshThumbnail asset={asset} />
                  ) : (
                    <span className="content-asset-glyph">
                      {asset.kind === "audio" ? "♫" : "▧"}
                    </span>
                  )}
                  <strong>{asset.name}</strong>
                  <em>{asset.kind === "model" ? "Malha Estática" : asset.kind}</em>
                  <small>
                    {asset.source === "bundled" ? "Engine" : "Mundo"} · {asset.provider} ·{" "}
                    {asset.license}
                  </small>
                </button>
                {asset.kind === "model" && (
                  <button
                    className="content-card-add"
                    onClick={() => onAddAsset(asset)}
                    title={`Adicionar ${asset.name} à cena`}
                    type="button"
                  >
                    ＋ Cena
                  </button>
                )}
              </article>
            ))}
            {scripts.map((script) => (
              <button
                className={`content-card is-script ${
                  isEngineContentFolder(script.folderId) ? "is-engine" : ""
                } ${script.id === activeScriptId ? "is-selected" : ""}`}
                key={script.id}
                onDoubleClick={() => setActiveScriptId(script.id)}
                type="button"
              >
                <span>JS</span>
                <strong>{script.name}</strong>
                <small>
                  {isEngineContentFolder(script.folderId)
                    ? "Engine · somente leitura"
                    : script.enabled
                      ? "Ativo no sandbox"
                      : "Desativado"}
                </small>
              </button>
            ))}
          </div>
        </div>
        {activeScript && (
          <aside className="script-editor">
            <header>
              <span>JS</span>
              <strong>{activeScript.name}</strong>
              <label>
                <input
                  checked={activeScript.enabled}
                  disabled={activeScriptIsEngine}
                  onChange={(event) =>
                    updateScript(activeScript, { enabled: event.target.checked })
                  }
                  type="checkbox"
                />
                Habilitar no sandbox
              </label>
              <button onClick={() => setActiveScriptId(null)} type="button">
                ×
              </button>
            </header>
            <textarea
              aria-label={`Código de ${activeScript.name}`}
              readOnly={activeScriptIsEngine}
              spellCheck={false}
              value={activeScript.source}
              onChange={(event) => updateScript(activeScript, { source: event.target.value })}
            />
            <footer>
              {activeScriptIsEngine ? (
                <>Arquivo interno da Engine · somente leitura.</>
              ) : (
                <>
                  Scripts não usam <code>eval</code>. A publicação marca execução obrigatória em
                  sandbox.
                </>
              )}
            </footer>
          </aside>
        )}
      </div>
      {editingAsset?.kind === "model" && (
        <StaticMeshEditor
          asset={editingAsset}
          onAddToScene={() => onAddAsset(editingAsset)}
          onClose={() => setEditingAssetId(null)}
          onDuplicateToContent={() => duplicateAssetToContent(editingAsset)}
          onUpdate={updateContentAsset}
          readOnly={editingAsset.source === "bundled"}
          world={world}
        />
      )}
      {creationDialog === "folder" && (
        <StudioTextDialog
          confirmLabel="Criar pasta"
          description={`A pasta será criada dentro de ${folderName(world, folderId)}.`}
          initialValue="Nova pasta"
          inputLabel="Nome da pasta"
          onCancel={() => setCreationDialog(null)}
          onConfirm={confirmFolder}
          title="Nova pasta"
        />
      )}
      {creationDialog === "script" && (
        <StudioTextDialog
          confirmLabel="Criar script"
          description="O arquivo será criado no mundo atual e executado somente no sandbox."
          initialValue="novo-script.js"
          inputLabel="Nome do script"
          onCancel={() => setCreationDialog(null)}
          onConfirm={confirmScript}
          title="Novo script JavaScript"
        />
      )}
    </section>
  );
}

function folderName(world: StudioWorld, folderId: string): string {
  return world.contentFolders.find((folder) => folder.id === folderId)?.name ?? "Conteúdo";
}

function folderPath(world: StudioWorld, folderId: string): string {
  const folders = new Map(world.contentFolders.map((folder) => [folder.id, folder]));
  const path: string[] = [];
  const visited = new Set<string>();
  let current = folders.get(folderId);
  while (current && !visited.has(current.id)) {
    path.unshift(current.name);
    visited.add(current.id);
    current = current.parentId ? folders.get(current.parentId) : undefined;
  }
  return path.join(" › ") || "Conteúdo";
}

function flattenFolderTree(
  folders: readonly WorldContentFolder[],
  expandedIds: ReadonlySet<string>,
): Array<{ folder: WorldContentFolder; depth: number; hasChildren: boolean }> {
  const children = new Map<string | null, WorldContentFolder[]>();
  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? [];
    siblings.push(folder);
    children.set(folder.parentId, siblings);
  }
  const flattened: Array<{
    folder: WorldContentFolder;
    depth: number;
    hasChildren: boolean;
  }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of children.get(parentId) ?? []) {
      const hasChildren = (children.get(folder.id)?.length ?? 0) > 0;
      flattened.push({ folder, depth, hasChildren });
      if (hasChildren && expandedIds.has(folder.id)) visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return flattened;
}

function toggleFolder(current: ReadonlySet<string>, folderId: string): Set<string> {
  const next = new Set(current);
  if (next.has(folderId)) next.delete(folderId);
  else next.add(folderId);
  return next;
}

function assetKind(file: File): WorldContentAsset["kind"] {
  if (file.type.startsWith("image/")) return "texture";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.name.toLowerCase().endsWith(".json")) return "data";
  return "model";
}
