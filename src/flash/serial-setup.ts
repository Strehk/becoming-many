/**
 * Purpose: Own the USB Web Serial channel to a connected M5 controller.
 * Context: The firmware speaks newline-delimited JSON on its native USB port.
 * Responsibility: Open and close the port, frame lines, send typed commands,
 *   and hand every received JSON line to the page.
 * Boundary: What the lines mean and how they are shown live in flash-page.ts;
 *   the command shapes live in src/m5/protocol.ts.
 */

import type { M5SerialCommand } from "../m5/protocol";

const BAUD_RATE = 115200;

export interface SerialSetupChannel {
  readonly isOpen: boolean;
  send(command: M5SerialCommand): Promise<void>;
  close(): Promise<void>;
}

export interface SerialSetupEvents {
  /** One parsed JSON object per device line. Unparseable lines arrive as text. */
  readonly onLine: (line: Record<string, unknown> | string) => void;
  readonly onClosed: () => void;
}

export function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

/** Prompt for a port and start reading. Rejects when the user cancels. */
export async function openSerialSetup(
  events: SerialSetupEvents,
): Promise<SerialSetupChannel> {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: BAUD_RATE });

  let open = true;
  const encoder = new TextEncoder();
  readLines(port, events, () => open).finally(() => {
    open = false;
    events.onClosed();
  });

  return {
    get isOpen() {
      return open;
    },
    async send(command) {
      const writer = port.writable?.getWriter();
      if (!writer) throw new Error("Serial port is not writable");
      try {
        await writer.write(encoder.encode(`${JSON.stringify(command)}\n`));
      } finally {
        writer.releaseLock();
      }
    },
    async close() {
      open = false;
      // Cancelling the reader unlocks the streams so the port can close; the
      // read loop ends through its own error path.
      try {
        await port.readable?.cancel();
      } catch {
        // Already unlocked or closed.
      }
      try {
        await port.close();
      } catch {
        // The port may already be gone (unplugged).
      }
    },
  };
}

async function readLines(
  port: SerialPort,
  events: SerialSetupEvents,
  isOpen: () => boolean,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (isOpen() && port.readable) {
    const reader = port.readable.getReader();
    try {
      while (isOpen()) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        buffer = emitCompleteLines(buffer, events);
      }
    } catch {
      // A cancelled read or unplugged device ends the loop.
      return;
    } finally {
      reader.releaseLock();
    }
  }
}

function emitCompleteLines(buffer: string, events: SerialSetupEvents): string {
  const lines = buffer.split("\n");
  // The last piece is an incomplete line; keep it for the next chunk.
  const rest = lines.pop() ?? "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    events.onLine(parseLine(line));
  }
  return rest;
}

function parseLine(line: string): Record<string, unknown> | string {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Boot noise and log output are not JSON; hand them over as text.
  }
  return line;
}
