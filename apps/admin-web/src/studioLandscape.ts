import type { StudioWorld, TerrainSettings, WorldLandscape } from "./worldModel";

export type LandscapeSculptTool = "flatten" | "lower" | "raise" | "smooth";

export interface LandscapeBrushStroke {
  readonly tool: LandscapeSculptTool;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
}

export function resizeLandscape(
  landscape: WorldLandscape,
  patch: Partial<Pick<WorldLandscape, "depth" | "resolution" | "width">>,
): WorldLandscape {
  const width = clamp(patch.width ?? landscape.width, 4, 2_048);
  const depth = clamp(patch.depth ?? landscape.depth, 4, 2_048);
  const resolution = Math.round(clamp(patch.resolution ?? landscape.resolution, 8, 64));
  if (
    width === landscape.width &&
    depth === landscape.depth &&
    resolution === landscape.resolution
  ) {
    return landscape;
  }

  const heightData = new Array<number>((resolution + 1) ** 2);
  for (let row = 0; row <= resolution; row += 1) {
    for (let column = 0; column <= resolution; column += 1) {
      heightData[landscapeIndex(resolution, column, row)] = sampleNormalizedHeight(
        landscape,
        column / resolution,
        row / resolution,
      );
    }
  }
  return { ...landscape, width, depth, resolution, heightData };
}

export function sculptLandscape(
  landscape: WorldLandscape,
  stroke: LandscapeBrushStroke,
): WorldLandscape {
  const radius = clamp(stroke.radius, 0.25, 64);
  const strength = clamp(stroke.strength, 0.01, 4);
  const heightData = [...landscape.heightData];
  const centerColumn = Math.round(
    ((stroke.x + landscape.width / 2) / landscape.width) * landscape.resolution,
  );
  const centerRow = Math.round(
    ((stroke.z + landscape.depth / 2) / landscape.depth) * landscape.resolution,
  );
  const flattenTarget =
    landscape.heightData[
      landscapeIndex(
        landscape.resolution,
        clampIndex(centerColumn, landscape.resolution),
        clampIndex(centerRow, landscape.resolution),
      )
    ] ?? 0;

  for (let row = 0; row <= landscape.resolution; row += 1) {
    const z = -landscape.depth / 2 + (row / landscape.resolution) * landscape.depth;
    for (let column = 0; column <= landscape.resolution; column += 1) {
      const x = -landscape.width / 2 + (column / landscape.resolution) * landscape.width;
      const distance = Math.hypot(x - stroke.x, z - stroke.z);
      if (distance > radius) continue;
      const influence = smoothFalloff(1 - distance / radius);
      const index = landscapeIndex(landscape.resolution, column, row);
      const current = landscape.heightData[index] ?? 0;
      let next = current;
      if (stroke.tool === "raise") next += strength * influence;
      if (stroke.tool === "lower") next -= strength * influence;
      if (stroke.tool === "smooth") {
        next = mix(current, neighborAverage(landscape, column, row), influence * strength * 0.5);
      }
      if (stroke.tool === "flatten") {
        next = mix(current, flattenTarget, influence * strength * 0.5);
      }
      heightData[index] = clamp(next, -20, 20);
    }
  }

  return { ...landscape, heightData };
}

export function clearLandscapeSculpting(landscape: WorldLandscape): WorldLandscape {
  return {
    ...landscape,
    heightData: new Array((landscape.resolution + 1) ** 2).fill(0),
  };
}

export function getLandscapeSurfaceHeight(
  terrain: TerrainSettings,
  landscape: WorldLandscape,
  x: number,
  z: number,
): number {
  const u = clamp((x + landscape.width / 2) / landscape.width, 0, 1);
  const v = clamp((z + landscape.depth / 2) / landscape.depth, 0, 1);
  return getProceduralTerrainHeight(terrain, x, z) + sampleNormalizedHeight(landscape, u, v);
}

export function getWorldLandscapeHeight(world: StudioWorld, x: number, z: number): number | null {
  if (!world.landscape) return null;
  return getLandscapeSurfaceHeight(world.terrain, world.landscape, x, z);
}

export function adaptObjectsToLandscape(
  previousWorld: StudioWorld,
  nextWorld: StudioWorld,
): StudioWorld {
  const adaptY = (x: number, y: number, z: number): number => {
    const previousHeight = getWorldLandscapeHeight(previousWorld, x, z);
    const nextHeight = getWorldLandscapeHeight(nextWorld, x, z);
    if (previousHeight === null || nextHeight === null) return y;
    return round(y + nextHeight - previousHeight);
  };
  return {
    ...nextWorld,
    scene: {
      ...nextWorld.scene,
      props: nextWorld.scene.props.map((prop) => ({
        ...prop,
        y: adaptY(prop.x, prop.y, prop.z),
      })),
    },
    vehicles: nextWorld.vehicles.map((vehicle) => ({
      ...vehicle,
      y: adaptY(vehicle.x, vehicle.y, vehicle.z),
    })),
    objects: nextWorld.objects.map((object) => ({
      ...object,
      y: adaptY(object.x, object.y, object.z),
    })),
  };
}

export function getProceduralTerrainHeight(terrain: TerrainSettings, x: number, z: number): number {
  const radius = Math.hypot(x, z) / (terrain.size * 0.5);
  const islandMask =
    terrain.shape === "island" ? smoothstep(1, 0.55, radius) : smoothstep(1, 0.88, radius);
  const seed = terrain.seed * 0.001;
  const broad =
    Math.sin(x * 0.23 + seed * 7.1) * 0.46 +
    Math.cos(z * 0.19 - seed * 3.7) * 0.32 +
    Math.sin((x + z) * 0.41 + seed) * 0.15;
  const detail = Math.sin(x * 0.83 - z * 0.67 + seed * 11) * 0.1;
  const relief = (broad + detail) * terrain.elevation * terrain.roughness;
  const plateau = Math.max(0, 1 - Math.hypot(x / 11, z / 11));
  return terrain.waterLevel - 0.35 + islandMask * (1.05 + relief) + plateau * 0.22;
}

function sampleNormalizedHeight(landscape: WorldLandscape, u: number, v: number): number {
  const x = u * landscape.resolution;
  const y = v * landscape.resolution;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(landscape.resolution, x0 + 1);
  const y1 = Math.min(landscape.resolution, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = mix(
    landscape.heightData[landscapeIndex(landscape.resolution, x0, y0)] ?? 0,
    landscape.heightData[landscapeIndex(landscape.resolution, x1, y0)] ?? 0,
    tx,
  );
  const bottom = mix(
    landscape.heightData[landscapeIndex(landscape.resolution, x0, y1)] ?? 0,
    landscape.heightData[landscapeIndex(landscape.resolution, x1, y1)] ?? 0,
    tx,
  );
  return mix(top, bottom, ty);
}

function neighborAverage(landscape: WorldLandscape, column: number, row: number): number {
  let total = 0;
  let count = 0;
  for (let offsetRow = -1; offsetRow <= 1; offsetRow += 1) {
    for (let offsetColumn = -1; offsetColumn <= 1; offsetColumn += 1) {
      const nextColumn = column + offsetColumn;
      const nextRow = row + offsetRow;
      if (
        nextColumn < 0 ||
        nextRow < 0 ||
        nextColumn > landscape.resolution ||
        nextRow > landscape.resolution
      ) {
        continue;
      }
      total += landscape.heightData[landscapeIndex(landscape.resolution, nextColumn, nextRow)] ?? 0;
      count += 1;
    }
  }
  return count === 0 ? 0 : total / count;
}

function landscapeIndex(resolution: number, column: number, row: number): number {
  return row * (resolution + 1) + column;
}

function clampIndex(value: number, resolution: number): number {
  return Math.min(resolution, Math.max(0, value));
}

function smoothFalloff(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * clamp(amount, 0, 1);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
