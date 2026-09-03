import { defineConfig, type Plugin } from "vite";
import { levelNameFromPath } from "./src/levels/level-names.ts";
import { STATION_SETTINGS } from "./src/station/station-settings";

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

// The pages reach the station server through their own origin (/config); in
// development that server is the separate `bun run station` process, so Vite
// forwards the path. With no server running the proxy errors and the pages
// fail soft, exactly as they do in production.
const stationProxy = {
  "/config": {
    target: `http://localhost:${STATION_SETTINGS.port}`,
  },
} as const;

export default defineConfig({
  plugins: [levelEntryRoutes],
  build: {
    rollupOptions: {
      // Listing the entries replaces Vite's default index.html discovery, so
      // the show page has to be named here beside the conductor page.
      input: {
        main: "index.html",
        test: "test.html",
        conductor: "conductor.html",
        flash: "flash.html",
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
    proxy: stationProxy,
  },
  preview: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
    proxy: stationProxy,
  },
});
