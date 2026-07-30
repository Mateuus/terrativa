import { baixadaSantistaContent } from "./baixadaSantista.js";
import { baixadaSantistaMap } from "./baixadaSantistaMap.js";
import { type TerrativaModule, validateTerrativaModule } from "./module.js";

export const baixadaSantistaModule: TerrativaModule = Object.freeze(
  validateTerrativaModule({
    moduleApiVersion: 1,
    slug: "baixada-santista",
    name: "Terrativa: Baixada Santista",
    summary:
      "Módulo regional oficial que percorre nove cidades da Baixada Santista em uma rota estratégica e educativa.",
    version: "1.0.0",
    engineCompatibility: "^0.1.0",
    locale: "pt-BR",
    territory: {
      countryCode: "BR",
      subdivisionCodes: ["BR-SP"],
      regionName: "Baixada Santista",
    },
    authors: [{ name: "Comunidade Terrativa" }],
    license: {
      code: "MIT",
      content: "CC-BY-4.0",
      assets: "CC0-1.0",
    },
    attribution:
      "Conteúdo original Terrativa inspirado em fontes geográficas e institucionais públicas, com economia inteiramente fictícia.",
    boards: [baixadaSantistaContent],
    mapViews: [baixadaSantistaMap],
  }),
);
