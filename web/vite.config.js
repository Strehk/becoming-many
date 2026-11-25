/**
 * Purpose: Serve and build the web release of Becoming Many.
 * Context: The web release is the start menu in front of the real experience
 *   (web/index.html). It uses the application's code from src/ and its
 *   public files from public/. GitHub Pages serves it under a sub-path
 *   (/becoming-many/), while the experience names its public files from the
 *   server root (/audio/..., /models/..., /fonts/...).
 * Responsibility: Root at web/, serve the repository's public files, and for
 *   the build ship only the public files the site loads and move
 *   root-relative public paths in scripts under the base.
 * Boundary: Only the web release; the installation keeps vite.config.ts.
 *   PAGES_BASE overrides the build's base (default /becoming-many/), and
 *   SITE_URL the address in the share preview. The legal notice's operator
 *   details come from the LEGAL_* variables (process environment or the
 *   repository's .env); a build without the required ones fails.
 */

import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

const here = import.meta.dirname;
const repository = resolve(here, "..");

/** Public folders the experience addresses from the server root. */
const ROOT_FOLDERS = ["audio", "models", "fonts", "routes", "firmware"];

/**
 * The public files the web release loads. The installation's tutorial and
 * granular audio and the controller firmware stay out of the site.
 */
const SHIPPED_PUBLIC = ["audio/narration", "fonts", "models", "routes"];

function copyShippedPublic(outDir) {
  return {
    name: "copy-shipped-public",
    apply: "build",
    closeBundle() {
      for (const folder of SHIPPED_PUBLIC)
        cpSync(resolve(repository, "public", folder), resolve(outDir, folder), {
          recursive: true,
        });
      // The page's own files that keep their names (the share image, the
      // page GitHub Pages shows for a wrong address).
      cpSync(resolve(here, "static"), outDir, { recursive: true });
      const notFound = resolve(outDir, "404.html");
      writeFileSync(
        notFound,
        readFileSync(notFound, "utf8").replaceAll("%SITE_URL%", SITE_URL),
      );
    },
  };
}

/** The address the site is shared under, for its share preview. */
const SITE_URL =
  process.env.SITE_URL ?? "https://e-mus.github.io/becoming-many/";

function siteUrl() {
  return {
    name: "site-url",
    transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL),
  };
}

function publicPathsUnderBase(base) {
  const pattern = new RegExp(`(["'\`])/(${ROOT_FOLDERS.join("|")})/`, "g");
  return {
    name: "public-paths-under-base",
    apply: "build",
    transform(code, id) {
      const file = id.split("?")[0];
      if (file.includes("node_modules") || !/\.(m?[jt]s)$/.test(file))
        return null;
      pattern.lastIndex = 0;
      if (!pattern.test(code)) return null;
      pattern.lastIndex = 0;
      return { code: code.replace(pattern, `$1${base}$2/`), map: null };
    },
  };
}

/** Operator details the legal notice cannot be published without. */
const REQUIRED_LEGAL = [
  "LEGAL_NAME",
  "LEGAL_STREET",
  "LEGAL_CITY",
  "LEGAL_EMAIL",
];

function checkLegal(mode, building) {
  const env = loadEnv(mode, repository, "LEGAL_");
  const missing = REQUIRED_LEGAL.filter((name) => !env[name]?.trim());
  if (missing.length === 0) return;
  const message = `Legal notice incomplete, set ${missing.join(", ")} (see .env.example).`;
  if (building) throw new Error(message);
  console.warn(`[web] ${message}`);
}

export default defineConfig(({ command, mode, isPreview }) => {
  // A preview serves the build, so it uses the build's base.
  const building = command === "build" || isPreview;
  const base = building ? (process.env.PAGES_BASE ?? "/becoming-many/") : "/";
  const outDir = resolve(here, "dist-pages");
  checkLegal(mode, command === "build");
  return {
    root: here,
    base,
    // The LEGAL_* variables reach web/lib/legal.js as import.meta.env.
    envDir: repository,
    envPrefix: ["VITE_", "LEGAL_"],
    // Serving offers all of public/; the build copies only what ships.
    publicDir: building ? false : resolve(repository, "public"),
    server: { fs: { allow: [repository] } },
    plugins: [publicPathsUnderBase(base), copyShippedPublic(outDir), siteUrl()],
    build: {
      outDir,
      emptyOutDir: true,
      target: "es2022",
    },
  };
});
