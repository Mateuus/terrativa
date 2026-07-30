import type { StudioSelection, StudioTransformPatch } from "./WorldCanvas3D";
import { type StudioWorld, touchWorld } from "./worldModel";

export interface StudioSelectionTransform {
  readonly selection: StudioSelection;
  readonly patch: StudioTransformPatch;
}

export function applyStudioSelectionTransforms(
  world: StudioWorld,
  transforms: readonly StudioSelectionTransform[],
): StudioWorld {
  if (transforms.length === 0) return world;
  const patches = new Map(transforms.map((item) => [selectionKey(item.selection), item.patch]));
  return touchWorld(world, {
    scene: {
      ...world.scene,
      tiles: world.scene.tiles.map((tile) => {
        const patch = patches.get(`tile:${tile.position}`);
        return patch
          ? {
              ...tile,
              ...pickTransform(patch, ["x", "z", "rotationY", "scale"]),
            }
          : tile;
      }),
      props: world.scene.props.map((prop) => {
        const patch = patches.get(`prop:${prop.id}`);
        return patch
          ? {
              ...prop,
              ...pickTransform(patch, ["x", "y", "z", "rotationY", "scale"]),
            }
          : prop;
      }),
    },
    waterBodies: world.waterBodies.map((water) => {
      const patch = patches.get(`water:${water.id}`);
      return patch
        ? {
            ...water,
            ...pickTransform(patch, ["x", "y", "z", "rotationY", "width", "length"]),
          }
        : water;
    }),
    vehicles: world.vehicles.map((vehicle) => {
      const patch = patches.get(`vehicle:${vehicle.id}`);
      return patch
        ? {
            ...vehicle,
            ...pickTransform(patch, ["x", "y", "z", "rotationY", "scale"]),
          }
        : vehicle;
    }),
    objects: world.objects.map((object) => {
      const patch = patches.get(`object:${object.id}`);
      return patch
        ? {
            ...object,
            ...pickTransform(patch, ["x", "y", "z", "rotationY", "scale"]),
          }
        : object;
    }),
  });
}

function pickTransform<K extends keyof StudioTransformPatch>(
  patch: StudioTransformPatch,
  keys: readonly K[],
): Pick<StudioTransformPatch, K> {
  const result = {} as Pick<StudioTransformPatch, K>;
  for (const key of keys) {
    const value = patch[key];
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
}

function selectionKey(selection: StudioSelection): string {
  return selection.kind === "tile"
    ? `tile:${selection.position}`
    : `${selection.kind}:${selection.id}`;
}
