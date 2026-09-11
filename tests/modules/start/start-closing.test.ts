import { expect, test } from "bun:test";
import { sampleClosingPresence } from "../../../src/modules/start/start-closing";
import { START_TIMING } from "../../../src/modules/start/start-exercises";

test("course disappears before the room, followed by a white hold", () => {
  const sample = (seconds: number) =>
    sampleClosingPresence(seconds, START_TIMING);
  expect(sample(0)).toEqual({ course: 1, world: 1, ready: false });
  expect(sample(1.5)).toEqual({ course: 0.5, world: 1, ready: false });
  expect(sample(3)).toEqual({ course: 0, world: 1, ready: false });
  expect(sample(4.5)).toEqual({ course: 0, world: 0.5, ready: false });
  expect(sample(6)).toEqual({ course: 0, world: 0, ready: false });
  expect(sample(7.99).ready).toBe(false);
  expect(sample(8)).toEqual({ course: 0, world: 0, ready: true });
  expect(sample(20)).toEqual(sample(8));
});
