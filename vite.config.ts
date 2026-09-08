import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { levelNameFromPath } from "./shared/level-routes.ts";

function rewriteLevelRequest(request: { url?: string }): void {
  if (!request.url) return;

  const url = new URL(request.url, "http://localhost");
  if (!levelNameFromPath(url.pathname)) return;
  request.url = `/test.html${url.search}`;
}

/** Keep stable /echo-style links while serving their explicit Test entry. */
const levelEntryRoutes: Plugin = {
  name: "level-entry-routes",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      rewriteLevelRequest(request);
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, _response, next) => {
      rewriteLevelRequest(request);
      next();
    });
  },
};

export default defineConfig({
  root: resolve(import.meta.dirname, "src/ui"),
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [levelEntryRoutes],
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rolldownOptions: {
      // Listing the entries replaces Vite's default index.html discovery, so
      // the show page has to be named here beside the conductor page.
      input: {
        main: resolve(import.meta.dirname, "src/ui/index.html"),
        test: resolve(import.meta.dirname, "src/ui/test.html"),
        conductor: resolve(import.meta.dirname, "src/ui/conductor.html"),
        flash: resolve(import.meta.dirname, "src/ui/flash.html"),
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
  },
  preview: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
  },
});
