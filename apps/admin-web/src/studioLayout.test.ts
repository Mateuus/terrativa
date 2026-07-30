// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_LAYOUT,
  loadStudioLayout,
  saveStudioLayout,
  studioLayoutStorageKey,
} from "./studioLayout";

describe("layout persistente do World Studio", () => {
  beforeEach(() => window.localStorage.clear());

  it("salva tamanhos e visibilidade separadamente por mundo", () => {
    saveStudioLayout("mundo-a", {
      contentHeight: 380,
      sideWidth: 440,
      outlinerHeight: 330,
      showContentDrawer: true,
      showOutliner: false,
      showInspector: true,
    });

    expect(loadStudioLayout("mundo-a")).toMatchObject({
      contentHeight: 380,
      sideWidth: 440,
      outlinerHeight: 330,
      showOutliner: false,
    });
    expect(loadStudioLayout("mundo-b")).toEqual(DEFAULT_STUDIO_LAYOUT);
  });

  it("normaliza valores inválidos vindos do armazenamento", () => {
    window.localStorage.setItem(
      studioLayoutStorageKey("mundo-a"),
      JSON.stringify({
        contentHeight: 9_000,
        sideWidth: 10,
        outlinerHeight: "inválido",
        showContentDrawer: false,
      }),
    );

    expect(loadStudioLayout("mundo-a")).toMatchObject({
      contentHeight: 520,
      sideWidth: 260,
      outlinerHeight: DEFAULT_STUDIO_LAYOUT.outlinerHeight,
      showContentDrawer: false,
    });
  });
});
