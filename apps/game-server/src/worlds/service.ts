import type { WorldPackage } from "@terrativa/protocol";
import { worldPackageSchema } from "@terrativa/protocol";

export interface WorldRepository {
  publish(worldPackage: WorldPackage): Promise<void>;
  findBySlug(slug: string): Promise<WorldPackage | null>;
}

export class WorldService {
  constructor(private readonly repository: WorldRepository) {}

  async publish(candidate: unknown): Promise<WorldPackage> {
    const worldPackage = worldPackageSchema.parse(candidate);
    await this.repository.publish(worldPackage);
    return worldPackage;
  }

  async findPublished(slug: string): Promise<WorldPackage | null> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    return this.repository.findBySlug(slug);
  }
}
