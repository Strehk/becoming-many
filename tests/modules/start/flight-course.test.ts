import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { connectFlightRoute } from "../../../src/modules/start/flight-path/flight-connection";
import { createFlightCourse } from "../../../src/modules/start/flight-path/flight-course";
import { createFlightEntry } from "../../../src/modules/start/flight-path/flight-entry";
import { createFlightRoute } from "../../../src/modules/start/flight-path/flight-route";
import type { PlacedRoute } from "../../../src/modules/start/start-contract";
import { START_EXERCISES } from "../../../src/modules/start/start-exercises";

function sampleWorld(section: PlacedRoute, distance: number) {
  const position = new Vector3();
  const direction = new Vector3();
  section.route.sample(distance, position);
  section.route.sampleDirection(distance, direction);
  const up = new Vector3(0, 1, 0);
  return {
    position: position
      .applyAxisAngle(up, section.pose.yawRadians)
      .add(section.pose.position),
    direction: direction.applyAxisAngle(up, section.pose.yawRadians),
  };
}
function entry(): PlacedRoute {
  return {
    route: createFlightEntry(20, new Vector3(0, 0.2, -1)),
    pose: { position: new Vector3(10, 20, 30), yawRadians: 0.7 },
  };
}
test("a course appends every exercise at the previous endpoint and tangent", () => {
  const course = createFlightCourse(connectFlightRoute);
  let previous = entry();
  course.begin(previous);
  for (let index = 0; index < 20; index++) {
    const exercise = START_EXERCISES[index % START_EXERCISES.length];
    if (!exercise) throw new Error("Missing exercise");
    const next = course.append(createFlightRoute(exercise.route, index));
    const end = sampleWorld(previous, previous.route.lengthMeters);
    const start = sampleWorld(next, 0);
    expect(start.position.distanceTo(end.position)).toBeLessThan(1e-8);
    expect(start.direction.distanceTo(end.direction)).toBeLessThan(1e-8);
    previous = next;
  }
});
test("only a new course entry may replace the placement origin", () => {
  const course = createFlightCourse(connectFlightRoute);
  const route = createFlightRoute(START_EXERCISES[0].route, 1);
  expect(() => course.append(route)).toThrow();
  course.begin(entry());
  course.append(route);
  course.clear();
  expect(() => course.append(route)).toThrow();
  const replacement = entry();
  course.begin(replacement);
  const next = course.append(route);
  expect(
    sampleWorld(next, 0).position.distanceTo(
      sampleWorld(replacement, replacement.route.lengthMeters).position,
    ),
  ).toBeLessThan(1e-8);
});
