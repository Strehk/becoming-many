/**
 * Purpose: Verify the grid the organ's rhythmic voices step on.
 * Context: Steps are a pure function of show time; the sequencer only decides
 *   which of them fall inside the window ahead of the playhead.
 * Responsibility: Cover the window, a hold, both directions of seek, a stall,
 *   and a regrid.
 * Boundary: What a step plays, and its audio time, belong to the caller.
 */

import { describe, expect, test } from "bun:test";
import { createStepSequencer } from "../../src/sound/drone-organ/step-sequencer";

const LOOKAHEAD = 0.15;

function collect(
  sequencer: ReturnType<typeof createStepSequencer>,
  showTimeSeconds: number,
): number[] {
  const fired: number[] = [];
  sequencer.advance(showTimeSeconds, LOOKAHEAD, (index) => fired.push(index));
  return fired;
}

describe("createStepSequencer", () => {
  test("fires each step exactly once across consecutive frames", () => {
    const sequencer = createStepSequencer(0.1);
    const fired: number[] = [];
    for (let frame = 0; frame <= 100; frame += 1) {
      fired.push(...collect(sequencer, frame * 0.011));
    }
    expect(fired).toEqual(Array.from({ length: 13 }, (_unused, k) => k));
  });

  test("starts from the playhead rather than replaying from zero", () => {
    const sequencer = createStepSequencer(1);
    expect(collect(sequencer, 10.5)).toEqual([]);
    expect(collect(sequencer, 10.9)).toEqual([11]);
  });

  test("reports the step's own show time", () => {
    const sequencer = createStepSequencer(0.5);
    const times: number[] = [];
    sequencer.advance(0.9, LOOKAHEAD, (_index, time) => times.push(time));
    expect(times).toEqual([1]);
  });

  test("fires nothing while the playhead holds still", () => {
    const sequencer = createStepSequencer(0.05);
    collect(sequencer, 3);
    expect(collect(sequencer, 3)).toEqual([]);
    expect(collect(sequencer, 3)).toEqual([]);
  });

  test("starts fresh after a seek backward", () => {
    const sequencer = createStepSequencer(1);
    collect(sequencer, 9.95);
    expect(collect(sequencer, 1.95)).toEqual([2]);
  });

  test("skips the steps a stall or forward seek jumped over", () => {
    const sequencer = createStepSequencer(0.1);
    collect(sequencer, 0);
    expect(collect(sequencer, 5.05)).toEqual([51]);
  });

  test("regrids from the next uncovered instant", () => {
    const sequencer = createStepSequencer(1);
    collect(sequencer, 0.9);
    sequencer.setStepSeconds(0.25);
    expect(collect(sequencer, 1.2)).toEqual([5]);
  });

  test("forgets its window on reset", () => {
    const sequencer = createStepSequencer(1);
    collect(sequencer, 0.9);
    sequencer.reset();
    expect(collect(sequencer, 0.9)).toEqual([1]);
  });
});
