import { expect, test } from "bun:test";
import { type Points, type PointsMaterial, Scene, Vector3 } from "three";
import { StreamQueue } from "../../world/stream-queue";
import { connectFlightRoute } from "./flight-path/flight-connection";
import {
  createFlightEntry,
  prependFlightEntry,
} from "./flight-path/flight-entry";
import { createFlightRoute } from "./flight-path/flight-route";
import { createStartModule } from "./start.module";
import type { PlacedRoute } from "./start-contract";
import { START_EXERCISES, START_SETTINGS } from "./start-exercises";

// Test-owned presentation keeps this fixture independent of external level recipes.
const PRESENTATION = {
  particles: {
    streaming: {
      chunkLevel: 0 as const,
      viewDistanceMeters: 16,
      fadeStartMeters: 12,
    },
    density: { particlesPerChunk: 16 },
    appearance: {
      color: 0x899096,
      sizeMeters: 0.045,
      shape: "circle" as const,
    },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 0.45,
    },
  },
  guidance: {
    color: 0xf0bc50,
    opacity: 0.6,
    lengthMeters: 18,
    behindMeters: 4,
    verticalBendMeters: 0.75,
    widthMeters: 3,
    belowFlightMeters: 0.5,
  },
};

function createViewpoint() {
  return {
    worldPosition: new Vector3(),
    worldFlightDirection: new Vector3(0, 0, -1),
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(0, 0, -1),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 128,
  };
}

function createFixture(warmFrames = 125) {
  const scene = new Scene();
  const viewpoint = createViewpoint();
  const queue = new StreamQueue({ budgetMilliseconds: 5, capacity: 256 });
  const module = createStartModule({
    scene,
    viewpoint,
    parameters: PRESENTATION.particles,
    guidance: PRESENTATION.guidance,
    streamQueue: queue,
    constrainFlightPosition: () => {},
  });
  module.load();
  module.activate();
  const tick = () => {
    module.update?.(1 / 60);
    queue.update();
  };
  for (let frame = 0; frame < warmFrames; frame++) tick();
  return { scene, viewpoint, module, tick, queue };
}

function firstSection(fixture: ReturnType<typeof createFixture>): PlacedRoute {
  const display = fixture.scene.getObjectByName("StartFlightPath") as Points;
  const position = display.position.clone();
  position.y += START_SETTINGS.belowFlightMeters;
  const entry = {
    route: createFlightEntry(
      START_SETTINGS.entryLineMeters,
      fixture.viewpoint.worldFlightDirection,
    ),
    pose: { position, yawRadians: display.rotation.y },
  };
  const route = createFlightRoute(
    START_EXERCISES[0].route,
    START_SETTINGS.seed + 1,
  );
  return prependFlightEntry(entry, {
    route,
    pose: connectFlightRoute(entry, route),
  });
}

function flyRange(
  fixture: ReturnType<typeof createFixture>,
  section: PlacedRoute,
  range: [number, number],
): void {
  const up = new Vector3(0, 1, 0);
  for (let distance = range[0]; distance <= range[1] + 0.1; distance += 0.1) {
    section.route.sample(
      Math.min(distance, range[1]),
      fixture.viewpoint.worldPosition,
    );
    fixture.viewpoint.worldPosition
      .applyAxisAngle(up, section.pose.yawRadians)
      .add(section.pose.position);
    section.route.sampleDirection(
      distance,
      fixture.viewpoint.worldFlightDirection,
    );
    fixture.viewpoint.worldFlightDirection.applyAxisAngle(
      up,
      section.pose.yawRadians,
    );
    fixture.viewpoint.worldDirection.copy(
      fixture.viewpoint.worldFlightDirection,
    );
    fixture.tick();
  }
}

function trails(
  fixture: ReturnType<typeof createFixture>,
): Points<import("three").BufferGeometry, PointsMaterial>[] {
  return fixture.scene.children.filter(
    (child) => child.name === "StartFlightPath",
  ) as Points<import("three").BufferGeometry, PointsMaterial>[];
}

test("success prepares a joined successor while the original exit remains visible", () => {
  const fixture = createFixture();
  const section = firstSection(fixture);
  const first = trails(fixture)[1];
  flyRange(fixture, section, [0, section.route.exerciseEndMeters]);
  for (let frame = 0; frame < 40; frame++) fixture.tick();
  expect(trails(fixture)).toHaveLength(2);
  expect(first?.visible).toBe(true);
  flyRange(fixture, section, [
    section.route.exerciseEndMeters,
    section.route.lengthMeters,
  ]);
  for (let frame = 0; frame < 90; frame++) fixture.tick();
  expect(trails(fixture)).toHaveLength(2);
  expect(first?.visible).toBe(true);
  const next = trails(fixture).find((path) => path !== first);
  if (!next) throw new Error("Missing successor");
  expect(next.material.opacity).toBe(START_SETTINGS.pathOpacity);
  const nextRoute = createFlightRoute(
    START_EXERCISES[1].route,
    START_SETTINGS.seed + 2,
  );
  const nextPose = {
    position: next.position
      .clone()
      .add(new Vector3(0, START_SETTINGS.belowFlightMeters, 0)),
    yawRadians: next.rotation.y,
  };
  const end = new Vector3();
  section.route.sample(section.route.lengthMeters, end);
  end
    .applyAxisAngle(new Vector3(0, 1, 0), section.pose.yawRadians)
    .add(section.pose.position);
  expect(nextPose.position.distanceTo(end)).toBeLessThan(1e-8);
  flyRange(fixture, { route: nextRoute, pose: nextPose }, [
    0,
    START_SETTINGS.keepPathBehindMeters + 3,
  ]);
  for (let frame = 0; frame < 90; frame++) fixture.tick();
  expect(first?.visible).toBe(false);
  expect(trails(fixture)).toHaveLength(1);
  const positions = next?.geometry.getAttribute("position");
  expect(
    positions?.getX((next?.geometry.drawRange.count ?? 1) - 1),
  ).toBeGreaterThan(0);
  fixture.module.unload();
  expect(fixture.scene.children).toHaveLength(0);
});

test("recovery offers a fixed line ahead of flight even when gaze points elsewhere", () => {
  const fixture = createFixture();
  const original = new Set(trails(fixture));
  fixture.viewpoint.worldFlightDirection.set(1, 0, 0);
  let entry: Points | undefined;
  for (let step = 1; step <= 100 && !entry; step++) {
    fixture.viewpoint.worldPosition.set(step * 0.25, 0, 0);
    fixture.tick();
    entry = trails(fixture).find((path) => !original.has(path));
  }
  if (!entry) throw new Error("Missing recovery approach");
  expect(entry.position.x - fixture.viewpoint.worldPosition.x).toBeCloseTo(
    START_SETTINGS.recoveryLeadMeters,
  );
  expect(entry.position.z).toBeCloseTo(0);
  const anchor = entry.position.clone();
  const player = fixture.viewpoint.worldPosition.clone();
  fixture.viewpoint.worldDirection.set(0, 1, 0);
  for (let frame = 0; frame < 250; frame++) fixture.tick();
  expect(entry.position.equals(anchor)).toBe(true);
  expect(fixture.viewpoint.worldPosition.equals(player)).toBe(true);
  expect(trails(fixture)).toHaveLength(2);
  fixture.module.unload();
  fixture.queue.update();
  expect(fixture.scene.children).toHaveLength(0);
});

test("activation puts a particle line under the rig before any rings appear", () => {
  const fixture = createFixture(0);
  expect(trails(fixture)).toHaveLength(1);
  expect(
    fixture.scene.children.some(
      (child) => child.name === "StartParticleElements",
    ),
  ).toBe(false);
  const line = trails(fixture)[0];
  if (!line) throw new Error("Missing immediate entry");
  expect(line.position.x).toBe(0);
  expect(line.position.z).toBe(0);
  const positions = line.geometry.getAttribute("position");
  let behind = false,
    ahead = false,
    near = false;
  for (let index = 0; index < positions.count; index++) {
    behind ||= positions.getZ(index) > 1;
    ahead ||= positions.getZ(index) < -10;
    near ||= Math.abs(positions.getZ(index)) < 0.5;
  }
  expect(behind && ahead && near).toBe(true);
  fixture.module.unload();
});

test("unload cancels unfinished generation and cannot publish stale geometry", () => {
  const fixture = createFixture();
  fixture.module.deactivate();
  fixture.module.activate();
  fixture.module.unload();
  for (let frame = 0; frame < 40; frame++) fixture.queue.update();
  expect(fixture.scene.children).toHaveLength(0);
  expect(fixture.queue.size).toBe(0);
});

test("immediate flight keeps progress while route generation is delayed", () => {
  const fixture = createFixture(0);
  const section = firstSection(fixture);
  for (let frame = 0; frame < 100; frame++) {
    fixture.viewpoint.worldPosition.z -= 0.04;
    fixture.module.update?.(1 / 60);
  }
  flyRange(fixture, section, [4, section.route.exerciseEndMeters]);
  for (let frame = 0; frame < 90; frame++) fixture.tick();
  expect(trails(fixture)).toHaveLength(2);
  const successor = trails(fixture).at(-1);
  const end = new Vector3();
  section.route.sample(section.route.lengthMeters, end);
  end.add(section.pose.position);
  expect(successor?.position.x).toBeCloseTo(end.x);
  expect(successor?.position.z).toBeCloseTo(end.z);
  fixture.module.unload();
});
