import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { level } from "../../../src/levels/start.level";
import { createFlightRoute } from "../../../src/modules/start/flight-path/flight-route";
import { placeElements } from "../../../src/modules/start/particle-elements/element-placement";
import type { ExerciseDefinition } from "../../../src/modules/start/start-contract";
import {
  START_EXERCISES,
  START_TIMING,
} from "../../../src/modules/start/start-exercises";

const FLIGHT_SPEED = level.flightSpeedMetersPerSecond;
if (FLIGHT_SPEED === undefined)
  throw new Error("Tutorial pacing requires explicit flight speed");

for (const exercise of START_EXERCISES as readonly ExerciseDefinition[]) {
  test(`${exercise.id}: every seed follows the authored direction and places the authored number of spaced rings`, () => {
    for (let seed = 0; seed < 20; seed++) {
      const route = createFlightRoute(exercise.route, seed);
      const direction = new Vector3();
      route.sampleDirection(route.lengthMeters, direction);
      const vertical = exercise.route.turnPlane === "vertical";
      expect(direction.x).toBeCloseTo(
        vertical
          ? 0
          : exercise.route.turnSign *
              Math.sin((exercise.route.turnDegrees.from * Math.PI) / 180),
      );
      expect(direction.y).toBeCloseTo(0);
      expect(direction.z).toBeCloseTo(
        vertical
          ? -1
          : -Math.cos((exercise.route.turnDegrees.from * Math.PI) / 180),
      );
      const rings = placeElements(route, exercise.elements);
      expect(rings).toHaveLength(exercise.elements.ringCount);
      for (const [index, ring] of rings.entries())
        expect(ring.routeDistanceMeters).toBeCloseTo(
          Math.max(
            exercise.elements.firstMeters,
            exercise.route.straightMeters,
          ) +
            index * exercise.elements.spacingMeters,
        );
    }
  });
}

test("authored count and spacing are exact, incompatible combinations fail explicitly", () => {
  const exercise = START_EXERCISES[0];
  const route = createFlightRoute(exercise.route, 1);
  expect(
    placeElements(route, {
      ...exercise.elements,
      ringCount: 3,
      firstMeters: route.exerciseStartMeters,
      spacingMeters: 5,
    }),
  ).toHaveLength(3);
  expect(
    placeElements(route, { ...exercise.elements, ringCount: 0 }),
  ).toHaveLength(0);
  expect(() =>
    placeElements(route, { ...exercise.elements, ringCount: 12 }),
  ).toThrow("exercise length");
  expect(() =>
    placeElements(route, { ...exercise.elements, ringCount: 2.5 }),
  ).toThrow("integer");
});

test("rotation is authored in degrees without changing route logic", () => {
  const route = createFlightRoute(
    { ...START_EXERCISES[0].route, turnDegrees: { from: 45, to: 45 } },
    1,
  );
  const direction = new Vector3();
  route.sampleDirection(route.lengthMeters, direction);
  expect(direction.x).toBeCloseTo(Math.SQRT1_2);
  expect(direction.z).toBeCloseTo(-Math.SQRT1_2);
});

test("vertical lessons stay forward, respect pitch and finish level with correct altitude", () => {
  for (const exercise of START_EXERCISES.slice(2)) {
    const route = createFlightRoute(exercise.route, 17);
    const position = new Vector3();
    const ahead = new Vector3();
    const direction = new Vector3();
    for (let distance = 0; distance < route.lengthMeters; distance += 0.5) {
      route.sample(distance, position);
      route.sample(distance + 0.001, ahead);
      route.sampleDirection(distance, direction);
      expect(
        ahead.sub(position).normalize().distanceTo(direction),
      ).toBeLessThan(0.0001);
      expect(direction.z).toBeLessThanOrEqual(
        -Math.cos((exercise.route.turnDegrees.to * Math.PI) / 180) + 1e-8,
      );
      expect(Math.abs(direction.y)).toBeLessThanOrEqual(
        Math.sin((exercise.route.turnDegrees.to * Math.PI) / 180) + 1e-8,
      );
    }
    route.sample(route.lengthMeters, position);
    expect(Math.sign(position.y)).toBe(exercise.route.turnSign);
    route.sampleDirection(route.lengthMeters, direction);
    expect(direction.y).toBeCloseTo(0);
  }
});

test("direct flight stays near its pacing target while retaining all four lessons", () => {
  // Use the actual level speed; the opening line captures the rig at its cue.
  for (let seed = 0; seed < 20; seed++) {
    const meters = START_EXERCISES.reduce<number>(
      (total, exercise) =>
        total + createFlightRoute(exercise.route, seed).lengthMeters,
      START_EXERCISES[0].sequence.approachMeters,
    );
    const seconds =
      START_EXERCISES[0].sequence.pathAtSeconds + meters / FLIGHT_SPEED;
    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThan(85);
  }
  expect(START_TIMING.maximumExerciseSeconds).toBeGreaterThan(70);
});

test("every exit leaves enough flight time for the next instruction cue", () => {
  for (let index = 0; index < START_EXERCISES.length - 1; index++) {
    const current = START_EXERCISES[index];
    const next = START_EXERCISES[index + 1];
    if (!current || !next) throw new Error("Missing lesson");
    expect(
      current.route.outroMeters / FLIGHT_SPEED -
        START_TIMING.pauseAfterExerciseSeconds,
    ).toBeGreaterThan(next.voice.instructionAtSeconds);
  }
});
