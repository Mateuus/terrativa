// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { applyStudioSelectionTransforms } from "./studioTransforms";
import { createInitialWorld } from "./worldModel";

describe("transformação coletiva do World Studio", () => {
  it("move vários objetos em uma única atualização preservando cada transformação", () => {
    const world = createInitialWorld();
    const first = world.scene.props[0];
    const second = world.scene.props[1];
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;

    const transformed = applyStudioSelectionTransforms(world, [
      {
        selection: { kind: "prop", id: first.id },
        patch: { x: 4, y: 1.2, z: -3, rotationY: 0.5, scale: 1.4 },
      },
      {
        selection: { kind: "prop", id: second.id },
        patch: { x: 7, y: 0.8, z: 2, rotationY: 0.5, scale: 0.9 },
      },
    ]);

    expect(transformed.scene.props.find((prop) => prop.id === first.id)).toMatchObject({
      x: 4,
      y: 1.2,
      z: -3,
      rotationY: 0.5,
      scale: 1.4,
    });
    expect(transformed.scene.props.find((prop) => prop.id === second.id)).toMatchObject({
      x: 7,
      y: 0.8,
      z: 2,
      rotationY: 0.5,
      scale: 0.9,
    });
    expect(transformed).not.toBe(world);
  });

  it("aplica escala coletiva de água nas dimensões corretas", () => {
    const world = createInitialWorld();
    const withWater = {
      ...world,
      waterBodies: [
        {
          id: "lago-1",
          name: "Lago",
          kind: "lake" as const,
          x: 0,
          y: 0.5,
          z: 0,
          width: 5,
          length: 6,
          rotationY: 0,
          color: "#208FA3",
        },
      ],
    };

    const transformed = applyStudioSelectionTransforms(withWater, [
      {
        selection: { kind: "water", id: "lago-1" },
        patch: { x: 3, y: 0.7, z: 4, width: 8, length: 12, rotationY: 1 },
      },
    ]);

    expect(transformed.waterBodies[0]).toMatchObject({
      x: 3,
      y: 0.7,
      z: 4,
      width: 8,
      length: 12,
      rotationY: 1,
    });
  });
});
