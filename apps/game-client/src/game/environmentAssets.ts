export interface EnvironmentAssetPlacement {
  readonly id: string;
  readonly file: string;
  readonly position: readonly [x: number, y: number, z: number];
  readonly rotationY: number;
  readonly scale: number;
}

export const coastalAssetRoot = "/assets/vendor/kenney/pirate-kit/2.1/";

export const coastalAssetPlacements: readonly EnvironmentAssetPlacement[] = [
  {
    id: "sand-west",
    file: "patch-sand.glb",
    position: [-8.35, -0.19, -4.75],
    rotationY: 0.38,
    scale: 2.6,
  },
  {
    id: "sand-east",
    file: "patch-sand.glb",
    position: [8.4, -0.19, 4.85],
    rotationY: -0.42,
    scale: 2.35,
  },
  {
    id: "palm-west",
    file: "palm-detailed-bend.glb",
    position: [-8.25, -0.14, -4.7],
    rotationY: 0.76,
    scale: 1.55,
  },
  {
    id: "palm-east",
    file: "palm-detailed-straight.glb",
    position: [8.35, -0.14, 4.72],
    rotationY: -0.64,
    scale: 1.45,
  },
  {
    id: "rocks-north",
    file: "rocks-sand-a.glb",
    position: [-3.2, -0.17, 8.35],
    rotationY: 0.28,
    scale: 1.65,
  },
  {
    id: "rocks-west",
    file: "rocks-sand-b.glb",
    position: [-8.65, -0.17, 2.7],
    rotationY: -0.35,
    scale: 1.5,
  },
  {
    id: "rocks-east",
    file: "rocks-sand-c.glb",
    position: [8.75, -0.17, -3.3],
    rotationY: 0.7,
    scale: 1.65,
  },
  {
    id: "dock-south",
    file: "structure-platform-dock-small.glb",
    position: [8.45, -0.3, -7.15],
    rotationY: -1.05,
    scale: 1.55,
  },
  {
    id: "boat-south",
    file: "boat-row-small.glb",
    position: [10.4, -0.42, -8.05],
    rotationY: -0.25,
    scale: 1.7,
  },
];

export const diceAsset = {
  root: "/assets/vendor/opengameart/dice-robinj24/2014-09-11/",
  file: "dice.glb",
} as const;
