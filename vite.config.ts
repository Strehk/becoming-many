import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

/**
 * WebXR only exists in a secure context, and a headset reaching the dev
 * server over the LAN has none: plain http means no `navigator.xr` and a dead
 * VR button. Point these at a certificate to serve https instead:
 *
 *   DEV_HTTPS_KEY=.certs/dev-key.pem DEV_HTTPS_CERT=.certs/dev-cert.pem \
 *     bun run dev --port 5443 --strictPort
 *
 * Kept behind the variables on purpose. A dev server that silently switched
 * to https would break every plain-http consumer in front of it, the reverse
 * proxy included, so the http server stays the default and the https one runs
 * beside it on its own port.
 */
function readDevHttps():
  | { readonly key: Buffer; readonly cert: Buffer }
  | undefined {
  const keyPath = process.env.DEV_HTTPS_KEY;
  const certPath = process.env.DEV_HTTPS_CERT;
  if (!keyPath || !certPath) return undefined;

  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

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
    https: readDevHttps(),
  },
  preview: {
    host: true,
    allowedHosts: ["dev.strehk.eu", "dev.e.strehk.eu"],
  },
});
