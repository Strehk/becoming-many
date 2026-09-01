import { defineConfig } from "vite";

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
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
  },
  preview: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
  },
});
