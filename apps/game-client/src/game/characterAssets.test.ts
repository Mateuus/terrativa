import { describe, expect, it } from "vitest";
import { characterAssetLocation, characterDisplayName } from "./characterAssets";

describe("character asset catalog", () => {
  it("maps the selected Quaternius pawn to its versioned glTF", () => {
    expect(characterAssetLocation("quaternius-men-07")).toEqual({
      file: "punk.gltf",
      root: "/assets/vendor/quaternius/ultimate-modular-men/2022-02/",
      url: "/assets/vendor/quaternius/ultimate-modular-men/2022-02/punk.gltf",
    });
  });

  it("keeps an explicit fallback for packs not installed yet", () => {
    expect(characterAssetLocation("quaternius-women-01")).toBeNull();
  });

  it("shows friendly names in the lobby instead of technical pawn keys", () => {
    expect(characterDisplayName("quaternius-men-07")).toBe("Punk");
    expect(characterDisplayName("quaternius-women-09")).toBe("Mística");
  });
});
