/**
 * Purpose: Verify how present the closing credits are across the show.
 * Context: Their visibility is derived from show time, never held as state.
 * Responsibility: Cover the ramp, the hold, a restart, and a creditless schedule.
 * Boundary: Drawing and placing the panel belong to the credits module.
 */

import { describe, expect, test } from "bun:test";
import {
  END_CREDITS,
  END_CREDITS_FADE_SECONDS,
  endCreditsPresenceAt,
} from "../../src/dramaturgy/end-credits";
import type { NarrationSchedule } from "../../src/dramaturgy/narration-schedule";

const CREDITS_AT_SECONDS = 100;

const SCHEDULE: NarrationSchedule = {
  durationSeconds: 120,
  creditsAtSeconds: CREDITS_AT_SECONDS,
  narration: [{ cueId: "prologue", atSeconds: 0, level: "white-world" }],
};

const WITHOUT_CREDITS: NarrationSchedule = {
  durationSeconds: 120,
  narration: SCHEDULE.narration,
};

describe("the closing credits", () => {
  test("are absent at the top of the show", () => {
    expect(endCreditsPresenceAt(SCHEDULE, 0)).toBe(0);
  });

  test("stay absent until their authored time", () => {
    expect(endCreditsPresenceAt(SCHEDULE, CREDITS_AT_SECONDS - 0.1)).toBe(0);
    expect(endCreditsPresenceAt(SCHEDULE, CREDITS_AT_SECONDS)).toBe(0);
  });

  test("ramp across the fade", () => {
    const halfway = CREDITS_AT_SECONDS + END_CREDITS_FADE_SECONDS / 2;

    expect(endCreditsPresenceAt(SCHEDULE, halfway)).toBeCloseTo(0.5, 10);
  });

  test("are complete when the fade ends", () => {
    const complete = CREDITS_AT_SECONDS + END_CREDITS_FADE_SECONDS;

    expect(endCreditsPresenceAt(SCHEDULE, complete)).toBe(1);
  });

  // The clock clamps at the show length and stays there, so holding at one
  // past the fade is what keeps the panel up until staff restart.
  test("hold to the end of the show", () => {
    expect(endCreditsPresenceAt(SCHEDULE, SCHEDULE.durationSeconds)).toBe(1);
  });

  test("are put away again by a seek back to zero", () => {
    expect(endCreditsPresenceAt(SCHEDULE, SCHEDULE.durationSeconds)).toBe(1);
    expect(endCreditsPresenceAt(SCHEDULE, 0)).toBe(0);
  });

  test("never appear in a schedule that authors no credits time", () => {
    expect(endCreditsPresenceAt(WITHOUT_CREDITS, 0)).toBe(0);
    expect(
      endCreditsPresenceAt(WITHOUT_CREDITS, WITHOUT_CREDITS.durationSeconds),
    ).toBe(0);
  });

  test("open on the title and name everyone exactly once", () => {
    const titles = END_CREDITS.lines.filter((line) => line.role === "title");
    const texts = END_CREDITS.lines.map((line) => line.text);

    expect(END_CREDITS.lines[0]?.role).toBe("title");
    expect(titles).toHaveLength(1);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
