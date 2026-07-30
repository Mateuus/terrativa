export interface StudioLayout {
  readonly contentHeight: number;
  readonly sideWidth: number;
  readonly outlinerHeight: number;
  readonly showContentDrawer: boolean;
  readonly showOutliner: boolean;
  readonly showInspector: boolean;
}

export const DEFAULT_STUDIO_LAYOUT: StudioLayout = Object.freeze({
  contentHeight: 250,
  sideWidth: 330,
  outlinerHeight: 280,
  showContentDrawer: true,
  showOutliner: true,
  showInspector: true,
});

const STORAGE_PREFIX = "terrativa.world-studio.layout.v1";

export function loadStudioLayout(worldId: string): StudioLayout {
  try {
    const value = window.localStorage.getItem(storageKey(worldId));
    if (!value) return { ...DEFAULT_STUDIO_LAYOUT };
    const parsed = JSON.parse(value) as Partial<StudioLayout>;
    return normalizeStudioLayout(parsed);
  } catch {
    return { ...DEFAULT_STUDIO_LAYOUT };
  }
}

export function saveStudioLayout(worldId: string, layout: StudioLayout): void {
  window.localStorage.setItem(storageKey(worldId), JSON.stringify(normalizeStudioLayout(layout)));
}

export function resetStudioLayout(): StudioLayout {
  return { ...DEFAULT_STUDIO_LAYOUT };
}

export function studioLayoutStorageKey(worldId: string): string {
  return storageKey(worldId);
}

function normalizeStudioLayout(value: Partial<StudioLayout>): StudioLayout {
  return {
    contentHeight: clampNumber(value.contentHeight, 160, 520, DEFAULT_STUDIO_LAYOUT.contentHeight),
    sideWidth: clampNumber(value.sideWidth, 260, 620, DEFAULT_STUDIO_LAYOUT.sideWidth),
    outlinerHeight: clampNumber(
      value.outlinerHeight,
      140,
      720,
      DEFAULT_STUDIO_LAYOUT.outlinerHeight,
    ),
    showContentDrawer:
      typeof value.showContentDrawer === "boolean"
        ? value.showContentDrawer
        : DEFAULT_STUDIO_LAYOUT.showContentDrawer,
    showOutliner:
      typeof value.showOutliner === "boolean"
        ? value.showOutliner
        : DEFAULT_STUDIO_LAYOUT.showOutliner,
    showInspector:
      typeof value.showInspector === "boolean"
        ? value.showInspector
        : DEFAULT_STUDIO_LAYOUT.showInspector,
  };
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}

function storageKey(worldId: string): string {
  return `${STORAGE_PREFIX}:${worldId}`;
}
