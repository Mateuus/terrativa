// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StudioContentDrawer } from "./StudioContentDrawer";
import { createInitialWorld } from "./worldModel";

describe("StudioContentDrawer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("separa Conteúdo editável e Engine somente leitura", () => {
    act(() =>
      root.render(
        <StudioContentDrawer
          onAddAsset={() => undefined}
          onStatus={() => undefined}
          onUpdate={() => undefined}
          world={createInitialWorld()}
        />,
      ),
    );

    const engineFolder = [
      ...container.querySelectorAll<HTMLButtonElement>(".content-folder-name"),
    ].find((button) => button.textContent?.includes("Engine"));
    expect(engineFolder).toBeTruthy();
    act(() => engineFolder?.click());

    const createFolder = [...container.querySelectorAll<HTMLButtonElement>("header button")].find(
      (button) => button.textContent?.includes("Pasta"),
    );
    const importAsset = [...container.querySelectorAll<HTMLButtonElement>("header button")].find(
      (button) => button.textContent?.includes("Importar"),
    );
    const createScript = [...container.querySelectorAll<HTMLButtonElement>("header button")].find(
      (button) => button.textContent?.includes("Novo script"),
    );

    expect(container.textContent).toContain("Engine · somente leitura");
    expect(createFolder?.disabled).toBe(true);
    expect(importAsset?.disabled).toBe(true);
    expect(createScript?.disabled).toBe(true);
  });

  it("abre o Editor de Malha Estática com duplo clique no arquivo 3D", () => {
    act(() =>
      root.render(
        <StudioContentDrawer
          onAddAsset={() => undefined}
          onStatus={() => undefined}
          onUpdate={() => undefined}
          world={createInitialWorld()}
        />,
      ),
    );

    const buildingsFolder = [
      ...container.querySelectorAll<HTMLButtonElement>(
        ".content-folder-row.is-engine .content-folder-name",
      ),
    ].find((button) => button.textContent?.includes("Construções"));
    expect(buildingsFolder).toBeTruthy();
    act(() => buildingsFolder?.click());

    const meshFile = container.querySelector<HTMLButtonElement>(".content-card-open");
    expect(meshFile).toBeTruthy();
    act(() => meshFile?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain("MALHA ESTÁTICA");
    expect(container.textContent).toContain("Duplicar em Conteúdo");
    expect(container.textContent).toContain("Slots de Material");
  });
});
