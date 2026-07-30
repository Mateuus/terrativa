// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioConfirmDialog, StudioTextDialog } from "./StudioDialog";

describe("StudioDialog", () => {
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

  it("confirma um nome sem usar diálogo nativo do navegador", () => {
    const onConfirm = vi.fn();
    act(() =>
      root.render(
        <StudioTextDialog
          initialValue="novo-script.js"
          inputLabel="Nome"
          onCancel={() => undefined}
          onConfirm={onConfirm}
          title="Novo script"
        />,
      ),
    );

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    act(() =>
      container
        .querySelector("form")
        ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
    );
    expect(onConfirm).toHaveBeenCalledWith("novo-script.js");
  });

  it("fecha a confirmação com Escape", () => {
    const onCancel = vi.fn();
    act(() =>
      root.render(
        <StudioConfirmDialog
          description="Confirme a exclusão."
          onCancel={onCancel}
          onConfirm={() => undefined}
          title="Excluir?"
        />,
      ),
    );

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
