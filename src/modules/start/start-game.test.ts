import { expect, test } from "bun:test";
import type { ExerciseFrame } from "./start-contract";
import { createStartGame } from "./start-game.runtime";

const FRAME: ExerciseFrame = {
  deltaSeconds: 0.1,
  progress: "pending",
  instructionReleased: true,
  instructionEnded: true,
  prepared: true,
  reachedEnd: false,
  deviated: false,
};

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
