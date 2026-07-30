import { baixadaSantistaModule } from "./baixadaSantistaModule.js";
import { createModuleRegistry } from "./module.js";

export const officialModules = Object.freeze([baixadaSantistaModule]);

export const terrativaModuleRegistry = createModuleRegistry(
  officialModules,
  officialModules.map((module) => module.slug),
);
