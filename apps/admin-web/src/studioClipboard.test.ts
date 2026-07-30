// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { copyStudioSelection, pasteStudioClipboard } from "./studioClipboard";
import { createInitialWorld } from "./worldModel";

describe("área de transferência do Studio", () => {
  it("copia um objeto e cola uma nova instância deslocada", () => {
    const world = createInitialWorld();
    const source = world.scene.props[0];
    expect(source).toBeTruthy();
    if (!source) return;

    const clipboard = copyStudioSelection(world, { kind: "prop", id: source.id });
    expect(clipboard?.kind).toBe("prop");
    if (!clipboard) return;

    const pasted = pasteStudioClipboard(world, clipboard, "teste-1", 0.8);
    expect(pasted.world.scene.props).toHaveLength(world.scene.props.length + 1);
    expect(pasted.selection).toEqual({ kind: "prop", id: `${source.id}-copia-teste-1` });
    expect(pasted.world.scene.props.at(-1)).toMatchObject({
      id: `${source.id}-copia-teste-1`,
      x: source.x + 0.8,
      z: source.z + 0.8,
    });
  });

  it("não copia casas nem rotas protegidas", () => {
    const world = createInitialWorld();
    expect(copyStudioSelection(world, { kind: "tile", position: 0 })).toBeNull();
    expect(copyStudioSelection(world, { kind: "route", id: world.routes[0]?.id ?? "" })).toBeNull();
  });
});
