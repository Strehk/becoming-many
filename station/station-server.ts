/**
 * Purpose: Run one station from one process: pages, broker, and health.
 * Context: A station PC runs this (usually in Docker) and opens two browser
 *   windows against it; the pages and the WebSocket relay share one origin.
 * Responsibility: Serve the built pages, relay commands one way and status the
 *   other, report presence, and expose /health and /config for operations.
 * Boundary: The broker holds no show state; the show clock stays the
 *   authority. Deployment env vars pass through /config; what they mean is
 *   decided by the pages that apply them.
 */

import { join } from "node:path";
import {
  type DeploymentConfig,
  parseDeploymentConfig,
} from "../src/station/deployment-config";
import {
  parseStationMessage,
  type StationRole,
  serializeStationMessage,
} from "../src/station/station-protocol";
import { STATION_SETTINGS } from "../src/station/station-settings";

interface SocketData {
  readonly role: StationRole;
}

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

const sockets: Record<StationRole, Set<Bun.ServerWebSocket<SocketData>>> = {
  show: new Set(),
  conductor: new Set(),
};

/** Commands travel to the show; everything the show reports travels back. */
const RELAY_TARGET: Record<StationRole, StationRole> = {
  conductor: "show",
  show: "conductor",
};

function readRole(url: URL): StationRole | undefined {
  const requested = url.searchParams.get("role");
  if (requested === "show" || requested === "conductor") return requested;

  return undefined;
}

function announce(role: StationRole, isConnected: boolean): void {
  const message = serializeStationMessage({
    kind: "presence",
    role,
    isConnected,
  });
  for (const socket of sockets[RELAY_TARGET[role]]) {
    socket.send(message);
  }
}

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
    connectedRoles: {
      show: sockets.show.size,
      conductor: sockets.conductor.size,
    },
  });
}

async function serveStatic(pathname: string): Promise<Response> {
  const decoded = decodeURIComponent(pathname);
  // The built pages live in one flat directory; anything trying to climb out
  // of it is not a page request.
  if (decoded.includes("..")) return new Response("Not found", { status: 404 });

  const relative = decoded === "/" ? "/index.html" : decoded;
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

const server = Bun.serve<SocketData, never>({
  port,

  fetch(request, bunServer) {
    const url = new URL(request.url);

    // A role query marks a broker connection wherever the socket points —
    // same-origin pages use /station, `?station=` overrides may hit the root.
    const role = readRole(url);
    if (role) {
      if (bunServer.upgrade(request, { data: { role } })) return undefined;

      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    if (url.pathname === "/station") {
      return new Response("Name a role: ?role=show or ?role=conductor", {
        status: 400,
      });
    }

    if (url.pathname === "/health") return healthResponse();
    if (url.pathname === "/config") return jsonResponse(deploymentConfig);

    return serveStatic(url.pathname);
  },

  websocket: {
    open(socket): void {
      const { role } = socket.data;
      sockets[role].add(socket);
      console.log(`${role} connected`);

      // Tell the newcomer who is already here, then tell the other side about
      // the newcomer. Without the first message a conductor opened after the
      // show would sit there reporting the show as missing.
      for (const peerRole of ["show", "conductor"] as const) {
        if (peerRole === role || sockets[peerRole].size === 0) continue;

        socket.send(
          serializeStationMessage({
            kind: "presence",
            role: peerRole,
            isConnected: true,
          }),
        );
      }
      announce(role, true);
    },

    message(socket, received): void {
      const message = parseStationMessage(
        typeof received === "string" ? received : received.toString(),
      );
      // A message the contract does not describe is dropped rather than
      // relayed: the far side would only have to reject it again.
      if (!message) return;
      // Presence is the broker's own statement about its sockets. Accepting it
      // from a page would let one window lie about another.
      if (message.kind === "presence") return;

      const relayed = serializeStationMessage(message);
      for (const peer of sockets[RELAY_TARGET[socket.data.role]]) {
        peer.send(relayed);
      }
    },

    close(socket): void {
      const { role } = socket.data;
      sockets[role].delete(socket);
      console.log(`${role} disconnected`);
      if (sockets[role].size === 0) announce(role, false);
    },
  },
});

console.log(
  `Station server on http://localhost:${server.port} — pages from dist/, broker at /station`,
);
