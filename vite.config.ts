import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ["dev.strehk.eu"],
  },
  preview: {
    host: true,
    allowedHosts: ["dev.strehk.eu"],
  },
});
