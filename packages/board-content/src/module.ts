import { z } from "zod";
import { toEngineBoard } from "./engineAdapter.js";
import { type TerritoryMapDefinition, territoryMapSchema } from "./geography.js";
import { type BoardContent, boardContentSchema } from "./schema.js";

const moduleSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const spdxExpressionSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[A-Za-z0-9.+() -]+$/);

export const moduleAuthorSchema = z
  .object({
    name: z.string().min(2).max(120),
    url: z.url().optional(),
  })
  .strict();

export const moduleLicenseSchema = z
  .object({
    code: spdxExpressionSchema,
    content: spdxExpressionSchema,
    assets: spdxExpressionSchema,
  })
  .strict();

export const moduleTerritorySchema = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    subdivisionCodes: z.array(z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/)).max(20),
    regionName: z.string().min(2).max(120),
  })
  .strict();

export const terrativaModuleSchema = z
  .object({
    moduleApiVersion: z.literal(1),
    slug: moduleSlugSchema,
    name: z.string().min(2).max(120),
    summary: z.string().min(20).max(360),
    version: semanticVersionSchema,
    engineCompatibility: z.string().min(1).max(80),
    locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
    territory: moduleTerritorySchema,
    authors: z.array(moduleAuthorSchema).min(1).max(30),
    license: moduleLicenseSchema,
    repositoryUrl: z.url().optional(),
    homepageUrl: z.url().optional(),
    attribution: z.string().min(10).max(1_000),
    boards: z.array(boardContentSchema).min(1).max(20),
    mapViews: z.array(territoryMapSchema).max(20).default([]),
  })
  .strict()
  .superRefine((module, context) => {
    checkUnique(
      module.boards.map((board) => board.id),
      "ID de tabuleiro",
      context,
    );
    checkUnique(
      module.boards.map((board) => board.slug),
      "slug de tabuleiro",
      context,
    );
    checkUnique(
      module.mapViews.map((map) => map.boardSlug),
      "mapa de tabuleiro",
      context,
    );
    for (const board of module.boards) {
      if (board.locale !== module.locale) {
        context.addIssue({
          code: "custom",
          message: `o tabuleiro ${board.slug} usa locale diferente do módulo`,
        });
      }
    }
    const boardBySlug = new Map(module.boards.map((board) => [board.slug, board]));
    for (const map of module.mapViews) {
      const board = boardBySlug.get(map.boardSlug);
      if (!board) {
        context.addIssue({
          code: "custom",
          message: `o mapa referencia um tabuleiro inexistente: ${map.boardSlug}`,
        });
        continue;
      }
      const boardCityKeys = new Set(board.cities.map((city) => city.key));
      for (const city of map.cities) {
        if (!boardCityKeys.has(city.key)) {
          context.addIssue({
            code: "custom",
            message: `o mapa de ${map.boardSlug} referencia uma cidade inexistente: ${city.key}`,
          });
        }
      }
    }
  });

export type TerrativaModule = z.infer<typeof terrativaModuleSchema>;

export interface TerrativaModuleSummary {
  readonly slug: string;
  readonly name: string;
  readonly version: string;
  readonly locale: string;
  readonly regionName: string;
  readonly boardCount: number;
  readonly official: boolean;
}

export interface TerrativaModuleRegistry {
  list(): readonly TerrativaModuleSummary[];
  get(moduleSlug: string): TerrativaModule | null;
  getBoard(boardSlug: string): BoardContent | null;
  getMap(boardSlug: string): TerritoryMapDefinition | null;
}

export function validateTerrativaModule(candidate: unknown): TerrativaModule {
  const module = terrativaModuleSchema.parse(candidate);
  for (const board of module.boards) {
    toEngineBoard(board);
  }
  return module;
}

export function createModuleRegistry(
  modules: readonly TerrativaModule[],
  officialModuleSlugs: readonly string[] = [],
): TerrativaModuleRegistry {
  const bySlug = new Map<string, TerrativaModule>();
  const boardBySlug = new Map<string, BoardContent>();
  const mapByBoardSlug = new Map<string, TerritoryMapDefinition>();
  const official = new Set(officialModuleSlugs);

  for (const candidate of modules) {
    const module = validateTerrativaModule(candidate);
    if (bySlug.has(module.slug)) {
      throw new Error(`Duplicate Terrativa module slug: ${module.slug}`);
    }
    bySlug.set(module.slug, module);
    for (const board of module.boards) {
      if (boardBySlug.has(board.slug)) {
        throw new Error(`Duplicate Terrativa board slug: ${board.slug}`);
      }
      boardBySlug.set(board.slug, board);
    }
    for (const map of module.mapViews) {
      mapByBoardSlug.set(map.boardSlug, map);
    }
  }
  for (const slug of official) {
    if (!bySlug.has(slug)) {
      throw new Error(`Official module is not registered: ${slug}`);
    }
  }
  for (const module of bySlug.values()) {
    if (!official.has(module.slug) && !module.repositoryUrl) {
      throw new Error(`Community module requires repositoryUrl: ${module.slug}`);
    }
  }

  const summaries = Object.freeze(
    [...bySlug.values()]
      .map((module) =>
        Object.freeze({
          slug: module.slug,
          name: module.name,
          version: module.version,
          locale: module.locale,
          regionName: module.territory.regionName,
          boardCount: module.boards.length,
          official: official.has(module.slug),
        }),
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
  );

  return Object.freeze({
    list: () => summaries,
    get: (moduleSlug: string) => bySlug.get(moduleSlug) ?? null,
    getBoard: (boardSlug: string) => boardBySlug.get(boardSlug) ?? null,
    getMap: (boardSlug: string) => mapByBoardSlug.get(boardSlug) ?? null,
  });
}

function checkUnique(values: readonly string[], label: string, context: z.RefinementCtx): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message: `há ${label} duplicado` });
  }
}
