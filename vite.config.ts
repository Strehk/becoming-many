import { defineConfig } from "vite";
import { STATION_SETTINGS } from "./src/station/station-settings";

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
  build: {
    rollupOptions: {
      // Listing the entries replaces Vite's default index.html discovery, so
      // the show page has to be named here beside the conductor page.
      input: {
        main: "index.html",
        conductor: "conductor.html",
        flash: "flash.html",
      },
    },
  },
  server: {
    host: true,
    // Development starts at the complete rehearsal show; named level routes
    // remain explicit URLs for focused work.
    open: "/",
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
    proxy: stationProxy,
  },
  preview: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
    proxy: stationProxy,
  },
});
