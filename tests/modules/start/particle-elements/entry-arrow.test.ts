import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createFlightRoute } from "../../../../src/modules/start/flight-path/flight-route";
import { placeElements } from "../../../../src/modules/start/particle-elements/element-placement";
import { placeEntryArrow } from "../../../../src/modules/start/particle-elements/entry-arrow";
import { START_EXERCISES } from "../../../../src/modules/start/start-exercises";

test("the signpost is off the route and aims exactly at the first right-hand gate", () => {
  const exercise = START_EXERCISES[0];
  for (let seed = 0; seed < 20; seed++) {
    const route = createFlightRoute(exercise.route, seed);
    const rings = placeElements(route, exercise.elements);
    const arrow = placeEntryArrow(route, rings, exercise.elements.entryArrow);
    const gate = rings[0];
    if (!arrow || !gate) throw new Error("Missing opening guidance");
    expect(gate.position.x).toBeGreaterThan(13);
    expect(arrow.position.y).toBeCloseTo(1.8);
    expect(
      arrow.direction.dot(
        gate.position.clone().sub(arrow.position).normalize(),
      ),
    ).toBeCloseTo(1);
    const center = new Vector3();
    route.sample(exercise.elements.entryArrow.distanceMeters, center);
    expect(arrow.position.distanceTo(center)).toBeGreaterThan(5);
  }
});
