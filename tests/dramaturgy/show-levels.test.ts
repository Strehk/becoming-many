/**
 * Purpose: Verify the world state and sense strengths derived from a schedule.
 * Context: Cues carry the level; senses fade in from each cue boundary.
 * Responsibility: Cover the level lookup, the fade ramp, and the piece's arc.
 * Boundary: How intensities reach modules is the Level Runtime's concern.
 */

import { describe, expect, test } from "bun:test";
import type {
  NarrationCue,
  NarrationSchedule,
} from "../../src/dramaturgy/narration-schedule";
import { PIECE_SCHEDULE } from "../../src/dramaturgy/piece-schedule";
import {
  levelTransitionAt,
  SENSE_FADE_SECONDS,
  SENSE_PREWARM_SECONDS,
  SHOW_LEVEL_STATES,
  senseIntensityAt,
  senseStandingAt,
  showLevelAt,
  showLevelStateAt,
  worldTimeOf,
} from "../../src/dramaturgy/show-levels";

const SCHEDULE: NarrationSchedule = {
  durationSeconds: 200,
  narration: [
    { cueId: "prologue", atSeconds: 10, level: "white-world" },
    { cueId: "scent", atSeconds: 50, level: "scent" },
    { cueId: "echo", atSeconds: 100, level: "echo" },
    { cueId: "return", atSeconds: 150, level: "white-world" },
  ],
};

describe("showLevelAt", () => {
  test("stands in the first cue's world before the first cue", () => {
    expect(showLevelAt(SCHEDULE, 0)).toBe("white-world");
    expect(showLevelAt(SCHEDULE, 9.99)).toBe("white-world");
  });

  test("holds a cue's world until the next cue starts", () => {
    expect(showLevelAt(SCHEDULE, 50)).toBe("scent");
    expect(showLevelAt(SCHEDULE, 99.99)).toBe("scent");
    expect(showLevelAt(SCHEDULE, 100)).toBe("echo");
  });

  test("holds the last cue's world to the end of the show", () => {
    expect(showLevelAt(SCHEDULE, 150)).toBe("white-world");
    expect(showLevelAt(SCHEDULE, 200)).toBe("white-world");
  });

  test("answers nothing for a schedule with no cues", () => {
    expect(showLevelAt({ durationSeconds: 10, narration: [] }, 0)).toBe(
      undefined,
    );
  });
});

describe("showLevelStateAt", () => {
  test("resolves the opening state from the schedule and authored state map", () => {
    const scentFirst: NarrationSchedule = {
      durationSeconds: 10,
      narration: [{ cueId: "scent", atSeconds: 5, level: "scent" }],
    };

    expect(showLevelStateAt(scentFirst, SHOW_LEVEL_STATES, 0)).toBe(
      SHOW_LEVEL_STATES.scent,
    );
  });

  test("answers nothing for a schedule with no opening state", () => {
    expect(
      showLevelStateAt(
        { durationSeconds: 10, narration: [] },
        SHOW_LEVEL_STATES,
        0,
      ),
    ).toBeUndefined();
  });
});

describe("senseIntensityAt", () => {
  test("keeps a sense silent before its level arrives", () => {
    expect(senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 0)).toBe(0);
    expect(senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 50)).toBe(0);
    expect(senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "echo", 99)).toBe(0);
  });

  test("ramps a sense in linearly from its cue boundary", () => {
    const halfway = 50 + SENSE_FADE_SECONDS / 2;

    expect(
      senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", halfway),
    ).toBeCloseTo(0.5, 5);
    expect(
      senseIntensityAt(
        SCHEDULE,
        SHOW_LEVEL_STATES,
        "scent",
        50 + SENSE_FADE_SECONDS,
      ),
    ).toBe(1);
  });

  test("carries a sense at full strength through later levels", () => {
    // Senses layer, never swap: echo keeps scent at one.
    expect(senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 120)).toBe(1);
  });

  test("fades every sense out when the world strips back", () => {
    const halfway = 150 + SENSE_FADE_SECONDS / 2;

    expect(
      senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", halfway),
    ).toBeCloseTo(0.5, 5);
    expect(
      senseIntensityAt(SCHEDULE, SHOW_LEVEL_STATES, "echo", halfway),
    ).toBeCloseTo(0.5, 5);
    expect(
      senseIntensityAt(
        SCHEDULE,
        SHOW_LEVEL_STATES,
        "echo",
        150 + SENSE_FADE_SECONDS,
      ),
    ).toBe(0);
  });

  test("continues an interrupted fade from where it stood", () => {
    // The next boundary lands halfway through the fade-in, and its level
    // still carries the sense, so the strength keeps climbing seamlessly.
    const interrupted: NarrationSchedule = {
      durationSeconds: 100,
      narration: [
        { cueId: "scent", atSeconds: 10, level: "scent" },
        {
          cueId: "echo",
          atSeconds: 10 + SENSE_FADE_SECONDS / 2,
          level: "echo",
        },
      ],
    };
    const boundary = 10 + SENSE_FADE_SECONDS / 2;

    expect(
      senseIntensityAt(interrupted, SHOW_LEVEL_STATES, "scent", boundary),
    ).toBeCloseTo(0.5, 5);
    expect(
      senseIntensityAt(
        interrupted,
        SHOW_LEVEL_STATES,
        "scent",
        boundary + SENSE_FADE_SECONDS,
      ),
    ).toBe(1);
  });

  test("reads sense presence from the supplied show states", () => {
    const states = {
      ...SHOW_LEVEL_STATES,
      scent: { ...SHOW_LEVEL_STATES.scent, senses: [] },
    };

    expect(
      senseIntensityAt(SCHEDULE, states, "scent", 50 + SENSE_FADE_SECONDS),
    ).toBe(0);
  });
});

describe("senseStandingAt", () => {
  test("keeps a sense away while its cue is beyond the prewarm window", () => {
    expect(senseStandingAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 0)).toBe(
      "away",
    );
    // The window reaches exactly to the boundary, where the ramp still stands
    // at zero — the same instant the sense itself is not yet live at its cue.
    expect(
      senseStandingAt(
        SCHEDULE,
        SHOW_LEVEL_STATES,
        "scent",
        50 - SENSE_PREWARM_SECONDS,
      ),
    ).toBe("away");
  });

  test("warms a sense through the prewarm window before its cue", () => {
    expect(
      senseStandingAt(
        SCHEDULE,
        SHOW_LEVEL_STATES,
        "scent",
        50 - SENSE_PREWARM_SECONDS + 0.01,
      ),
    ).toBe("warming");
    expect(senseStandingAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 49.99)).toBe(
      "warming",
    );
  });

  test("goes live the moment the sense carries strength", () => {
    expect(senseStandingAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 50.01)).toBe(
      "live",
    );
    expect(senseStandingAt(SCHEDULE, SHOW_LEVEL_STATES, "scent", 100)).toBe(
      "live",
    );
  });

  test("stays live through a fade out and leaves once it is over", () => {
    // The return strips the world back at 150; the fade runs from there.
    expect(
      senseStandingAt(
        SCHEDULE,
        SHOW_LEVEL_STATES,
        "scent",
        150 + SENSE_FADE_SECONDS - 0.01,
      ),
    ).toBe("live");
    expect(
      senseStandingAt(
        SCHEDULE,
        SHOW_LEVEL_STATES,
        "scent",
        150 + SENSE_FADE_SECONDS,
      ),
    ).toBe("away");
  });

  test("warms every sense of the piece inside the cue before it", () => {
    for (const cue of PIECE_SCHEDULE.narration) {
      for (const sense of SHOW_LEVEL_STATES[cue.level].senses) {
        // The one this cue introduces: absent from the level before it.
        if (
          senseIntensityAt(
            PIECE_SCHEDULE,
            SHOW_LEVEL_STATES,
            sense,
            cue.atSeconds,
          ) > 0
        )
          continue;

        expect(
          senseStandingAt(
            PIECE_SCHEDULE,
            SHOW_LEVEL_STATES,
            sense,
            cue.atSeconds - 0.01,
          ),
        ).toBe("warming");
      }
    }
  });
});

describe("a cue whose world leads its recording", () => {
  // The closing shape of the piece: the world is stripped back first and the
  // last words are spoken into it once it has finished changing.
  const LED: NarrationSchedule = {
    durationSeconds: 200,
    narration: [
      { cueId: "prologue", atSeconds: 10, level: "white-world" },
      { cueId: "scent", atSeconds: 50, level: "scent" },
      {
        cueId: "return",
        atSeconds: 150,
        level: "white-world",
        worldLeadSeconds: SENSE_FADE_SECONDS,
      },
    ],
  };

  test("reads the world at the led instant, not at the recording", () => {
    expect(worldTimeOf(LED.narration[2] as NarrationCue)).toBe(
      150 - SENSE_FADE_SECONDS,
    );
    expect(showLevelAt(LED, 150 - SENSE_FADE_SECONDS - 0.01)).toBe("scent");
    expect(showLevelAt(LED, 150 - SENSE_FADE_SECONDS)).toBe("white-world");
  });

  test("finishes the fade before the recording starts", () => {
    expect(
      senseIntensityAt(
        LED,
        SHOW_LEVEL_STATES,
        "scent",
        150 - SENSE_FADE_SECONDS,
      ),
    ).toBe(1);
    expect(senseIntensityAt(LED, SHOW_LEVEL_STATES, "scent", 150)).toBe(0);
  });

  test("crosses worlds from the led instant", () => {
    const crossing = levelTransitionAt(LED, 150 - SENSE_FADE_SECONDS / 2);

    expect(crossing?.from).toBe("scent");
    expect(crossing?.to).toBe("white-world");
    expect(crossing?.progress).toBeCloseTo(0.5, 5);
    expect(levelTransitionAt(LED, 150)?.progress).toBe(1);
  });

  test("leaves a cue without a lead reading at its own instant", () => {
    expect(worldTimeOf(LED.narration[1] as NarrationCue)).toBe(50);
  });
});

describe("the sense ladder", () => {
  test("defines complete presentation values for every show level", () => {
    for (const state of Object.values(SHOW_LEVEL_STATES)) {
      expect(state.viewDistance).toBeGreaterThan(0);
      expect(state.maximumGroundClearanceMeters).toBeGreaterThan(0);
      expect(Number.isInteger(state.backgroundColor)).toBe(true);
    }
  });

  test("layers senses without ever dropping an earlier one", () => {
    const ladder = Object.values(SHOW_LEVEL_STATES)
      .map(({ senses }) => senses)
      .sort((a, b) => a.length - b.length);

    for (let index = 1; index < ladder.length; index++) {
      const previous = ladder[index - 1] ?? [];
      const current = ladder[index] ?? [];
      expect(current.slice(0, previous.length)).toEqual([...previous]);
    }
  });
});

describe("the piece's world arc", () => {
  test("opens and closes in White World", () => {
    expect(showLevelAt(PIECE_SCHEDULE, 0)).toBe("white-world");
    expect(showLevelAt(PIECE_SCHEDULE, PIECE_SCHEDULE.durationSeconds)).toBe(
      "white-world",
    );
  });

  test("stands in the full synthesis for the finale", () => {
    const finale = PIECE_SCHEDULE.narration.find(
      (cue) => cue.cueId === "finale",
    );

    expect(finale?.level).toBe("connections");
    expect(showLevelAt(PIECE_SCHEDULE, finale?.atSeconds ?? 0)).toBe(
      "connections",
    );
  });

  test("climbs the ladder one sense per cue", () => {
    const climbed = PIECE_SCHEDULE.narration.map(
      (cue) => SHOW_LEVEL_STATES[cue.level].senses.length,
    );

    expect(climbed).toEqual([0, 1, 2, 3, 4, 5, 6, 0]);
  });
});

describe("levelTransitionAt", () => {
  test("stands still in the first world before the first cue", () => {
    const transition = levelTransitionAt(SCHEDULE, 0);

    expect(transition?.from).toBe("white-world");
    expect(transition?.to).toBe("white-world");
  });

  test("crosses between worlds over the fade window", () => {
    const halfway = levelTransitionAt(SCHEDULE, 50 + SENSE_FADE_SECONDS / 2);

    expect(halfway).toEqual({
      from: "white-world",
      to: "scent",
      progress: 0.5,
    });
  });

  test("rests in the new world once the window has passed", () => {
    const settled = levelTransitionAt(SCHEDULE, 50 + SENSE_FADE_SECONDS);

    expect(settled?.to).toBe("scent");
    expect(settled?.progress).toBe(1);
  });

  test("crosses back toward White World on the return", () => {
    const returning = levelTransitionAt(SCHEDULE, 150 + 1);

    expect(returning?.from).toBe("echo");
    expect(returning?.to).toBe("white-world");
    expect(returning?.progress).toBeCloseTo(1 / SENSE_FADE_SECONDS, 5);
  });

  test("answers nothing for a schedule with no cues", () => {
    expect(levelTransitionAt({ durationSeconds: 10, narration: [] }, 0)).toBe(
      undefined,
    );
  });
});
