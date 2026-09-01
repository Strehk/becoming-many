/**
 * Purpose: Verify the playhead carried between two status messages.
 * Context: Status arrives at ten hertz while the readout redraws every frame.
 * Responsibility: Cover holding, advancing at rate, and both ends of the show.
 * Boundary: How the status reached the page is the station link's concern.
 */

import { describe, expect, test } from "bun:test";
import { projectShowTime } from "../../src/conductor/playhead";
import type { ShowStatus } from "../../src/station/station-protocol";

const DURATION_SECONDS = 516;

function status(overrides: Partial<ShowStatus> = {}): ShowStatus {
  return {
    kind: "status",
    showTimeSeconds: 100,
    isPlaying: true,
    timeScale: 1,
    language: "en",
    levelName: "test",
    audioState: "running",
    ...overrides,
  };
}

describe("projectShowTime", () => {
  test("holds where a paused show reported", () => {
    expect(
      projectShowTime(status({ isPlaying: false }), 5, DURATION_SECONDS),
    ).toBe(100);
  });

  test("advances a playing show by the time since it reported", () => {
    expect(projectShowTime(status(), 0.25, DURATION_SECONDS)).toBe(100.25);
  });

  test("advances at the show's own rate", () => {
    expect(projectShowTime(status({ timeScale: 2 }), 1, DURATION_SECONDS)).toBe(
      102,
    );
    expect(
      projectShowTime(status({ timeScale: 0.5 }), 1, DURATION_SECONDS),
    ).toBe(100.5);
  });

  test("never runs past the end of the show", () => {
    expect(
      projectShowTime(
        status({ showTimeSeconds: DURATION_SECONDS - 0.1 }),
        10,
        DURATION_SECONDS,
      ),
    ).toBe(DURATION_SECONDS);
  });

  test("never falls before the start of the show", () => {
    expect(
      projectShowTime(
        status({ showTimeSeconds: 0, timeScale: 1 }),
        0,
        DURATION_SECONDS,
      ),
    ).toBe(0);
  });

  test("ignores a status that claims to arrive from the future", () => {
    expect(projectShowTime(status(), -3, DURATION_SECONDS)).toBe(100);
  });
});
