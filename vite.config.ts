import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { levelNameFromPath } from "./shared/level-routes.ts";

/**
 * The root serves the web release's menu; the bare experience page moved to
 * /dev, and stable /echo-style level links open it.
 */
function rewriteDevRequest(request: { url?: string }): void {
  if (!request.url) return;

  const url = new URL(request.url, "http://localhost");
  const isDevPage = /^\/dev\/?$/.test(url.pathname);
  if (!isDevPage && !levelNameFromPath(url.pathname)) return;
  request.url = `/dev.html${url.search}`;
}

const devPageRoutes: Plugin = {
  name: "dev-page-routes",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      rewriteDevRequest(request);
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, _response, next) => {
      rewriteDevRequest(request);
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

/** Operator details the web release's legal notice cannot be published without. */
const REQUIRED_RELEASE_ENV = [
  "LEGAL_NAME",
  "LEGAL_STREET",
  "LEGAL_CITY",
  "LEGAL_EMAIL",
  "SITE_URL",
] as const;

/**
 * The public web release (`--mode release`, used by `bun run deploy`) refuses
 * to build without the operator's details and its public address. Every other
 * build (station image, CI) only warns: the menu page still builds, with an
 * empty legal notice that is never published.
 */
function checkReleaseEnv(mode: string, env: Record<string, string>): void {
  const missing = REQUIRED_RELEASE_ENV.filter((name) => !env[name]?.trim());
  if (missing.length === 0) return;
  const message = `Web release incomplete, set ${missing.join(", ")} (see .env.example).`;
  if (mode === "release") throw new Error(message);
  console.warn(`[web] ${message}`);
}

/** The address the share preview names; only meaningful in a release. */
function siteUrl(env: Record<string, string>): Plugin {
  const raw = env.SITE_URL?.trim() || "/";
  const url = raw.endsWith("/") ? raw : `${raw}/`;
  return {
    name: "site-url",
    transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", url),
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, import.meta.dirname, ["LEGAL_", "SITE_"]);
  if (command === "build") checkReleaseEnv(mode, env);
  return {
    root: resolve(import.meta.dirname, "src/ui"),
    publicDir: resolve(import.meta.dirname, "public"),
    // The LEGAL_* variables reach web/lib/legal.js as import.meta.env.
    envDir: import.meta.dirname,
    envPrefix: ["VITE_", "LEGAL_"],
    plugins: [devPageRoutes, siteUrl(env)],
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
        // the menu page has to be named here beside the other pages.
        input: {
          main: resolve(import.meta.dirname, "src/ui/index.html"),
          dev: resolve(import.meta.dirname, "src/ui/dev.html"),
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
  };
});
