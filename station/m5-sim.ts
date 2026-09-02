/**
 * Purpose: Stand in for an M5 controller so the polling chain runs without hardware.
 * Context: Development happens away from the rig; the adapter, pipeline, flight,
 *   and conductor status still need something answering GET /state.
 * Responsibility: Serve firmware-shaped payloads with a slow tilt sweep and
 *   advancing button counters.
 * Boundary: A Bun process outside the app bundle, like station-server.ts. The
 *   payload shape mirrors src/m5/protocol.ts; steering behavior lives in the app.
 *
 * Usage: bun run m5-sim [--port 5183] [--device <deviceId>] [--firmware <version>]
 *   --device and --firmware exist to exercise the wrong-device and
 *   firmware-mismatch warnings.
 */

import { M5_FIRMWARE_VERSION } from "../src/m5/protocol";

const DEFAULT_PORT = 5183;
// Full sweep period of the simulated tilt, slow enough to watch the flight turn.
const SWEEP_PERIOD_SECONDS = 12;
// The simulated visitor taps the button on this beat.
const BUTTON_PERIOD_SECONDS = 5;
const MAX_DEFLECTION = 0.5;

const port = Number(readArgument("--port") ?? DEFAULT_PORT);
const deviceId = readArgument("--device") ?? "bm-sim-m5";
const firmwareVersion = readArgument("--firmware") ?? M5_FIRMWARE_VERSION;
const startedAtMilliseconds = Date.now();

Bun.serve({
  port,
  fetch(request) {
    if (new URL(request.url).pathname !== "/state") {
      return new Response('{"error":"unknown path, poll /state"}', {
        status: 404,
        headers: responseHeaders(),
      });
    }

    return new Response(JSON.stringify(currentState()), {
      headers: responseHeaders(),
    });
  },
});

console.log(
  `m5-sim: serving http://localhost:${port}/state as "${deviceId}" (${firmwareVersion})`,
);

function currentState(): Record<string, unknown> {
  const uptimeMs = Date.now() - startedAtMilliseconds;
  const sweepPhase = (uptimeMs / 1_000 / SWEEP_PERIOD_SECONDS) * 2 * Math.PI;
  const buttonBeats = Math.floor(uptimeMs / 1_000 / BUTTON_PERIOD_SECONDS);

  return {
    deviceId,
    firmwareVersion,
    seq: Math.floor(uptimeMs / 50),
    uptimeMs,
    pitch: Math.sin(sweepPhase) * MAX_DEFLECTION,
    roll: Math.cos(sweepPhase) * MAX_DEFLECTION,
    quality: 1,
    buttonPressed: false,
    buttonPressCount: buttonBeats,
    buttonReleaseCount: buttonBeats,
    isCalibrated: true,
    rssi: -50,
  };
}

function responseHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
