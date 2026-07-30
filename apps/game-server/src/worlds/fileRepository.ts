import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorldPackage } from "@terrativa/protocol";
import { worldPackageSchema } from "@terrativa/protocol";
import type { WorldRepository } from "./service.js";

export class FileWorldRepository implements WorldRepository {
  constructor(private readonly directory: string) {}

  async publish(worldPackage: WorldPackage): Promise<void> {
    const slug = worldPackage.serverManifest.boardSlug;
    const target = join(this.directory, `${slug}.json`);
    const temporary = join(this.directory, `.${slug}.${Date.now()}.tmp`);
    await mkdir(this.directory, { recursive: true });
    await writeFile(temporary, `${JSON.stringify(worldPackage, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  async findBySlug(slug: string): Promise<WorldPackage | null> {
    try {
      return worldPackageSchema.parse(
        JSON.parse(await readFile(join(this.directory, `${slug}.json`), "utf8")),
      );
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return null;
      throw error;
    }
  }
}
