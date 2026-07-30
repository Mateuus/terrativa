// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApp } from "./AdminApp";
import { studioLayoutStorageKey } from "./studioLayout";

describe("Terrativa Admin", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "/dashboard";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("renderiza o painel geral e abre o catálogo de mundos", () => {
    act(() => root.render(<AdminApp />));
    expect(container.textContent).toContain("Visão geral");
    expect(container.textContent).toContain("Mundos da plataforma");

    const worldsButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Mundos"),
    );
    expect(worldsButton).toBeTruthy();
    act(() => worldsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("Criar novo mundo");
    expect(container.textContent).toContain("Baixada Santista");
  });

  it("abre o fluxo de criação com os três modelos de terreno", () => {
    act(() => root.render(<AdminApp />));
    const createButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Novo mundo"),
    );
    act(() => createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("Ilha procedural");
    expect(container.textContent).toContain("Cidade costeira");
    expect(container.textContent).toContain("Base plana");
  });

  it("personaliza e persiste os painéis pelo menu Janela", () => {
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));

    const windowMenu = [
      ...container.querySelectorAll<HTMLButtonElement>(".studio-menu button"),
    ].find((button) => button.textContent?.trim() === "Janela");
    act(() => windowMenu?.click());

    const drawerToggle = [
      ...container.querySelectorAll<HTMLButtonElement>(".studio-menu-dropdown button"),
    ].find((button) => button.textContent?.includes("Gaveta de Conteúdo"));
    expect(drawerToggle).toBeTruthy();
    act(() => drawerToggle?.click());

    expect(container.querySelector(".world-studio")?.classList.contains("is-content-hidden")).toBe(
      true,
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(studioLayoutStorageKey("world-baixada-santista")) ?? "{}",
      ),
    ).toMatchObject({ showContentDrawer: false });
  });

  it("salva manualmente e executa autosave após 30 segundos", () => {
    vi.useFakeTimers();
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));
    act(() => vi.advanceTimersByTime(1));

    const addRiver = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Rio"),
    );
    act(() => addRiver?.click());
    expect(container.querySelector(".world-save-state")?.textContent).toContain("não salvo");
    expect(window.localStorage.getItem("terrativa.admin.worlds.v2")).toBeNull();

    act(() => vi.advanceTimersByTime(30_000));
    const saved = JSON.parse(
      window.localStorage.getItem("terrativa.admin.worlds.v2") ?? "[]",
    ) as Array<{ waterBodies: unknown[] }>;
    expect(saved[0]?.waterBodies).toHaveLength(1);
    expect(container.querySelector(".world-save-state")?.textContent).toContain(
      "Salvamento automático",
    );

    act(() => addRiver?.click());
    const saveButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Salvar"),
    );
    act(() => saveButton?.click());
    expect(container.querySelector(".world-save-state")?.textContent).toContain("Mundo salvo");
  });

  it("seleciona vários objetos com Ctrl no Organizador", () => {
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));

    const meshes = [
      ...container.querySelectorAll<HTMLButtonElement>(".outliner-group button"),
    ].filter((button) => button.textContent?.includes("StaticMesh"));
    expect(meshes.length).toBeGreaterThan(1);
    act(() => meshes[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => meshes[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })));

    expect(container.textContent).toContain("2 selecionados");
    expect(container.textContent).toContain("Objetos selecionados");
    expect(container.querySelectorAll(".outliner-group button.is-selected")).toHaveLength(2);
  });

  it("cria pastas, subpastas, move atores e recolhe a árvore do Organizador", () => {
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));

    const newFolderButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "+ Pasta",
    );
    act(() => newFolderButton?.click());

    const folderInput = container.querySelector<HTMLInputElement>(".studio-dialog input");
    act(() => {
      if (!folderInput) return;
      changeInput(folderInput, "Gameplay");
    });
    const confirmFolder = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Criar pasta",
    );
    act(() => confirmFolder?.click());

    const gameplayRow = [
      ...container.querySelectorAll<HTMLButtonElement>(".outliner-folder-select"),
    ].find((button) => button.textContent?.includes("Gameplay"));
    expect(gameplayRow).toBeTruthy();
    act(() => gameplayRow?.click());

    const moveButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Mover aqui",
    );
    act(() => moveButton?.click());
    expect(container.querySelector(".outliner-custom-folders")?.textContent).toContain("Casa 0");

    const addSubfolder = container.querySelector<HTMLButtonElement>(
      '[aria-label="Criar subpasta em Gameplay"]',
    );
    act(() => addSubfolder?.click());
    const subfolderInput = container.querySelector<HTMLInputElement>(".studio-dialog input");
    act(() => {
      if (!subfolderInput) return;
      changeInput(subfolderInput, "Interações");
    });
    const confirmSubfolder = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Criar subpasta",
    );
    act(() => confirmSubfolder?.click());
    expect(container.querySelector(".outliner-custom-folders")?.textContent).toContain(
      "Interações",
    );

    const collapseFolder = container.querySelector<HTMLButtonElement>(
      '[aria-label="Recolher pasta Gameplay"]',
    );
    act(() => collapseFolder?.click());
    expect(container.querySelector(".outliner-custom-folders")?.textContent).not.toContain(
      "Interações",
    );
    expect(container.querySelector(".outliner-custom-folders")?.textContent).not.toContain(
      "Casa 0",
    );
  });

  it("desfaz e refaz alterações do mundo com os atalhos do Studio", () => {
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));

    const addRiver = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Rio"),
    );
    act(() => addRiver?.click());
    expect(container.querySelector(".outliner-tree")?.textContent).toContain("Trecho de rio");

    const search = container.querySelector<HTMLInputElement>(".outliner-search input");
    act(() =>
      search?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "z" }),
      ),
    );
    expect(container.querySelector(".outliner-tree")?.textContent).toContain("Trecho de rio");

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "z" }),
      ),
    );
    expect(container.querySelector(".outliner-tree")?.textContent).not.toContain("Trecho de rio");
    expect(container.querySelector(".world-save-state")?.textContent).toContain("Ação desfeita");

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "y" }),
      ),
    );
    expect(container.querySelector(".outliner-tree")?.textContent).toContain("Trecho de rio");
    expect(container.querySelector(".world-save-state")?.textContent).toContain("Ação refeita");
  });

  it("abre as ferramentas de Landscape, remove e cria o terreno novamente", () => {
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));

    const landscapeButton = [
      ...container.querySelectorAll<HTMLButtonElement>(".world-toolbar button"),
    ].find((button) => button.textContent?.trim() === "Landscape");
    act(() => landscapeButton?.click());

    expect(container.querySelector(".landscape-tools-panel")?.textContent).toContain("Elevar");
    expect(container.querySelector(".landscape-tools-panel")?.textContent).toContain("Suavizar");
    expect(container.querySelector(".world-inspector")?.textContent).toContain(
      "Gerenciar Landscape",
    );
    expect(container.querySelector(".world-inspector")?.textContent).toContain("Largura");
    expect(container.querySelector(".world-inspector")?.textContent).toContain("Profundidade");

    const remove = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Remover Landscape"),
    );
    act(() => remove?.click());
    expect(container.querySelector(".outliner-tree")?.textContent).not.toContain(
      "Landscape Baixada Santista",
    );

    const create = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Criar Landscape"),
    );
    act(() => create?.click());
    expect(container.querySelector(".outliner-tree")?.textContent).toContain("Landscape");
    expect(container.querySelector(".landscape-tools-panel")).toBeTruthy();
  });

  it("desfaz e refaz o Landscape sem sair do modo de escultura", () => {
    window.location.hash = "/studio/world-baixada-santista";
    act(() => root.render(<AdminApp />));

    const landscapeButton = [
      ...container.querySelectorAll<HTMLButtonElement>(".world-toolbar button"),
    ].find((button) => button.textContent?.trim() === "Landscape");
    act(() => landscapeButton?.click());

    const elevationField = [
      ...container.querySelectorAll<HTMLLabelElement>(".inspector-field"),
    ].find((label) => label.textContent?.includes("Elevação"));
    const elevationInput = elevationField?.querySelector<HTMLInputElement>("input");
    expect(elevationInput).toBeTruthy();
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(elevationInput, "5");
      elevationInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector(".world-save-state")?.textContent).toContain(
      "objetos readaptados",
    );

    act(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "z" }),
      ),
    );
    expect(container.querySelector(".landscape-tools-panel")).toBeTruthy();
    expect(container.querySelector(".world-inspector")?.textContent).toContain(
      "Gerenciar Landscape",
    );
    expect(container.querySelector(".world-save-state")?.textContent).toContain(
      "Edição do Landscape desfeita",
    );

    const redoLandscape = container.querySelector<HTMLButtonElement>(
      '[aria-label="Refazer edição do Landscape"]',
    );
    expect(redoLandscape?.disabled).toBe(false);
    act(() => redoLandscape?.click());
    expect(container.querySelector(".landscape-tools-panel")).toBeTruthy();
    expect(container.querySelector(".world-save-state")?.textContent).toContain(
      "Edição do Landscape refeita",
    );
  });
});

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
