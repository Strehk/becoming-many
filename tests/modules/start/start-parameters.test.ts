import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createFlightRoute } from "../../../src/modules/start/flight-path/flight-route";
import { placeElements } from "../../../src/modules/start/particle-elements/element-placement";
import type { ExerciseDefinition } from "../../../src/modules/start/start-contract";
import { START_EXERCISES } from "../../../src/modules/start/start-exercises";

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
      spacingMeters: 12,
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

test("compact course tightens spacing by fifteen percent and increases only later curvature", () => {
  const previous = [
    { spacing: 5.6, radii: [16.6041, 18.0944] },
    { spacing: 7, radii: [17.5102, 19.1758] },
    { spacing: 7, radii: [32.9774, 33.9289] },
    { spacing: 7, radii: [32.9774, 33.9289] },
  ];
  START_EXERCISES.forEach((exercise, index) => {
    const before = previous[index];
    if (!before) throw new Error("Missing comparison course");
    expect(exercise.elements.spacingMeters).toBeCloseTo(before.spacing * 0.85);
    [
      exercise.route.turnRadiusMeters.from,
      exercise.route.turnRadiusMeters.to,
    ].forEach((radius, end) => {
      const oldRadius = before.radii[end];
      if (!oldRadius) throw new Error("Missing comparison radius");
      const difference =
        ((exercise.elements.spacingMeters / radius -
          before.spacing / oldRadius) *
          180) /
        Math.PI;
      expect(difference).toBeCloseTo(index === 0 ? 0 : 4, 3);
    });
  });
  expect(
    START_EXERCISES[0].route.outroMeters +
      START_EXERCISES[1].route.straightMeters,
  ).toBe(13);
  expect(
    START_EXERCISES[1].route.outroMeters +
      START_EXERCISES[2].route.straightMeters,
  ).toBe(18);
  expect(
    START_EXERCISES[2].route.outroMeters +
      START_EXERCISES[3].route.straightMeters,
  ).toBe(18);
});
