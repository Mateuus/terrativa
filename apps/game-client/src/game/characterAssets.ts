const quaterniusMenRoot = "/assets/vendor/quaternius/ultimate-modular-men/2022-02/";

const quaterniusMenFiles: Readonly<Record<string, string>> = {
  "quaternius-men-01": "adventurer.gltf",
  "quaternius-men-02": "beach.gltf",
  "quaternius-men-03": "casual-2.gltf",
  "quaternius-men-04": "casual-hoodie.gltf",
  "quaternius-men-05": "farmer.gltf",
  "quaternius-men-06": "king.gltf",
  "quaternius-men-07": "punk.gltf",
  "quaternius-men-08": "spacesuit.gltf",
  "quaternius-men-09": "suit.gltf",
  "quaternius-men-10": "swat.gltf",
  "quaternius-men-11": "worker.gltf",
};

const characterNames: Readonly<Record<string, string>> = {
  "quaternius-men-01": "Aventureiro",
  "quaternius-men-02": "Praiano",
  "quaternius-men-03": "Casual",
  "quaternius-men-04": "Moletom",
  "quaternius-men-05": "Agricultor",
  "quaternius-men-06": "Governante",
  "quaternius-men-07": "Punk",
  "quaternius-men-08": "Explorador espacial",
  "quaternius-men-09": "Executivo",
  "quaternius-men-10": "Agente tático",
  "quaternius-men-11": "Trabalhador",
  "quaternius-women-01": "Aventureira",
  "quaternius-women-02": "Casual",
  "quaternius-women-03": "Executiva",
  "quaternius-women-04": "Medieval",
  "quaternius-women-05": "Punk",
  "quaternius-women-06": "Exploradora espacial",
  "quaternius-women-07": "Agente tática",
  "quaternius-women-08": "Social",
  "quaternius-women-09": "Mística",
  "quaternius-women-10": "Trabalhadora",
};

export interface CharacterAssetLocation {
  readonly file: string;
  readonly root: string;
  readonly url: string;
}

export function characterAssetLocation(pawnKey: string): CharacterAssetLocation | null {
  const file = quaterniusMenFiles[pawnKey];
  return file ? { file, root: quaterniusMenRoot, url: `${quaterniusMenRoot}${file}` } : null;
}

export function characterDisplayName(pawnKey: string): string {
  return characterNames[pawnKey] ?? "Explorador";
}

export function preloadCharacterAsset(pawnKey: string): void {
  const asset = characterAssetLocation(pawnKey);
  if (!asset) return;
  void fetch(asset.url, { cache: "force-cache", priority: "low" }).catch(() => {
    // The renderer keeps a procedural fallback if preloading is unavailable.
  });
}
