import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createFlightRoute } from "../../../src/modules/start/flight-path/flight-route";
import { placeElements } from "../../../src/modules/start/particle-elements/element-placement";
import { START_EXERCISES } from "../../../src/modules/start/start-exercises";

for (const exercise of START_EXERCISES) {
  test(`${exercise.id}: every seed turns 90 degrees and places exactly six spaced rings`, () => {
    for (let seed = 0; seed < 20; seed++) {
      const route = createFlightRoute(exercise.route, seed);
      const direction = new Vector3();
      route.sampleDirection(route.lengthMeters, direction);
      expect(direction.x).toBeCloseTo(exercise.route.turnSign);
      expect(direction.z).toBeCloseTo(0);
      const rings = placeElements(route, exercise.elements);
      expect(rings).toHaveLength(6);
      for (const [index, ring] of rings.entries())
        expect(ring.routeDistanceMeters).toBeCloseTo(
          exercise.route.straightMeters + index * 10,
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
  expect(direction.x).toBeCloseTo(-Math.SQRT1_2);
  expect(direction.z).toBeCloseTo(-Math.SQRT1_2);
});
