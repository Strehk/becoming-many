/**
 * Purpose: Verify that the organ's generative figures are functions of the step.
 * Context: A seek must land on the note playing through would have reached,
 *   so the walk and the loop replay themselves rather than remember.
 * Responsibility: Cover determinism, replay after a seek, range, and salt.
 * Boundary: Which instrument sounds a degree belongs to the voice.
 */

import { describe, expect, test } from "bun:test";
import { stepRandom } from "../../src/sound/drone-organ/organ-random";
import {
  createDerivedSequence,
  createDerivedWalk,
} from "../../src/sound/drone-organ/voices/derived-sequences";

describe("stepRandom", () => {
  test("is stable for a step and spread across channels and salts", () => {
    expect(stepRandom(7, 1, 3)).toBe(stepRandom(7, 1, 3));
    expect(stepRandom(7, 1, 3)).not.toBe(stepRandom(7, 2, 3));
    expect(stepRandom(7, 1, 3)).not.toBe(stepRandom(7, 1, 4));
  });

  test("stays inside [0, 1)", () => {
    for (let step = 0; step < 1000; step += 1) {
      const value = stepRandom(step, step % 7, step % 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("createDerivedWalk", () => {
  test("answers the same degree for a step however it is reached", () => {
    const forward = createDerivedWalk(10, 1);
    const path = Array.from({ length: 50 }, (_unused, k) =>
      forward.degreeAt(k),
    );

    const sought = createDerivedWalk(10, 1);
    expect(sought.degreeAt(49)).toBe(path[49] ?? -1);
    expect(sought.degreeAt(3)).toBe(path[3] ?? -1);
    expect(sought.degreeAt(20)).toBe(path[20] ?? -1);
  });

  test("moves by small steps and stays inside the span", () => {
    const walk = createDerivedWalk(6, 2);
    let previous = walk.degreeAt(0);
    for (let step = 1; step < 200; step += 1) {
      const degree = walk.degreeAt(step);
      expect(Math.abs(degree - previous)).toBeLessThanOrEqual(2);
      expect(degree).toBeGreaterThanOrEqual(0);
      expect(degree).toBeLessThan(6);
      previous = degree;
    }
  });

  test("walks differently for a different salt", () => {
    const one = createDerivedWalk(10, 1);
    const two = createDerivedWalk(10, 2);
    const differs = Array.from({ length: 30 }, (_unused, k) => k).some(
      (k) => one.degreeAt(k) !== two.degreeAt(k),
    );
    expect(differs).toBe(true);
  });
});

describe("createDerivedSequence", () => {
  const settings = {
    span: 10,
    length: 8,
    density: 0.8,
    mutation: 0.5,
    salt: 4,
  };

  test("replays its mutations so a seek lands on the same loop", () => {
    const forward = createDerivedSequence(settings);
    const path = Array.from({ length: 200 }, (_unused, k) =>
      forward.degreeAt(k),
    );

    const sought = createDerivedSequence(settings);
    expect(sought.degreeAt(199)).toBe(path[199]);
    expect(sought.degreeAt(12)).toBe(path[12]);
    expect(sought.degreeAt(100)).toBe(path[100]);
  });

  test("repeats a turn unchanged when nothing mutates", () => {
    const sequence = createDerivedSequence({ ...settings, mutation: 0 });
    for (let step = 0; step < 8; step += 1) {
      expect(sequence.degreeAt(step + 8 * 5)).toBe(sequence.degreeAt(step));
    }
  });

  test("rewrites itself over many turns when it mutates", () => {
    const sequence = createDerivedSequence(settings);
    const first = Array.from({ length: 8 }, (_unused, k) =>
      sequence.degreeAt(k),
    );
    const later = Array.from({ length: 8 }, (_unused, k) =>
      sequence.degreeAt(k + 8 * 40),
    );
    expect(later).not.toEqual(first);
  });

  test("falls silent at negligible density", () => {
    const sequence = createDerivedSequence({ ...settings, density: 0 });
    for (let step = 0; step < 32; step += 1) {
      expect(sequence.degreeAt(step)).toBeUndefined();
    }
  });
});
