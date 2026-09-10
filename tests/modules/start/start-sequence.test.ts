import { expect, test } from "bun:test";
import { START_EXERCISES } from "../../../src/modules/start/start-exercises";
import {
  samplePathPresence,
  sampleWorldPresence,
} from "../../../src/modules/start/start-sequence";

test("the blue path fades in after Anfang while the room particles stay absent", () => {
  const sequence = START_EXERCISES[0].sequence;
  expect(samplePathPresence(sequence, 0)).toBe(0);
  expect(samplePathPresence(sequence, 6.38)).toBe(0);
  expect(samplePathPresence(sequence, 7.98)).toBeCloseTo(0.5);
  expect(samplePathPresence(sequence, 9.58)).toBeCloseTo(1);
  expect(sampleWorldPresence(sequence, 9.58)).toBe(0);
});

test("room particles reveal smoothly at Raum independently of the completed path fade", () => {
  const sequence = START_EXERCISES[0].sequence;
  expect(sampleWorldPresence(sequence, 13.36)).toBe(0);
  expect(sampleWorldPresence(sequence, 14.96)).toBeCloseTo(0.5);
  expect(sampleWorldPresence(sequence, 16.56)).toBeCloseTo(1);
  expect(samplePathPresence(sequence, 13.36)).toBe(1);
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
