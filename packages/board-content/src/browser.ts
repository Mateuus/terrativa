export { baixadaSantistaContent } from "./baixadaSantista.js";
export { baixadaSantistaMap } from "./baixadaSantistaMap.js";
export { baixadaSantistaModule } from "./baixadaSantistaModule.js";
export type {
  BalanceSimulationOptions,
  BalanceSimulationReport,
} from "./balance.js";
export { simulateBoardBalance } from "./balance.js";
export type { CharacterAssetPack, CharacterPawn } from "./characters.js";
export {
  characterAssetPacks,
  characterPawnCatalog,
  isCharacterPawnKey,
} from "./characters.js";
export { toEngineBoard } from "./engineAdapter.js";
export type { BoardSummary } from "./foundation.js";
export {
  boardSummarySchema,
  foundationBoard,
} from "./foundation.js";
export type { TerritoryMapCity, TerritoryMapDefinition } from "./geography.js";
export {
  territoryMapCitySchema,
  territoryMapSchema,
  validateTerritoryMap,
} from "./geography.js";
export type {
  TerrativaModule,
  TerrativaModuleRegistry,
  TerrativaModuleSummary,
} from "./module.js";
export {
  createModuleRegistry,
  moduleAuthorSchema,
  moduleLicenseSchema,
  moduleTerritorySchema,
  terrativaModuleSchema,
  validateTerrativaModule,
} from "./module.js";
export {
  officialModules,
  terrativaModuleRegistry,
} from "./registry.js";
export type {
  BoardSceneDefinition,
  BoardSceneProp,
  BoardSceneTile,
  SceneAssetDefinition,
  SceneAssetId,
} from "./scene.js";
export {
  baixadaSantistaScene,
  boardScenePropSchema,
  boardSceneSchema,
  boardSceneTileSchema,
  createDefaultBoardScene,
  getBoardScene,
  getSceneAsset,
  sceneAssetCatalog,
  sceneAssetIdSchema,
  validateBoardScene,
} from "./scene.js";
export type {
  BoardContent,
  BoardContentCard,
  BoardContentTile,
} from "./schema.js";
export {
  boardContentSchema,
  cardDeckTypeSchema,
  cardEffectSchema,
  cardSchema,
  citySchema,
  propertyContentSchema,
  propertyGroupSchema,
  tileSchema,
  tileTypeSchema,
} from "./schema.js";
