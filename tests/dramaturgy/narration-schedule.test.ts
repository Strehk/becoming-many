/**
 * Purpose: Verify which recording covers a given show time.
 * Context: A cue holds the timeline until the next one, with no cue duration.
 * Responsibility: Cover slot boundaries, gaps, and the ends of the show.
 * Boundary: Which file a cue resolves to is the catalogue's concern.
 */

import { describe, expect, test } from "bun:test";
import {
  type NarrationSchedule,
  narrationCueAt,
} from "../../src/dramaturgy/narration-schedule";

const SCHEDULE: NarrationSchedule = {
  durationSeconds: 100,
  narration: [
    { cueId: "prologue", atSeconds: 10 },
    { cueId: "scent", atSeconds: 40 },
    { cueId: "echo", atSeconds: 70 },
  ],
};

describe("narrationCueAt", () => {
  test("is silent before the first cue starts", () => {
    expect(narrationCueAt(SCHEDULE, 0)).toBeUndefined();
    expect(narrationCueAt(SCHEDULE, 9.99)).toBeUndefined();
  });

  test("is silent before the show begins", () => {
    expect(narrationCueAt(SCHEDULE, -5)).toBeUndefined();
  });

  test("starts a recording at its own cue time", () => {
    expect(narrationCueAt(SCHEDULE, 10)).toEqual({
      cueId: "prologue",
      offsetSeconds: 0,
    });
  });

  test("reports how far into the recording the show is", () => {
    expect(narrationCueAt(SCHEDULE, 25)).toEqual({
      cueId: "prologue",
      offsetSeconds: 15,
    });
  });

  test("gives a boundary instant to the cue that starts there", () => {
    expect(narrationCueAt(SCHEDULE, 39.99)?.cueId).toBe("prologue");
    expect(narrationCueAt(SCHEDULE, 40)).toEqual({
      cueId: "scent",
      offsetSeconds: 0,
    });
  });

  test("holds the last cue until the show length is reached", () => {
    expect(narrationCueAt(SCHEDULE, 99.5)).toEqual({
      cueId: "echo",
      offsetSeconds: 29.5,
    });
  });

  test("is silent once the show has run its length", () => {
    expect(narrationCueAt(SCHEDULE, 100)).toBeUndefined();
    expect(narrationCueAt(SCHEDULE, 500)).toBeUndefined();
  });
});
