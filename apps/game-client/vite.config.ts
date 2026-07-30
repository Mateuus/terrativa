import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/map-assets": {
        target: "https://tiles.openfreemap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/map-assets/, ""),
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
