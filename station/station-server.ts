/**
 * Purpose: Run one station from one process: pages, config, and health.
 * Context: A station PC runs this (usually in Docker) and opens the conductor
 *   page against it; the show it hosts runs entirely in that one window.
 * Responsibility: Serve the built pages and expose /health and /config for
 *   operations.
 * Boundary: This process holds no show state. Deployment env vars pass
 *   through /config; what they mean is decided by the page that applies them.
 */

import { join } from "node:path";
import { levelNameFromPath } from "../src/levels/level-names";
import {
  type DeploymentConfig,
  parseDeploymentConfig,
} from "../src/station/deployment-config";
import { STATION_SETTINGS } from "../src/station/station-settings";

const DIST_DIRECTORY = join(import.meta.dir, "../dist");
const startedAtMilliseconds = Date.now();

// PORT names what this process listens on; the compose file maps a host port
// onto it. Everything else is page-facing and travels through /config.
const port = Number(process.env.PORT ?? "") || STATION_SETTINGS.port;

// Funneled through the same parser the pages use, so a blank env var reads as
// "not configured" on both sides rather than as an empty-string host.
const deploymentConfig: DeploymentConfig = parseDeploymentConfig({
  m5Host: process.env.M5_HOST,
  m5DeviceId: process.env.M5_DEVICE_ID,
  stationName: process.env.STATION_NAME,
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

/** Liveness, not show state: a healthy process with zero windows is healthy. */
function healthResponse(): Response {
  return jsonResponse({
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startedAtMilliseconds) / 1_000),
  });
}

async function serveStatic(pathname: string): Promise<Response> {
  const decoded = decodeURIComponent(pathname);
  // The built pages live in one flat directory; anything trying to climb out
  // of it is not a page request.
  if (decoded.includes("..")) return new Response("Not found", { status: 404 });

  const relative =
    decoded === "/"
      ? "/index.html"
      : levelNameFromPath(decoded)
        ? "/test.html"
        : decoded;
  const file = Bun.file(join(DIST_DIRECTORY, relative));
  if (!(await file.exists())) {
    return new Response(
      "Not found. Is dist/ present? The station server serves the output of `bun run build`.",
      { status: 404 },
    );
  }

  // Vite content-hashes everything under assets/, so those may cache forever;
  // the HTML entries must revalidate or an updated build would never arrive.
  const cacheControl = relative.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";

  return new Response(file, { headers: { "cache-control": cacheControl } });
}

const server = Bun.serve({
  port,

  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") return healthResponse();
    if (url.pathname === "/config") return jsonResponse(deploymentConfig);

    return serveStatic(url.pathname);
  },
});

console.log(
  `Station server on http://localhost:${server.port} — pages from dist/`,
);
