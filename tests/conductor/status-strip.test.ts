/**
 * Purpose: Pin the Picture tile to the loop the frame rate actually describes.
 * Context: The rate is the headset's only while a session presents; the
 *   preview runs at the station monitor's refresh, under the headset floor by
 *   construction, and must not read as a fault.
 * Responsibility: Cover the session × measurement matrix behind the tile.
 * Boundary: A reading names a value, never a word; which word says it is the
 *   conductor copy's business. The DOM around it lives in the status strip,
 *   untested by design.
 */

import { describe, expect, test } from "bun:test";
import { pictureReading } from "../../src/conductor/status-strip";

const streaming = { availability: "available", isSessionActive: true } as const;
const idle = { availability: "available", isSessionActive: false } as const;

describe("pictureReading", () => {
  test("reports nothing while the preview holds the render loop", () => {
    // A station monitor's 60 Hz is not a fault, and used to read as one.
    expect(pictureReading(60, idle)).toEqual(["none", "idle"]);
  });

  test("stays quiet even when the preview runs above the floor", () => {
    expect(pictureReading(120, idle)).toEqual(["none", "idle"]);
  });

  test("waits for the first samples of a fresh session", () => {
    expect(pictureReading(undefined, streaming)).toEqual(["measuring", "idle"]);
  });

  test("reads OK once the headset holds the acceptance rate", () => {
    expect(pictureReading(90, streaming)).toEqual(["ok", "live"]);
  });

  test("asks for a look when the headset picture drops below the floor", () => {
    expect(pictureReading(72, streaming)).toEqual(["check", "warn"]);
  });
});
