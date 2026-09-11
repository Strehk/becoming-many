import { expect, test } from "bun:test";
import { StartTiming } from "../../../src/modules/start/start-timing";

test("loading is excluded; the deadline survives recording changes and recovery", () => {
  const timing = new StartTiming({
    maximumExerciseSeconds: 90,
    voiceSafetySeconds: 0.75,
  });
  timing.update(120, 0);
  expect(timing.expired()).toBe(false);
  timing.update(30, 0.1);
  timing.update(59, 0);
  expect(timing.expired()).toBe(false);
  expect(timing.canPlay(2)).toBe(false);
  timing.update(1, 1);
  expect(timing.expired()).toBe(true);
  timing.reset();
  expect(timing.expired()).toBe(false);
  expect(timing.canPlay(20.8)).toBe(true);
});

test("only whole recordings fitting before the deadline may begin", () => {
  const timing = new StartTiming({
    maximumExerciseSeconds: 90,
    voiceSafetySeconds: 0.75,
  });
  timing.update(85, 1);
  expect(timing.canPlay(4)).toBe(true);
  expect(timing.canPlay(4.5)).toBe(false);
  timing.update(-100, 0);
  timing.update(Number.NaN, 0);
  expect(timing.canPlay(4.5)).toBe(false);
});
