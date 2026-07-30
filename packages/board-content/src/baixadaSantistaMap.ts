import { validateTerritoryMap } from "./geography.js";

export const baixadaSantistaMap = Object.freeze(
  validateTerritoryMap({
    boardSlug: "baixada-santista",
    center: [-46.55, -24.05],
    zoom: 9.25,
    pitch: 48,
    bearing: -17,
    bounds: [
      [-47.13, -24.45],
      [-45.95, -23.7],
    ],
    cities: [
      { key: "bertioga", name: "Bertioga", coordinates: [-46.1396, -23.8544] },
      { key: "guaruja", name: "Guarujá", coordinates: [-46.2564, -23.9931] },
      { key: "santos", name: "Santos", coordinates: [-46.3336, -23.9608] },
      { key: "cubatao", name: "Cubatão", coordinates: [-46.4256, -23.8953] },
      { key: "sao-vicente", name: "São Vicente", coordinates: [-46.3919, -23.9631] },
      { key: "praia-grande", name: "Praia Grande", coordinates: [-46.4126, -24.0058] },
      { key: "mongagua", name: "Mongaguá", coordinates: [-46.6201, -24.0934] },
      { key: "itanhaem", name: "Itanhaém", coordinates: [-46.7889, -24.1839] },
      { key: "peruibe", name: "Peruíbe", coordinates: [-46.9984, -24.3208] },
    ],
    route: [
      [-46.1396, -23.8544],
      [-46.184, -23.91],
      [-46.2564, -23.9931],
      [-46.3336, -23.9608],
      [-46.4256, -23.8953],
      [-46.3919, -23.9631],
      [-46.4126, -24.0058],
      [-46.505, -24.045],
      [-46.6201, -24.0934],
      [-46.705, -24.14],
      [-46.7889, -24.1839],
      [-46.9, -24.25],
      [-46.9984, -24.3208],
    ],
  }),
);
