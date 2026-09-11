import { describe, expect, test } from "bun:test";
import {
  showTrackFraction,
  trackShowSeconds,
  tutorialReadout,
} from "../../src/ui/shared/tutorial-timeline";

describe("tutorial timeline projection", () => {
  test("reserves a fixed block without changing main show seconds", () => {
    expect(showTrackFraction(0, 900, true)).toBe(0.12);
    expect(showTrackFraction(900, 900, true)).toBe(1);
    expect(trackShowSeconds(0.06, 900, true)).toBeUndefined();
    expect(trackShowSeconds(0.12, 900, true)).toBe(0);
    expect(
      trackShowSeconds(showTrackFraction(320, 900, true), 900, true),
    ).toBeCloseTo(320);
    expect(showTrackFraction(320, 900, false)).toBe(320 / 900);
  });

  test("reports completed chunks and closing without inferred elapsed time", () => {
    expect(
      tutorialReadout({
        completedChunks: 2,
        totalChunks: 6,
        phase: "active",
        playback: "playing",
      }),
    ).toBe("Tutorial 2/6 · Running");
    expect(
      tutorialReadout({
        completedChunks: 6,
        totalChunks: 6,
        phase: "closing",
        playback: "playing",
      }),
    ).toBe("Tutorial 6/6 · Running · Closing");
  });
});
