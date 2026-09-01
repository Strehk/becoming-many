/**
 * Purpose: Verify the progress lines a long benchmark run prints while it works.
 * Context: An estimate that misleads is worse than no estimate at all.
 * Responsibility: Cover the frame-rate estimate, its absence, and formatting.
 * Boundary: Browser driving and report summarizing stay outside this test.
 */

import { describe, expect, test } from "bun:test";
import {
  describeLevelProgress,
  describeRemainingLevels,
  estimateRemainingMilliseconds,
  formatDuration,
} from "./benchmark-progress";

describe("estimateRemainingMilliseconds", () => {
  test("reads the rate from the interval between two observations", () => {
    const remaining = estimateRemainingMilliseconds(
      { frames: 600, totalFrames: 1_500, elapsedMilliseconds: 40_000 },
      { frames: 300, totalFrames: 1_500, elapsedMilliseconds: 30_000 },
    );

    // 300 frames in 10 s leaves 900 frames, so 30 s.
    expect(remaining).toBe(30_000);
  });

  test("measures from the start of the run when nothing was observed yet", () => {
    const remaining = estimateRemainingMilliseconds({
      frames: 100,
      totalFrames: 400,
      elapsedMilliseconds: 20_000,
    });

    expect(remaining).toBe(60_000);
  });

  test("has no estimate before a frame has been reported", () => {
    expect(
      estimateRemainingMilliseconds({
        frames: 0,
        totalFrames: 1_500,
        elapsedMilliseconds: 5_000,
      }),
    ).toBeUndefined();
  });
});

describe("describeLevelProgress", () => {
  test("states position, share, elapsed time, and the estimate", () => {
    const line = describeLevelProgress({
      frames: 750,
      totalFrames: 1_500,
      elapsedMilliseconds: 90_000,
    });

    expect(line).toBe("frame 750/1,500 (50%) · 1m 30s elapsed · ~1m 30s left");
  });

  test("omits the estimate while no frames have been observed", () => {
    const line = describeLevelProgress({
      frames: 0,
      totalFrames: 1_500,
      elapsedMilliseconds: 5_000,
    });

    expect(line).toBe("frame 0/1,500 (0%) · 5s elapsed");
  });
});

describe("describeRemainingLevels", () => {
  test("projects the average finished level onto the levels left", () => {
    expect(describeRemainingLevels([60_000, 120_000], 3)).toBe(
      "~4m 30s left for 3 level(s)",
    );
  });

  test("says nothing without a finished level or a level left", () => {
    expect(describeRemainingLevels([], 4)).toBeUndefined();
    expect(describeRemainingLevels([60_000], 0)).toBeUndefined();
  });
});

describe("formatDuration", () => {
  test("scales from seconds to hours", () => {
    expect(formatDuration(9_400)).toBe("9s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(3_960_000)).toBe("1h 06m");
  });
});
