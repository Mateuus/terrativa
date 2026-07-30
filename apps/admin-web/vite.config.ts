import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const generatedSceneFile = fileURLToPath(
  new URL("../../packages/board-content/src/baixadaSantistaScene.data.ts", import.meta.url),
);
const sharedPublicDirectory = fileURLToPath(new URL("../game-client/public", import.meta.url));
const publishedWorldsDirectory = fileURLToPath(new URL("./data/worlds", import.meta.url));
const allowedAssetExtensions = new Set([
  ".glb",
  ".gltf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp3",
  ".ogg",
  ".wav",
  ".json",
]);

function mapStudioPublisher(): Plugin {
  return {
    name: "terrativa-map-studio-publisher",
    configureServer(server) {
      server.middlewares.use("/__terrativa-studio/assets", (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        request.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size <= 25_000_000) chunks.push(chunk);
        });
        request.on("end", () => {
          void (async () => {
            try {
              if (size === 0 || size > 25_000_000)
                throw new Error("O asset deve ter entre 1 byte e 25 MB.");
              const url = new URL(request.url ?? "/", "http://studio.local");
              const world = url.searchParams.get("world") ?? "";
              if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(world)) throw new Error("Mundo inválido.");
              const encodedName = request.headers["x-asset-name"];
              const originalName = decodeURIComponent(
                Array.isArray(encodedName) ? (encodedName[0] ?? "") : (encodedName ?? ""),
              );
              const extension = extname(originalName).toLowerCase();
              if (!allowedAssetExtensions.has(extension))
                throw new Error("Formato não suportado. Use GLB, glTF, imagem, áudio ou JSON.");
              const baseName =
                originalName
                  .slice(0, Math.max(0, originalName.length - extension.length))
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, 70) || "asset";
              const id = `asset-${randomUUID()}`;
              const fileName = `${id}-${baseName}${extension}`;
              const directory = fileURLToPath(
                new URL(`../game-client/public/assets/worlds/${world}/`, import.meta.url),
              );
              await mkdir(directory, { recursive: true });
              await writeFile(
                fileURLToPath(
                  new URL(
                    `../game-client/public/assets/worlds/${world}/${fileName}`,
                    import.meta.url,
                  ),
                ),
                Buffer.concat(chunks),
              );
              response.statusCode = 201;
              response.setHeader("content-type", "application/json; charset=utf-8");
              response.end(
                JSON.stringify({
                  id,
                  name: originalName,
                  url: `/assets/worlds/${world}/${fileName}`,
                  mimeType: request.headers["content-type"] ?? "application/octet-stream",
                  size,
                }),
              );
            } catch (error) {
              response.statusCode = 400;
              response.setHeader("content-type", "application/json; charset=utf-8");
              response.end(
                JSON.stringify({
                  message: error instanceof Error ? error.message : "Falha ao importar asset",
                }),
              );
            }
          })();
        });
      });

      server.middlewares.use("/__terrativa-studio/publish", (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        request.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size <= 5_000_000) chunks.push(chunk);
        });
        request.on("end", () => {
          void (async () => {
            try {
              if (size > 5_000_000) throw new Error("O mapa excede o limite de 5 MB.");
              const candidate: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              if (
                typeof candidate !== "object" ||
                candidate === null ||
                !("world" in candidate) ||
                typeof candidate.world !== "object" ||
                candidate.world === null ||
                !("scene" in candidate.world) ||
                typeof candidate.world.scene !== "object" ||
                candidate.world.scene === null ||
                !("boardSlug" in candidate.world.scene) ||
                typeof candidate.world.scene.boardSlug !== "string" ||
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.world.scene.boardSlug)
              ) {
                throw new Error("O pacote não contém uma cena de mundo válida.");
              }
              const slug = candidate.world.scene.boardSlug;
              await mkdir(publishedWorldsDirectory, { recursive: true });
              await writeFile(
                fileURLToPath(new URL(`./data/worlds/${slug}.json`, import.meta.url)),
                `${JSON.stringify(candidate, null, 2)}\n`,
                "utf8",
              );
              if (slug === "baixada-santista") {
                const source = `const sceneData: unknown = ${JSON.stringify(candidate.world.scene, null, 2)};\n\nexport default sceneData;\n`;
                await writeFile(generatedSceneFile, source, "utf8");
              }
              response.statusCode = 200;
              response.setHeader("content-type", "application/json; charset=utf-8");
              response.end(JSON.stringify({ message: `Mundo “${slug}” publicado` }));
              server.ws.send({ type: "full-reload" });
            } catch (error) {
              response.statusCode = 400;
              response.setHeader("content-type", "application/json; charset=utf-8");
              response.end(
                JSON.stringify({
                  message: error instanceof Error ? error.message : "Falha ao publicar o mapa",
                }),
              );
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mapStudioPublisher()],
  publicDir: sharedPublicDirectory,
  server: {
    port: 5174,
    strictPort: true,
  },
});
