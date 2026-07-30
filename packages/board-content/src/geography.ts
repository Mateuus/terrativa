import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const coordinateSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const territoryMapCitySchema = z
  .object({
    key: slugSchema,
    name: z.string().min(2).max(80),
    coordinates: coordinateSchema,
  })
  .strict();

export const territoryMapSchema = z
  .object({
    boardSlug: slugSchema,
    center: coordinateSchema,
    zoom: z.number().min(0).max(24),
    pitch: z.number().min(0).max(85),
    bearing: z.number().min(-180).max(180),
    bounds: z.tuple([coordinateSchema, coordinateSchema]),
    cities: z.array(territoryMapCitySchema).min(1).max(200),
    route: z.array(coordinateSchema).min(2).max(10_000),
  })
  .strict()
  .superRefine((map, context) => {
    const [southwest, northeast] = map.bounds;
    if (southwest[0] >= northeast[0] || southwest[1] >= northeast[1]) {
      context.addIssue({ code: "custom", message: "os limites do mapa são inválidos" });
      return;
    }

    const cityKeys = map.cities.map((city) => city.key);
    if (new Set(cityKeys).size !== cityKeys.length) {
      context.addIssue({ code: "custom", message: "há cidade duplicada no mapa" });
    }

    const insideBounds = ([longitude, latitude]: readonly [number, number]) =>
      longitude >= southwest[0] &&
      longitude <= northeast[0] &&
      latitude >= southwest[1] &&
      latitude <= northeast[1];

    if (!insideBounds(map.center)) {
      context.addIssue({ code: "custom", message: "o centro está fora dos limites do mapa" });
    }
    if (map.cities.some((city) => !insideBounds(city.coordinates))) {
      context.addIssue({ code: "custom", message: "há cidade fora dos limites do mapa" });
    }
    if (map.route.some((coordinate) => !insideBounds(coordinate))) {
      context.addIssue({ code: "custom", message: "há trecho da rota fora dos limites do mapa" });
    }
  });

export type TerritoryMapCity = z.infer<typeof territoryMapCitySchema>;
export type TerritoryMapDefinition = z.infer<typeof territoryMapSchema>;

export function validateTerritoryMap(candidate: unknown): TerritoryMapDefinition {
  return territoryMapSchema.parse(candidate);
}
