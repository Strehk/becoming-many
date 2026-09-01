/**
 * Purpose: Join the show window and the conductor page on one station machine.
 * Context: Two browser windows on the same PC cannot command each other directly.
 * Responsibility: Relay commands one way, status the other, and report presence.
 * Boundary: The broker holds no show state; the show clock stays the authority.
 */

import {
  parseStationMessage,
  type StationRole,
  serializeStationMessage,
} from "../src/station/station-protocol";
import { STATION_SETTINGS } from "../src/station/station-settings";

interface SocketData {
  readonly role: StationRole;
}

const sockets: Record<StationRole, Set<Bun.ServerWebSocket<SocketData>>> = {
  show: new Set(),
  conductor: new Set(),
};

/** Commands travel to the show; everything the show reports travels back. */
const RELAY_TARGET: Record<StationRole, StationRole> = {
  conductor: "show",
  show: "conductor",
};

function readRole(url: string): StationRole | undefined {
  const requested = new URL(url).searchParams.get("role");
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

const server = Bun.serve<SocketData, never>({
  port: STATION_SETTINGS.port,

  fetch(request, bunServer) {
    const role = readRole(request.url);
    if (!role) {
      return new Response("Name a role: ?role=show or ?role=conductor", {
        status: 400,
      });
    }
    if (bunServer.upgrade(request, { data: { role } })) return undefined;

    return new Response("Expected a WebSocket upgrade", { status: 426 });
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

console.log(`Station broker listening on ws://localhost:${server.port}`);
