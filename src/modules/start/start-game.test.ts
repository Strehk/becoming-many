import { expect, test } from "bun:test";
import type { ExerciseFrame } from "./start-contract";
import { createStartGame } from "./start-game.runtime";

const FRAME: ExerciseFrame = {
  deltaSeconds: 0.1,
  progress: "pending",
  instructionReleased: true,
  instructionEnded: true,
};

// Engine decisions do not depend on graphics, movement sampling, or an audio player.
test("instruction release and natural end independently gate advancement", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  expect(game.update({ ...FRAME, instructionReleased: false })).toBeUndefined();
  expect(game.readState().phase).toBe("instruction");
  expect(game.update(FRAME)).toBe("show");
  expect(
    game.update({ ...FRAME, progress: "passed", instructionEnded: false }),
  ).toBeUndefined();
  expect(game.readState().phase).toBe("flying");
  expect(game.update(FRAME)).toBe("retire");
  game.update({ ...FRAME, deltaSeconds: 1 });
  expect(game.readState().exerciseIndex).toBe(1);
  expect(game.readState().phase).toBe("instruction");
});

test("a miss repeats the exercise with a fresh attempt identity", () => {
  const game = createStartGame({ exerciseCount: 2, retireSeconds: 1 });
  game.update(FRAME);
  expect(game.update({ ...FRAME, progress: "missed" })).toBe("retire");
  game.update({ ...FRAME, deltaSeconds: 1 });
  expect(game.readState().exerciseIndex).toBe(0);
  expect(game.readState().attempt).toBe(2);
  expect(game.readState().outcome).toBe("pending");
});

test("the final success completes once and reset returns to the first instruction", () => {
  const game = createStartGame({ exerciseCount: 1, retireSeconds: 1 });
  game.update(FRAME);
  game.update({ ...FRAME, progress: "passed" });
  game.update({ ...FRAME, deltaSeconds: 1 });
  expect(game.readState().phase).toBe("complete");
  expect(game.update(FRAME)).toBeUndefined();
  game.reset();
  expect(game.readState().phase).toBe("instruction");
  expect(game.readState().attempt).toBe(1);
});
