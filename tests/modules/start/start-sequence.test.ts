import { expect, test } from "bun:test";
import { START_EXERCISES } from "../../../src/modules/start/start-exercises";
import { sampleWorldPresence } from "../../../src/modules/start/start-sequence";

test("opening stays white until the spoken room cue and reveals smoothly over 3.2 seconds", () => {
  const sequence = START_EXERCISES[0].sequence;
  expect(sampleWorldPresence(sequence, 0)).toBe(0);
  expect(sampleWorldPresence(sequence, 13.12)).toBe(0);
  expect(sampleWorldPresence(sequence, 14.72)).toBeCloseTo(0.5);
  expect(sampleWorldPresence(sequence, 16.32)).toBe(1);
  expect(sampleWorldPresence(sequence, 19.3)).toBe(1);
  expect(sampleWorldPresence(sequence, 14.72)).toBeCloseTo(0.5);
});

test("later sequences preserve the world and invalid fade parameters are rejected", () => {
  expect(sampleWorldPresence(START_EXERCISES[1].sequence, 0)).toBe(1);
  expect(() =>
    sampleWorldPresence(
      { approachMeters: 18, worldReveal: { atSeconds: 0, fadeSeconds: 0 } },
      0,
    ),
  ).toThrow();
});
