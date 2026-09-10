import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { connectFlightRoute } from "../../../../src/modules/start/flight-path/flight-connection";
import { createFlightDeviation } from "../../../../src/modules/start/flight-path/flight-deviation";
import {
  createFlightEntry,
  prependFlightEntry,
} from "../../../../src/modules/start/flight-path/flight-entry";
import { placeFlightRecovery } from "../../../../src/modules/start/flight-path/flight-recovery";
import { createFlightRoute } from "../../../../src/modules/start/flight-path/flight-route";
import { createParticleGeneration } from "../../../../src/modules/start/flight-path/particle-generation";
import { createPathParticleGeometry } from "../../../../src/modules/start/flight-path/path-particles";
import { placeElements } from "../../../../src/modules/start/particle-elements/element-placement";
import { START_EXERCISES } from "../../../../src/modules/start/start-exercises";

const pose = { position: new Vector3(10, 4, 20), yawRadians: 0.7 };
const route = createFlightRoute(START_EXERCISES[0].route, 18);

test("section boundaries preserve position and tangent into the successor", () => {
  const end = new Vector3(),
    direction = new Vector3(),
    up = new Vector3(0, 1, 0);
  route.sample(route.lengthMeters, end);
  end.applyAxisAngle(up, pose.yawRadians).add(pose.position);
  route.sampleDirection(route.lengthMeters, direction);
  direction.applyAxisAngle(up, pose.yawRadians);
  const next = connectFlightRoute({ route, pose }, route);
  expect(next.position.distanceTo(end)).toBeLessThan(1e-8);
  const forward = new Vector3(0, 0, -1).applyAxisAngle(up, next.yawRadians);
  expect(forward.distanceTo(direction)).toBeLessThan(1e-8);
  expect(route.exerciseEndMeters - route.exerciseStartMeters).toBeGreaterThan(
    0,
  );
  expect(route.lengthMeters - route.exerciseEndMeters).toBeCloseTo(
    START_EXERCISES[0].route.outroMeters,
  );
});

test("only sustained travel outside the corridor requests recovery", () => {
  const origin = new Vector3();
  const deviation = createFlightDeviation(
    { route, pose: { position: origin, yawRadians: 0 } },
    origin,
    START_EXERCISES[0].deviation,
  );
  const view = {
    worldPosition: origin,
    worldDirection: new Vector3(1, 0, 0),
    worldFlightDirection: new Vector3(1, 0, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 128,
  };
  for (let frame = 0; frame < 300; frame++)
    expect(deviation.update(origin, view)).toBe(false);
  for (let x = 0; x <= 5; x += 0.5)
    expect(
      deviation.update(new Vector3(x, 0, 0), {
        ...view,
        worldPosition: new Vector3(x, 0, 0),
      }),
    ).toBe(false);
  let outside = false;
  for (let x = 5.5; x <= 25; x += 0.5)
    outside = deviation.update(new Vector3(x, 0, 0), {
      ...view,
      worldPosition: new Vector3(x, 0, 0),
    });
  expect(outside).toBe(true);
});

test("recovery follows travel rather than gaze without moving the rig", () => {
  const viewpoint = {
    worldPosition: new Vector3(8, 2, 4),
    worldFlightDirection: new Vector3(0, 0, -1),
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(1, 0, 0),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 128,
  };
  const recovery = placeFlightRecovery(viewpoint, 12, () => {});
  expect(recovery.position.toArray()).toEqual([8, 2, -8]);
  expect(Math.abs(recovery.yawRadians)).toBe(0);
  expect(viewpoint.worldPosition.toArray()).toEqual([8, 2, 4]);
});

test("particle generation advances in bounded slices and transfers ownership once", () => {
  let slices = 0;
  const parameters = START_EXERCISES[0].particles;
  const job = createParticleGeneration({
    route,
    maximumDensity: parameters.densityPerMeter.to,
    metersPerStep: 4,
    createSlice: (slice) => {
      slices++;
      expect(slice.lengthMeters).toBeLessThanOrEqual(4);
      return createPathParticleGeometry(slice, parameters);
    },
  });
  expect(job.step()).toBe(false);
  expect(slices).toBe(1);
  expect(() => job.takeGeometry()).toThrow();
  for (let frame = 0; frame < 50 && !job.isReady(); frame++) job.step();
  const geometry = job.takeGeometry();
  expect(geometry.drawRange.count).toBeGreaterThan(0);
  expect(() => job.takeGeometry()).toThrow();
  let disposed = 0;
  geometry.addEventListener("dispose", () => disposed++);
  job.dispose();
  expect(disposed).toBe(0);
  geometry.dispose();
  expect(disposed).toBe(1);
});

for (const pitch of [-0.6, 0, 0.6]) {
  test(`approach preserves travel pitch ${pitch} and joins a level exercise smoothly`, () => {
    const travel = new Vector3(0, pitch, -1).normalize();
    const entry = { route: createFlightEntry(20, travel), pose };
    const next = { route, pose: connectFlightRoute(entry, route) };
    const combined = prependFlightEntry(entry, next);
    const before = new Vector3(),
      after = new Vector3();
    entry.route.sampleDirection(0, before);
    expect(before.distanceTo(travel)).toBeLessThan(1e-8);
    combined.route.sample(20 - 1e-5, before);
    combined.route.sample(20, after);
    expect(before.distanceTo(after)).toBeLessThan(0.0001);
    combined.route.sampleDirection(20 - 1e-5, before);
    combined.route.sampleDirection(20, after);
    expect(before.distanceTo(after)).toBeLessThan(0.0001);
  });
}

test("rings occupy only exercises, leaving a continuous ring-free transition", () => {
  for (const exercise of START_EXERCISES) {
    const section = createFlightRoute(exercise.route, 18);
    const rings = placeElements(section, exercise.elements);
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) {
      expect(ring.routeDistanceMeters).toBeGreaterThanOrEqual(
        section.exerciseStartMeters,
      );
      expect(ring.routeDistanceMeters).toBeLessThanOrEqual(
        section.exerciseEndMeters,
      );
    }
  }
});
