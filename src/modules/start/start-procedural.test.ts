import { expect, test } from "bun:test";
import { type Points, Scene, Vector3 } from "three";
import { StreamQueue } from "../../world/stream-queue";
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

function createFixture() {
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
  for (let frame = 0; frame < 125; frame++) tick();
  return { scene, viewpoint, module, tick, queue };
}

function firstSection(fixture: ReturnType<typeof createFixture>): PlacedRoute {
  const display = fixture.scene.getObjectByName("StartFlightPath") as Points;
  const position = display.position.clone();
  position.y += START_SETTINGS.belowFlightMeters;
  return {
    route: createFlightRoute(START_EXERCISES[0].route, START_SETTINGS.seed + 1),
    pose: { position, yawRadians: display.rotation.y },
  };
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

function approach(
  fixture: ReturnType<typeof createFixture>,
  section: PlacedRoute,
): void {
  const start = fixture.viewpoint.worldPosition.clone();
  for (let fraction = 0; fraction <= 1; fraction += 0.01) {
    fixture.viewpoint.worldPosition.lerpVectors(
      start,
      section.pose.position,
      fraction,
    );
    fixture.tick();
  }
}

function trails(fixture: ReturnType<typeof createFixture>): Points[] {
  return fixture.scene.children.filter(
    (child) => child.name === "StartFlightPath",
  ) as Points[];
}

test("success prepares a joined successor while the original exit remains visible", () => {
  const fixture = createFixture();
  const section = firstSection(fixture);
  const first = trails(fixture)[0];
  approach(fixture, section);
  flyRange(fixture, section, [0, section.route.exerciseEndMeters]);
  for (let frame = 0; frame < 40; frame++) fixture.tick();
  expect(trails(fixture)).toHaveLength(2);
  expect(first?.visible).toBe(true);
  flyRange(fixture, section, [
    section.route.exerciseEndMeters,
    section.route.lengthMeters,
  ]);
  for (let frame = 0; frame < 90; frame++) fixture.tick();
  expect(trails(fixture)).toHaveLength(1);
  const next = trails(fixture)[0];
  expect(next).not.toBe(first);
  const positions = next?.geometry.getAttribute("position");
  expect(
    positions?.getX((next?.geometry.drawRange.count ?? 1) - 1),
  ).toBeGreaterThan(0);
  fixture.module.unload();
  expect(fixture.scene.children).toHaveLength(0);
});

test("recovery uses the latest gaze and flight position, without moving the player", () => {
  const fixture = createFixture();
  for (let step = 1; step <= 70; step++) {
    fixture.viewpoint.worldPosition.set(step * 0.25, 0, 0);
    fixture.tick();
  }
  fixture.viewpoint.worldDirection.set(1, 0, 0);
  for (let frame = 0; frame < 250; frame++) fixture.tick();
  expect(trails(fixture)).toHaveLength(1);
  const retry = trails(fixture)[0];
  expect(retry?.position.x).toBeCloseTo(17.5 + START_SETTINGS.entryLeadMeters);
  expect(fixture.viewpoint.worldPosition.toArray()).toEqual([17.5, 0, 0]);
  const positions = retry?.geometry.getAttribute("position");
  expect(
    positions?.getX((retry?.geometry.drawRange.count ?? 1) - 1),
  ).toBeLessThan(0);
  fixture.module.unload();
  fixture.queue.update();
  expect(fixture.scene.children).toHaveLength(0);
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
