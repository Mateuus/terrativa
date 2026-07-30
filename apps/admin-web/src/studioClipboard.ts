import { type BoardSceneProp, getSceneAsset } from "@terrativa/board-content";
import type { StudioSelection } from "./WorldCanvas3D";
import {
  type StudioWorld,
  touchWorld,
  type WorldPlacedObject,
  type WorldVehicle,
  type WorldWaterBody,
} from "./worldModel";

export type StudioClipboardItem =
  | { readonly kind: "prop"; readonly label: string; readonly value: BoardSceneProp }
  | { readonly kind: "water"; readonly label: string; readonly value: WorldWaterBody }
  | { readonly kind: "vehicle"; readonly label: string; readonly value: WorldVehicle }
  | { readonly kind: "object"; readonly label: string; readonly value: WorldPlacedObject };

export interface PastedStudioItem {
  readonly world: StudioWorld;
  readonly selection: StudioSelection;
  readonly label: string;
}

export function copyStudioSelection(
  world: StudioWorld,
  selection: StudioSelection,
): StudioClipboardItem | null {
  if (selection.kind === "prop") {
    const value = world.scene.props.find((prop) => prop.id === selection.id);
    if (!value) return null;
    return {
      kind: "prop",
      label: getSceneAsset(value.assetId).label,
      value: structuredClone(value),
    };
  }
  if (selection.kind === "water") {
    const value = world.waterBodies.find((water) => water.id === selection.id);
    return value ? { kind: "water", label: value.name, value: structuredClone(value) } : null;
  }
  if (selection.kind === "vehicle") {
    const value = world.vehicles.find((vehicle) => vehicle.id === selection.id);
    return value ? { kind: "vehicle", label: value.name, value: structuredClone(value) } : null;
  }
  if (selection.kind === "object") {
    const value = world.objects.find((object) => object.id === selection.id);
    return value ? { kind: "object", label: value.name, value: structuredClone(value) } : null;
  }
  return null;
}

export function pasteStudioClipboard(
  world: StudioWorld,
  item: StudioClipboardItem,
  suffix: string,
  offset: number,
): PastedStudioItem {
  const id = `${item.value.id}-copia-${suffix}`;
  if (item.kind === "prop") {
    const value = {
      ...structuredClone(item.value),
      id,
      x: item.value.x + offset,
      z: item.value.z + offset,
    };
    return {
      world: touchWorld(world, {
        scene: { ...world.scene, props: [...world.scene.props, value] },
      }),
      selection: { kind: "prop", id },
      label: item.label,
    };
  }
  if (item.kind === "water") {
    const value = {
      ...structuredClone(item.value),
      id,
      name: `${item.value.name} cópia`,
      x: item.value.x + offset,
      z: item.value.z + offset,
    };
    return {
      world: touchWorld(world, { waterBodies: [...world.waterBodies, value] }),
      selection: { kind: "water", id },
      label: item.label,
    };
  }
  if (item.kind === "vehicle") {
    const value = {
      ...structuredClone(item.value),
      id,
      name: `${item.value.name} cópia`,
      x: item.value.x + offset,
      z: item.value.z + offset,
    };
    return {
      world: touchWorld(world, { vehicles: [...world.vehicles, value] }),
      selection: { kind: "vehicle", id },
      label: item.label,
    };
  }
  const value = {
    ...structuredClone(item.value),
    id,
    name: `${item.value.name} cópia`,
    x: item.value.x + offset,
    z: item.value.z + offset,
  };
  return {
    world: touchWorld(world, { objects: [...world.objects, value] }),
    selection: { kind: "object", id },
    label: item.label,
  };
}
