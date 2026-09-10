import { expect, test } from "bun:test";
import { type Points, type PointsMaterial, Scene, Vector3 } from "three";
import { createStartModule } from "../../../src/modules/start/start.module";
import { START_SETTINGS } from "../../../src/modules/start/start-exercises";
import { StreamQueue } from "../../../src/world/stream-queue";

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

// Allow the entry's full soft edge to reach the first section before testing flight.
const ENTRY_READY_FRAMES =
  Math.ceil(
    ((START_SETTINGS.entryLineMeters +
      START_SETTINGS.entryBehindMeters +
      START_SETTINGS.pathGrowth.softEdgeMeters) /
      START_SETTINGS.pathGrowth.speedMetersPerSecond) *
      60,
  ) + 2;

function createFixture(warmFrames = ENTRY_READY_FRAMES) {
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

function trails(
  fixture: ReturnType<typeof createFixture>,
): Points<import("three").BufferGeometry, PointsMaterial>[] {
  return fixture.scene.children.filter(
    (child) => child.name === "StartFlightPath",
  ) as Points<import("three").BufferGeometry, PointsMaterial>[];
}

function rings(fixture: ReturnType<typeof createFixture>): Points[] {
  return fixture.scene.children.filter(
    (child) => child.name === "StartParticleElements",
  ) as Points[];
}
function wait(fixture: ReturnType<typeof createFixture>, frames: number): void {
  for (let frame = 0; frame < frames; frame++) fixture.tick();
}
function leaveCourse(fixture: ReturnType<typeof createFixture>): void {
  const original = new Set(trails(fixture));
  fixture.viewpoint.worldFlightDirection.set(1, 0, 0);
  fixture.viewpoint.worldDirection.set(1, 0, 0);
  for (let step = 0; step < 160; step++) {
    fixture.viewpoint.worldPosition.x += 0.25;
    fixture.tick();
    if (trails(fixture).some((path) => !original.has(path))) return;
  }
  throw new Error("Expected a new course after sustained departure");
}

test("recovery fades the complete old course before revealing replacement rings", () => {
  const fixture = createFixture();
  const oldRingGeometry = rings(fixture)[0]?.geometry;
  const oldPath = trails(fixture)[1];
  leaveCourse(fixture);
  expect(rings(fixture)).toHaveLength(1);
  expect(oldPath?.visible).toBe(true);
  wait(fixture, 160);
  expect(rings(fixture)).toHaveLength(0);
  expect(oldPath?.visible).toBe(false);
  expect(trails(fixture)).toHaveLength(2);
  wait(fixture, 160);
  expect(rings(fixture)).toHaveLength(1);
  expect(rings(fixture)[0]?.geometry).not.toBe(oldRingGeometry);
  fixture.module.unload();
  expect(fixture.scene.children).toHaveLength(0);
});

test("continued straight flight releases abandoned rings without competing groups", () => {
  const fixture = createFixture();
  const originalGeometry = rings(fixture)[0]?.geometry;
  let replaced = false;
  for (let frame = 0; frame < 2500; frame++) {
    fixture.viewpoint.worldPosition.z -= 0.06;
    fixture.tick();
    expect(rings(fixture).length).toBeLessThanOrEqual(1);
    replaced ||= rings(fixture).some(
      (cloud) => cloud.geometry !== originalGeometry,
    );
  }
  expect(replaced).toBe(true);
  fixture.module.unload();
  fixture.queue.update();
  expect(fixture.scene.children).toHaveLength(0);
  expect(fixture.queue.size).toBe(0);
});
