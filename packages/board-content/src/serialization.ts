import { createHash } from "node:crypto";
import { type TerrativaModule, validateTerrativaModule } from "./module.js";
import { type BoardContent, boardContentSchema } from "./schema.js";

export interface ExportedBoardContent {
  readonly json: string;
  readonly checksum: string;
}

export function exportBoardContent(content: BoardContent): ExportedBoardContent {
  return exportValidated(boardContentSchema.parse(content));
}

export function exportTerrativaModule(module: TerrativaModule): ExportedBoardContent {
  return exportValidated(validateTerrativaModule(module));
}

export function importBoardContent(source: string, expectedChecksum?: string): BoardContent {
  return importValidated(source, boardContentSchema, expectedChecksum);
}

export function importTerrativaModule(source: string, expectedChecksum?: string): TerrativaModule {
  return importValidated(source, { parse: validateTerrativaModule }, expectedChecksum);
}

function exportValidated(value: unknown): ExportedBoardContent {
  const json = `${stableStringify(value)}\n`;
  return Object.freeze({
    json,
    checksum: createHash("sha256").update(json, "utf8").digest("hex"),
  });
}

function importValidated<T>(
  source: string,
  schema: { parse(value: unknown): T },
  expectedChecksum?: string,
): T {
  const checksum = createHash("sha256").update(source, "utf8").digest("hex");
  if (expectedChecksum && !safeChecksumEquals(checksum, expectedChecksum)) {
    throw new Error("Terrativa content checksum mismatch");
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Terrativa content is not valid JSON");
  }
  return schema.parse(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function safeChecksumEquals(left: string, right: string): boolean {
  return /^[a-f0-9]{64}$/i.test(right) && left.toLowerCase() === right.toLowerCase();
}
