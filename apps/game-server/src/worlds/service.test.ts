import type { WorldPackage } from "@terrativa/protocol";
import { describe, expect, it } from "vitest";
import { type WorldRepository, WorldService } from "./service.js";

class MemoryWorldRepository implements WorldRepository {
  package: WorldPackage | null = null;

  async publish(worldPackage: WorldPackage): Promise<void> {
    this.package = worldPackage;
  }

  async findBySlug(slug: string): Promise<WorldPackage | null> {
    return this.package?.serverManifest.boardSlug === slug ? this.package : null;
  }
}

describe("WorldService", () => {
  it("aceita um pacote multiserver consistente", async () => {
    const repository = new MemoryWorldRepository();
    const service = new WorldService(repository);
    const result = await service.publish(validPackage());
    expect(result.serverManifest.authority).toBe("server");
    expect(await service.findPublished("ilha-teste")).toEqual(result);
  });

  it("rejeita divergência entre mundo e manifesto", async () => {
    const service = new WorldService(new MemoryWorldRepository());
    const candidate = validPackage();
    candidate.serverManifest.boardSlug = "outro-mundo";
    await expect(service.publish(candidate)).rejects.toThrow();
  });
});

function validPackage() {
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    world: {
      id: "world-ilha-teste",
      name: "Ilha Teste",
      slug: "ilha-teste",
      scene: { boardSlug: "ilha-teste" },
    },
    serverManifest: {
      protocolVersion: 1,
      authority: "server",
      roomType: "terrativa-world",
      maxPlayers: 6,
      tickRate: 20,
      region: "auto",
      sharding: "room",
      scriptRuntime: "sandbox-required",
      worldId: "world-ilha-teste",
      boardSlug: "ilha-teste",
      stateSchema: "terrativa.world-state.v1",
      routes: 36,
      assets: [],
      scripts: [],
    },
  };
}
