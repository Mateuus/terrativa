import { describe, expect, it } from "vitest";
import {
  adaptObjectsToLandscape,
  clearLandscapeSculpting,
  getWorldLandscapeHeight,
  resizeLandscape,
  sculptLandscape,
} from "./studioLandscape";
import { createDefaultLandscape, createInitialWorld, type StudioWorld } from "./worldModel";

describe("ferramentas de Landscape", () => {
  it("eleva e abaixa o terreno dentro do raio do pincel", () => {
    const landscape = createDefaultLandscape(32);
    const raised = sculptLandscape(landscape, {
      tool: "raise",
      x: 0,
      z: 0,
      radius: 4,
      strength: 1,
    });
    expect(Math.max(...raised.heightData)).toBeCloseTo(1);
    expect(raised.heightData[0]).toBe(0);

    const lowered = sculptLandscape(raised, {
      tool: "lower",
      x: 0,
      z: 0,
      radius: 4,
      strength: 0.5,
    });
    expect(Math.max(...lowered.heightData)).toBeCloseTo(0.5);
  });

  it("redimensiona a grade preservando a escultura e pode restaurá-la", () => {
    const sculpted = sculptLandscape(createDefaultLandscape(32), {
      tool: "raise",
      x: 0,
      z: 0,
      radius: 5,
      strength: 2,
    });
    const resized = resizeLandscape(sculpted, { width: 48, depth: 24, resolution: 48 });
    expect(resized.heightData).toHaveLength(49 ** 2);
    expect(Math.max(...resized.heightData)).toBeGreaterThan(1.5);
    expect(clearLandscapeSculpting(resized).heightData.every((height) => height === 0)).toBe(true);
  });

  it("suaviza picos sem alterar a quantidade de vértices", () => {
    const landscape = createDefaultLandscape(32);
    const raised = sculptLandscape(landscape, {
      tool: "raise",
      x: 0,
      z: 0,
      radius: 1,
      strength: 3,
    });
    const smoothed = sculptLandscape(raised, {
      tool: "smooth",
      x: 0,
      z: 0,
      radius: 3,
      strength: 1,
    });
    expect(smoothed.heightData).toHaveLength(raised.heightData.length);
    expect(Math.max(...smoothed.heightData)).toBeLessThan(Math.max(...raised.heightData));
  });

  it("readapta construções, veículos e malhas mantendo a altura relativa", () => {
    const base = createInitialWorld();
    const previous: StudioWorld = {
      ...base,
      scene: {
        ...base.scene,
        props: base.scene.props.map((prop, index) =>
          index === 0 ? { ...prop, x: 2, y: 1.4, z: 3 } : prop,
        ),
      },
      vehicles: [
        {
          id: "vehicle-test",
          assetId: "taxi",
          name: "Táxi",
          x: 2,
          y: 1.8,
          z: 3,
          rotationY: 0,
          scale: 1,
        },
      ],
      objects: [
        {
          id: "object-test",
          name: "Casa",
          assetId: "asset-house-small",
          objectType: "static-mesh",
          mobility: "static",
          x: 2,
          y: 2.2,
          z: 3,
          rotationY: 0,
          scale: 1,
        },
      ],
    };
    const next: StudioWorld = {
      ...previous,
      terrain: { ...previous.terrain, waterLevel: previous.terrain.waterLevel + 2 },
    };
    const adapted = adaptObjectsToLandscape(previous, next);

    expect(adapted.scene.props[0]?.y).toBeCloseTo(3.4);
    expect(adapted.vehicles[0]?.y).toBeCloseTo(3.8);
    expect(adapted.objects[0]?.y).toBeCloseTo(4.2);
  });

  it("acompanha a escultura somente nos objetos dentro da pincelada", () => {
    const base = createInitialWorld();
    const previous: StudioWorld = {
      ...base,
      objects: [
        {
          id: "center",
          name: "Objeto central",
          assetId: "asset-house-small",
          objectType: "static-mesh",
          mobility: "static",
          x: 0,
          y: 1,
          z: 0,
          rotationY: 0,
          scale: 1,
        },
        {
          id: "outside",
          name: "Objeto distante",
          assetId: "asset-house-small",
          objectType: "static-mesh",
          mobility: "static",
          x: 12,
          y: 1,
          z: 12,
          rotationY: 0,
          scale: 1,
        },
      ],
    };
    if (!previous.landscape) throw new Error("Landscape inicial ausente");
    const next: StudioWorld = {
      ...previous,
      landscape: sculptLandscape(previous.landscape, {
        tool: "raise",
        x: 0,
        z: 0,
        radius: 3,
        strength: 1,
      }),
    };
    const adapted = adaptObjectsToLandscape(previous, next);

    expect(adapted.objects[0]?.y).toBeCloseTo(2);
    expect(adapted.objects[1]?.y).toBe(1);
    expect(getWorldLandscapeHeight(next, 0, 0)).toBeCloseTo(
      (getWorldLandscapeHeight(previous, 0, 0) ?? 0) + 1,
    );
  });

  it("recalcula a base dos objetos ao mudar tamanho e elevação", () => {
    const base = createInitialWorld();
    const previous: StudioWorld = {
      ...base,
      objects: [
        {
          id: "slope-object",
          name: "Objeto na encosta",
          assetId: "asset-house-small",
          objectType: "static-mesh",
          mobility: "static",
          x: 6,
          y: 2,
          z: 4,
          rotationY: 0,
          scale: 1,
        },
      ],
    };
    if (!previous.landscape) throw new Error("Landscape inicial ausente");
    const next: StudioWorld = {
      ...previous,
      terrain: {
        ...previous.terrain,
        size: 72,
        elevation: previous.terrain.elevation + 3,
      },
      landscape: resizeLandscape(previous.landscape, { width: 72, depth: 72 }),
    };
    const previousGround = getWorldLandscapeHeight(previous, 6, 4) ?? 0;
    const nextGround = getWorldLandscapeHeight(next, 6, 4) ?? 0;
    const adapted = adaptObjectsToLandscape(previous, next);

    expect(nextGround).not.toBeCloseTo(previousGround);
    expect(adapted.objects[0]?.y).toBeCloseTo(2 + nextGround - previousGround, 3);
  });
});
