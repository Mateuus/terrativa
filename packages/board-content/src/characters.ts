export interface CharacterAssetPack {
  readonly key: string;
  readonly name: string;
  readonly creator: "Quaternius";
  readonly sourceUrl: string;
  readonly license: "CC0-1.0";
  readonly formats: readonly ["glTF", "FBX", "OBJ", "Blend"];
  readonly modelCount: number;
  readonly animationCount: number;
  readonly modularParts: 4;
  readonly integrationPhase: 8;
}

export interface CharacterPawn {
  readonly key: string;
  readonly label: string;
  readonly packKey: string;
  readonly variant: number;
}

export const characterAssetPacks = Object.freeze([
  {
    key: "quaternius-ultimate-modular-men",
    name: "Ultimate Modular Men Pack",
    creator: "Quaternius",
    sourceUrl: "https://quaternius.com/packs/ultimatemodularcharacters.html",
    license: "CC0-1.0",
    formats: ["glTF", "FBX", "OBJ", "Blend"],
    modelCount: 11,
    animationCount: 24,
    modularParts: 4,
    integrationPhase: 8,
  },
  {
    key: "quaternius-ultimate-modular-women",
    name: "Ultimate Modular Women Pack",
    creator: "Quaternius",
    sourceUrl: "https://quaternius.com/packs/ultimatemodularwomen.html",
    license: "CC0-1.0",
    formats: ["glTF", "FBX", "OBJ", "Blend"],
    modelCount: 10,
    animationCount: 24,
    modularParts: 4,
    integrationPhase: 8,
  },
] as const satisfies readonly CharacterAssetPack[]);

export const characterPawnCatalog = Object.freeze([
  ...Array.from({ length: 11 }, (_, index) => ({
    key: `quaternius-men-${String(index + 1).padStart(2, "0")}`,
    label: `Personagem masculino ${index + 1}`,
    packKey: "quaternius-ultimate-modular-men",
    variant: index + 1,
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    key: `quaternius-women-${String(index + 1).padStart(2, "0")}`,
    label: `Personagem feminino ${index + 1}`,
    packKey: "quaternius-ultimate-modular-women",
    variant: index + 1,
  })),
] satisfies readonly CharacterPawn[]);

const pawnKeys = new Set(characterPawnCatalog.map((pawn) => pawn.key));

export function isCharacterPawnKey(value: string): boolean {
  return pawnKeys.has(value);
}
