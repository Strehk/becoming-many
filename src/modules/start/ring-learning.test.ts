/** Verify generous ring passage and immediate lesson handoff without renderer or hardware.
 * These tests cover Start-owned decisions; installation flight acceptance remains physical.
 */
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createRingPassage } from "./particle-elements/ring-passage";
import type { ExerciseFrame } from "./start-contract";
import { START_EXERCISES, START_SETTINGS } from "./start-exercises";
import { createStartGame } from "./start-game.runtime";

const FRAME: ExerciseFrame = {
  deltaSeconds: 0.1,
  progress: "pending",
  reachedEnd: false,
  deviated: false,
  prepared: true,
  instructionReleased: true,
  instructionEnded: false,
};

function ringPassage() {
  const settings = START_SETTINGS.elementPassage;
  const passage = createRingPassage(
    settings.maximumStepMeters,
    settings.paddingMeters,
  );
  const rings = [0, 4.2, 8.4].map((z, elementIndex) => ({
    elementIndex,
    center: new Vector3(0, -START_SETTINGS.belowFlightMeters, z),
    direction: new Vector3(0, 0, 1),
    radiusMeters:
      START_EXERCISES[0].elements.ringRadiusMeters -
      START_SETTINGS.elementVolume.coreRadiusMeters,
  }));
  return { passage, rings };
}

for (const offset of [0, 3.6, 5.9, 6]) {
  test(`first two rings accept ${offset} m offset without the third ring`, () => {
    const { passage, rings } = ringPassage();
    passage.reset(rings, new Vector3(offset, -0.5, -1));
    expect(passage.update(new Vector3(offset, -0.5, 1))).toEqual([0]);
    expect(passage.readPassed(2)).toBe(false);
    passage.update(new Vector3(offset, -0.5, 3));
    expect(passage.update(new Vector3(offset, -0.5, 5))).toEqual([1]);
    expect(passage.readPassed(2)).toBe(true);
    passage.reset(rings, new Vector3());
    expect(passage.readPassed(2)).toBe(false);
  });
}

test("outside, backward and discontinuous crossings do not earn rings", () => {
  const { passage, rings } = ringPassage();
  for (const [start, end] of [
    [new Vector3(6.1, -0.5, -1), new Vector3(6.1, -0.5, 1)],
    [new Vector3(0, -0.5, 1), new Vector3(0, -0.5, -1)],
    [new Vector3(0, -0.5, -4), new Vector3(0, -0.5, 1)],
  ] as const) {
    passage.reset(rings, start);
    expect(passage.update(end)).toEqual([]);
    expect(passage.readPassed(1)).toBe(false);
  }
});

test("rings two and three cannot substitute for the first ring", () => {
  const { passage, rings } = ringPassage();
  passage.reset(rings, new Vector3(0, -0.5, 3));
  for (const z of [5, 7, 9]) passage.update(new Vector3(0, -0.5, z));
  expect(passage.readPassed(2)).toBe(false);
});

test("success starts the successor before speech end and before the route exit", () => {
  const game = createStartGame({ exerciseCount: 4, retireSeconds: 2.5 });
  expect(game.update(FRAME)).toBe("show");
  expect(game.update({ ...FRAME, progress: "passed" })).toBe("prepare-next");
  expect(game.readProgress().completedChunks).toBe(1);
  expect(game.update({ ...FRAME, prepared: false })).toBeUndefined();
  expect(game.update({ ...FRAME, instructionReleased: false })).toBeUndefined();
  expect(game.update(FRAME)).toBe("advance");
  expect(game.readState().exerciseIndex).toBe(1);
  expect(game.readProgress().completedChunks).toBe(1);
});

test("final ring goal starts closing once without requiring the third ring", () => {
  const game = createStartGame({
    exerciseCount: 1,
    retireSeconds: 2.5,
    repeatSequence: false,
  });
  game.update(FRAME);
  expect(game.update({ ...FRAME, progress: "passed" })).toBe("complete");
  expect(game.update({ ...FRAME, reachedEnd: true })).toBe("finish");
  expect(game.update({ ...FRAME, reachedEnd: true })).toBeUndefined();
});
