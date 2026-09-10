import { expect, test } from "bun:test";
import { Vector3 } from "three";
import type { ExerciseOutcome } from "../start-contract";
import { START_EXERCISES } from "../start-exercises";
import { createFlightProgress } from "./flight-progress";
import { createFlightRoute } from "./flight-route";

const POSE = { position: new Vector3(), yawRadians: 0 };

for (const exercise of START_EXERCISES) {
  test(`ordered flight through ${exercise.id} passes the exercise`, () => {
    const route = createFlightRoute(exercise.route, 18);
    const progress = createFlightProgress(route, POSE, exercise.progress);
    let outcome: ExerciseOutcome = "pending";
    const position = new Vector3();
    for (
      let distance = 0;
      distance <= exercise.route.leadMeters;
      distance += 0.25
    ) {
      outcome = progress.update(position.set(0, 0, -distance));
    }
    for (
      let distance = 0;
      distance <= route.lengthMeters + 0.25;
      distance += 0.25
    ) {
      route.sample(Math.min(distance, route.lengthMeters), position);
      outcome = progress.update(position);
    }
    expect(outcome).toBe("passed");
  });
}

test("waiting cannot miss, but sustained travel in the wrong direction does", () => {
  const exercise = START_EXERCISES[0];
  const route = createFlightRoute(exercise.route, 18);
  const progress = createFlightProgress(route, POSE, exercise.progress);
  for (let frame = 0; frame < 900; frame++)
    expect(progress.update(POSE.position)).toBe("pending");
  let outcome: ExerciseOutcome = "pending";
  for (let x = 0; x <= 20; x += 0.5)
    outcome = progress.update(new Vector3(x, 0, 0));
  expect(outcome).toBe("missed");
});

test("teleporting to the exit cannot award progress", () => {
  const exercise = START_EXERCISES[0];
  const route = createFlightRoute(exercise.route, 18);
  const progress = createFlightProgress(route, POSE, exercise.progress);
  const exit = new Vector3();
  route.sample(route.lengthMeters, exit);
  expect(progress.update(exit)).toBe("pending");
  expect(progress.update(exit)).toBe("pending");
});

test("a straight shortcut cannot substitute for following the curve", () => {
  const exercise = START_EXERCISES[0];
  const route = createFlightRoute(exercise.route, 18);
  const progress = createFlightProgress(route, POSE, exercise.progress);
  const exit = new Vector3();
  route.sample(route.lengthMeters, exit);
  const position = new Vector3();
  let outcome: ExerciseOutcome = "pending";
  for (let step = 0; step <= 120; step++)
    outcome = progress.update(position.copy(exit).multiplyScalar(step / 100));
  expect(outcome).toBe("missed");
});

test("seeded routes reproduce geometry and mirror left/right consistently", () => {
  const left = createFlightRoute(START_EXERCISES[0].route, 18);
  const again = createFlightRoute(START_EXERCISES[0].route, 18);
  const right = createFlightRoute(START_EXERCISES[1].route, 18);
  const changed = createFlightRoute(START_EXERCISES[0].route, 19);
  const a = new Vector3(),
    b = new Vector3();
  left.sample(left.lengthMeters, a);
  right.sample(right.lengthMeters, b);
  expect(a.x).toBeCloseTo(-b.x);
  expect(a.z).toBeCloseTo(b.z);
  expect(again.lengthMeters).toBe(left.lengthMeters);
  expect(changed.lengthMeters).not.toBe(left.lengthMeters);
});
