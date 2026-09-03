/**
 * Purpose: Verify the animal passage lookup and the piece's authored crossings.
 * Context: A passage is derived from show time so a seek lands inside its route.
 * Responsibility: Cover the progress lookup, the schedule guard, and the piece data.
 * Boundary: Route sampling and the flight itself belong to the module's own tests.
 */

import { describe, expect, test } from "bun:test";
import {
  type PassageSchedule,
  passageProgressAt,
  validatePassageSchedule,
} from "../../src/dramaturgy/passage-schedule";
import {
  PIECE_PASSAGES,
  PIECE_SCHEDULE,
} from "../../src/dramaturgy/piece-schedule";
import { SENSE_FADE_SECONDS } from "../../src/dramaturgy/show-levels";

const SCHEDULE: PassageSchedule = {
  passages: [
    { passageId: "bat", atSeconds: 100, durationSeconds: 10 },
    { passageId: "bird", atSeconds: 200, durationSeconds: 20 },
  ],
};

describe("passageProgressAt", () => {
  test("answers nothing before a passage enters", () => {
    expect(passageProgressAt(SCHEDULE, "bat", 0)).toBeUndefined();
    expect(passageProgressAt(SCHEDULE, "bat", 99.99)).toBeUndefined();
  });

  test("starts at zero and climbs across the crossing", () => {
    expect(passageProgressAt(SCHEDULE, "bat", 100)).toBe(0);
    expect(passageProgressAt(SCHEDULE, "bat", 102.5)).toBeCloseTo(0.25, 10);
    expect(passageProgressAt(SCHEDULE, "bat", 105)).toBeCloseTo(0.5, 10);
    expect(passageProgressAt(SCHEDULE, "bat", 109.99)).toBeCloseTo(0.999, 10);
  });

  test("is away at its end rather than held at one", () => {
    expect(passageProgressAt(SCHEDULE, "bat", 110)).toBeUndefined();
    expect(passageProgressAt(SCHEDULE, "bat", 500)).toBeUndefined();
  });

  test("answers nothing for a passage the schedule does not carry", () => {
    expect(passageProgressAt(SCHEDULE, "mosquitoes", 105)).toBeUndefined();
  });

  test("keeps each passage to its own window", () => {
    expect(passageProgressAt(SCHEDULE, "bird", 105)).toBeUndefined();
    expect(passageProgressAt(SCHEDULE, "bat", 205)).toBeUndefined();
    expect(passageProgressAt(SCHEDULE, "bird", 210)).toBeCloseTo(0.5, 10);
  });

  /*
   * The point of deriving progress rather than triggering: seeking to an
   * instant answers exactly what playing through to it would have.
   */
  test("lands a seek where playing through would have", () => {
    for (const time of [100, 101.37, 104, 107.5, 109.5]) {
      expect(passageProgressAt(SCHEDULE, "bat", time)).toBeCloseTo(
        (time - 100) / 10,
        10,
      );
    }
  });
});

describe("validatePassageSchedule", () => {
  test("accepts ordered, separated passages", () => {
    expect(() => validatePassageSchedule(SCHEDULE)).not.toThrow();
  });

  test("rejects a passage with no duration", () => {
    expect(() =>
      validatePassageSchedule({
        passages: [{ passageId: "bat", atSeconds: 10, durationSeconds: 0 }],
      }),
    ).toThrow(RangeError);
  });

  test("rejects two animals crossing at once", () => {
    expect(() =>
      validatePassageSchedule({
        passages: [
          { passageId: "bat", atSeconds: 10, durationSeconds: 10 },
          { passageId: "bird", atSeconds: 15, durationSeconds: 10 },
        ],
      }),
    ).toThrow(RangeError);
  });
});

describe("the piece's passages", () => {
  test("are a valid schedule", () => {
    expect(() => validatePassageSchedule(PIECE_PASSAGES)).not.toThrow();
  });

  /*
   * The mosquitoes before Motion Perception are the third authored animal and
   * are deliberately absent until Motion Sense can stage a swarm on a route;
   * this pins the gap so filling it is a deliberate edit.
   */
  test("carry the animals that are staged today", () => {
    expect(PIECE_PASSAGES.passages.map(({ passageId }) => passageId)).toEqual([
      "bat",
      "bird",
    ]);
  });

  /*
   * Each animal announces its sense: it must be flying while the previous
   * world still stands, and away once the new sense has finished fading in.
   */
  test("cross the boundary of the cue they announce", () => {
    const cueAt = (cueId: string): number => {
      const cue = PIECE_SCHEDULE.narration.find(
        (entry) => entry.cueId === cueId,
      );
      if (!cue) throw new Error(`The piece has no "${cueId}" cue`);
      return cue.atSeconds;
    };
    const announced: Record<string, string> = {
      bat: "echo",
      mosquitoes: "motion",
      bird: "magnetic",
    };

    for (const passage of PIECE_PASSAGES.passages) {
      const boundary = cueAt(announced[passage.passageId] ?? "");
      const end = passage.atSeconds + passage.durationSeconds;

      expect(passage.atSeconds).toBeLessThan(boundary);
      expect(end).toBeGreaterThan(boundary + SENSE_FADE_SECONDS);
    }
  });

  test("finish inside the show", () => {
    for (const passage of PIECE_PASSAGES.passages) {
      expect(passage.atSeconds + passage.durationSeconds).toBeLessThanOrEqual(
        PIECE_SCHEDULE.durationSeconds,
      );
    }
  });
});
