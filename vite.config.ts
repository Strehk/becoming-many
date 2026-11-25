import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { levelNameFromPath } from "./shared/level-routes.ts";

function rewriteLevelRequest(request: { url?: string }): void {
  if (!request.url) return;

  const url = new URL(request.url, "http://localhost");
  if (!levelNameFromPath(url.pathname)) return;
  request.url = `/${url.search}`;
}

/** Keep stable /echo-style links while serving the root experience page. */
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

/**
 * Extra hostnames the dev and preview servers answer to (e.g. a tunnel to a
 * personal domain), comma-separated in DEV_ALLOWED_HOSTS; kept out of the
 * repository in the untracked .env.
 */
function allowedHosts(mode: string): string[] {
  const { DEV_ALLOWED_HOSTS = "" } = loadEnv(mode, import.meta.dirname, "DEV_");
  return DEV_ALLOWED_HOSTS.split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export default defineConfig(({ mode }) => ({
  root: resolve(import.meta.dirname, "src/ui"),
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [levelEntryRoutes],
  resolve: {
    // Browser bootstraps are siblings of the HTML root in both dev and build.
    alias: {
      "/entry": resolve(import.meta.dirname, "src/entry"),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rolldownOptions: {
      // Listing the entries replaces Vite's default index.html discovery, so
      // the show page has to be named here beside the conductor page.
      input: {
        main: resolve(import.meta.dirname, "src/ui/index.html"),
        conductor: resolve(import.meta.dirname, "src/ui/conductor.html"),
        flash: resolve(import.meta.dirname, "src/ui/flash.html"),
      },
    },
  },
  server: {
    host: true,
    allowedHosts: allowedHosts(mode),
  },
  preview: {
    host: true,
    allowedHosts: allowedHosts(mode),
  },
}));
