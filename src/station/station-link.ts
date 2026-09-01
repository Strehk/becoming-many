/**
 * Purpose: Hold one page's socket to the station broker.
 * Context: Either page may start first, and the broker may be restarted under them.
 * Responsibility: Own the socket, its retry, and typed sending and receiving.
 * Boundary: What a message means is decided by the page that owns this link.
 */

import {
  parseStationMessage,
  type StationMessage,
  type StationRole,
  serializeStationMessage,
} from "./station-protocol";
import { STATION_SETTINGS } from "./station-settings";

export interface StationLinkOptions {
  readonly role: StationRole;
  /** Already resolved by the entry through `resolveStationUrl`. */
  readonly stationUrl: string;
  readonly onMessage: (message: StationMessage) => void;
  /** Reports this page's own socket, not the peer's presence. */
  readonly onConnectionChange?: (isConnected: boolean) => void;
}

export interface StationLink {
  /** Dropped while disconnected: a command nobody receives is not queued. */
  readonly send: (message: StationMessage) => void;
  readonly isConnected: () => boolean;
  readonly unload: () => void;
}

export function createStationLink({
  role,
  stationUrl,
  onMessage,
  onConnectionChange,
}: StationLinkOptions): StationLink {
  const address = `${stationUrl}?role=${role}`;
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let isUnloaded = false;

  function connect(): void {
    if (isUnloaded) return;

    const pending = new WebSocket(address);
    socket = pending;

    pending.addEventListener("open", () => onConnectionChange?.(true));
    pending.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;

      const message = parseStationMessage(event.data);
      if (message) onMessage(message);
    });
    // A refused connection fires close as well, so retry lives in one place.
    pending.addEventListener("close", () => {
      if (socket !== pending) return;

      socket = undefined;
      onConnectionChange?.(false);
      retryTimer = setTimeout(
        connect,
        STATION_SETTINGS.reconnectDelayMilliseconds,
      );
    });
    // Without this an errored socket logs an uncaught event; close follows.
    pending.addEventListener("error", () => pending.close());
  }

  connect();

  return {
    send(message): void {
      if (socket?.readyState !== WebSocket.OPEN) return;

      socket.send(serializeStationMessage(message));
    },

    isConnected: () => socket?.readyState === WebSocket.OPEN,

    unload(): void {
      isUnloaded = true;
      clearTimeout(retryTimer);
      socket?.close();
      socket = undefined;
    },
  };
}
