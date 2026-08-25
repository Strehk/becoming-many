/**
 * Purpose: Verify bounded and cooperative procedural stream scheduling.
 * Context: Loaded modules share one frame-time budget in the world runtime.
 * Responsibility: Cover capacity, replacement, cancellation, fairness, and deadlines.
 * Boundary: Chunk coordinates and module-specific work remain outside this test.
 */

import { describe, expect, test } from "bun:test";
import { StreamQueue } from "../../src/world/stream-queue";

describe("StreamQueue", () => {
  test("rejects new keys after reaching its fixed capacity", () => {
    const queue = createQueue(2);

    expect(queue.enqueue(completedJob({}))).toBe(true);
    expect(queue.enqueue(completedJob({}))).toBe(true);
    expect(queue.enqueue(completedJob({}))).toBe(false);
    expect(queue.size).toBe(2);
  });

  test("replaces pending work that targets the same resource slot", () => {
    const queue = createQueue(2);
    const key = {};
    let result = "none";

    queue.enqueue(completedJob(key, () => (result = "old")));
    queue.enqueue(completedJob(key, () => (result = "new")));
    queue.update();

    expect(result).toBe("new");
    expect(queue.size).toBe(0);
  });

  test("drops obsolete work before it runs", () => {
    const queue = createQueue(2);
    let ran = false;

    queue.enqueue({
      key: {},
      isCurrent: () => false,
      runStep: () => {
        ran = true;
        return true;
      },
    });
    queue.update();

    expect(ran).toBe(false);
    expect(queue.size).toBe(0);
  });

  test("returns unfinished jobs to the next frame", () => {
    const queue = createQueue(2);
    let steps = 0;

    queue.enqueue({
      key: {},
      isCurrent: () => true,
      runStep: () => {
        steps += 1;
        return steps === 2;
      },
    });

    queue.update();
    expect(steps).toBe(1);
    expect(queue.size).toBe(1);

    queue.update();
    expect(steps).toBe(2);
    expect(queue.size).toBe(0);
  });

  test("finishes foundational jobs before dependent content", () => {
    const queue = createQueue(2);
    const completed: string[] = [];
    let surfaceSteps = 0;

    queue.enqueue({
      key: {},
      priority: 0,
      isCurrent: () => true,
      runStep: () => {
        surfaceSteps += 1;
        if (surfaceSteps < 2) return false;
        completed.push("surface");
        return true;
      },
    });
    queue.enqueue(completedJob({}, () => completed.push("content")));

    queue.update();
    queue.update();
    expect(completed).toEqual(["surface"]);

    queue.update();
    expect(completed).toEqual(["surface", "content"]);
  });

  test("starts no additional work after the frame deadline", () => {
    let time = 0;
    const queue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 2 },
      () => time,
    );
    let completedJobs = 0;

    queue.enqueue(
      completedJob({}, () => {
        completedJobs += 1;
        time = 1;
      }),
    );
    queue.enqueue(completedJob({}, () => (completedJobs += 1)));
    queue.update();

    expect(completedJobs).toBe(1);
    expect(queue.size).toBe(1);
  });
});

function createQueue(capacity: number): StreamQueue {
  return new StreamQueue({ budgetMilliseconds: 1, capacity }, () => 0);
}

function completedJob(
  key: object,
  effect: () => void = () => {},
): {
  readonly key: object;
  readonly isCurrent: () => boolean;
  readonly runStep: () => boolean;
} {
  return {
    key,
    isCurrent: () => true,
    runStep: () => {
      effect();
      return true;
    },
  };
}
