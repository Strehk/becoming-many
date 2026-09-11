import { expect, test } from "bun:test";
import type { ExerciseFrame } from "../../../src/modules/start/start-contract";
import { createStartGame } from "../../../src/modules/start/start-game.runtime";

const FRAME: ExerciseFrame = {
  deltaSeconds: 0.1,
  progress: "pending",
  instructionReleased: true,
  instructionEnded: true,
  prepared: true,
  reachedEnd: false,
  deviated: false,
};

test("earned exercise keeps three quiet seconds before the next narration and rings", () => {
  const game = createStartGame({
    exerciseCount: 4,
    retireSeconds: 1,
    pauseAfterExerciseSeconds: 3,
  });
  game.update(FRAME);
  expect(
    game.update({ ...FRAME, progress: "passed", deltaSeconds: 0 }),
  ).toBeUndefined();
  expect(
    game.update({ ...FRAME, deltaSeconds: 2.9, deviated: true }),
  ).toBeUndefined();
  expect(game.update({ ...FRAME, deltaSeconds: 0.11 })).toBe("prepare-next");
});

test("deadline finishes an unpassed course once, without requiring the exit", () => {
  const game = createStartGame({ exerciseCount: 4, retireSeconds: 1 });
  game.update(FRAME);
  game.update({ ...FRAME, deviated: true });
  expect(game.finishExercises()).toBe("complete");
  expect(game.readState().phase).toBe("complete");
  expect(game.finishExercises()).toBeUndefined();
  expect(game.update(FRAME)).toBeUndefined();
});

test("deadline releases a missed final exit without restarting the closing recording", () => {
  const game = createStartGame({
    exerciseCount: 1,
    retireSeconds: 1,
    repeatSequence: false,
  });
  game.update(FRAME);
  expect(game.update({ ...FRAME, progress: "passed" })).toBe("complete");
  expect(game.finishExercises()).toBeUndefined();
  expect(game.readState().phase).toBe("complete");
});

test("success prepares the next section but does not retire or advance at the exercise end", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  expect(game.update({ ...FRAME, prepared: false })).toBeUndefined();
  expect(game.update(FRAME)).toBe("show");
  expect(
    game.update({ ...FRAME, progress: "passed", instructionEnded: false }),
  ).toBeUndefined();
  expect(game.update(FRAME)).toBe("prepare-next");
  expect(game.readState().phase).toBe("outro");
  expect(game.readState().exerciseIndex).toBe(0);
  expect(
    game.update({ ...FRAME, prepared: false, reachedEnd: true }),
  ).toBeUndefined();
  expect(game.update({ ...FRAME, reachedEnd: true })).toBe("advance");
  expect(game.readState().phase).toBe("flying");
  expect(game.readState().exerciseIndex).toBe(1);
});

test("deviation retries an unearned exercise with a new attempt", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  game.update(FRAME);
  expect(game.update({ ...FRAME, deviated: true })).toBe("recover");
  expect(game.readState().exerciseIndex).toBe(0);
  expect(game.readState().attempt).toBe(2);
  expect(game.readState().phase).toBe("recovering");
  game.update({ ...FRAME, deltaSeconds: 1 });
  expect(game.readState().phase).toBe("instruction");
});

test("deviation during the exit keeps earned success and prepares the next exercise", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  game.update(FRAME);
  game.update({ ...FRAME, progress: "passed" });
  expect(game.update({ ...FRAME, deviated: true })).toBe("recover");
  expect(game.readState().exerciseIndex).toBe(1);
});

test("the demonstration sequence loops and reset clears progression", () => {
  const game = createStartGame({ exerciseCount: 1, retireSeconds: 1 });
  game.update(FRAME);
  game.update({ ...FRAME, progress: "passed" });
  expect(game.update({ ...FRAME, reachedEnd: true })).toBe("advance");
  expect(game.readState().exerciseIndex).toBe(0);
  expect(game.readState().attempt).toBe(2);
  game.reset();
  expect(game.readState().phase).toBe("instruction");
  expect(game.readState().attempt).toBe(1);
});

test("checkpoint misses alone do not reset a visible nearby course", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  game.update(FRAME);
  expect(game.update({ ...FRAME, progress: "missed" })).toBeUndefined();
  expect(game.readState().phase).toBe("flying");
  expect(game.readState().attempt).toBe(1);
  expect(game.update({ ...FRAME, progress: "passed" })).toBe("prepare-next");
});

test("deviation while waiting for reveal reanchors instead of showing a stale route", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  expect(game.update({ ...FRAME, prepared: false, deviated: true })).toBe(
    "recover",
  );
  expect(game.readState().phase).toBe("recovering");
  expect(game.readState().attempt).toBe(2);
});

test("narrated sequence finishes once after four earned exercises", () => {
  const game = createStartGame({
    exerciseCount: 4,
    retireSeconds: 1,
    repeatSequence: false,
  });
  game.update(FRAME);
  for (let index = 0; index < 3; index++) {
    expect(game.update({ ...FRAME, progress: "passed" })).toBe("prepare-next");
    expect(
      game.update({ ...FRAME, reachedEnd: true, instructionReleased: false }),
    ).toBeUndefined();
    expect(game.update({ ...FRAME, reachedEnd: true })).toBe("advance");
  }
  expect(
    game.update({ ...FRAME, progress: "passed", instructionEnded: false }),
  ).toBeUndefined();
  expect(game.update(FRAME)).toBe("complete");
  expect(game.update(FRAME)).toBeUndefined();
  expect(game.update({ ...FRAME, reachedEnd: true })).toBe("finish");
  expect(
    game.update({ ...FRAME, reachedEnd: true, deviated: true }),
  ).toBeUndefined();
  expect(game.readState().exerciseIndex).toBe(3);
});

test("earned passage survives deviation while the spoken tail finishes", () => {
  const game = createStartGame({
    exerciseCount: 4,
    retireSeconds: 1,
    repeatSequence: false,
  });
  game.update(FRAME);
  game.update({ ...FRAME, progress: "passed", instructionEnded: false });
  expect(
    game.update({ ...FRAME, deviated: true, instructionEnded: false }),
  ).toBeUndefined();
  expect(game.update({ ...FRAME, deviated: true })).toBe("prepare-next");
});
