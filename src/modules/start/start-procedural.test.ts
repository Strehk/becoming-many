import { expect, test } from "bun:test";
import { type Points, Scene, Vector3 } from "three";
import { StreamQueue } from "../../world/stream-queue";
import { createFlightRoute } from "./flight-path/flight-route";
import { createStartModule } from "./start.module";
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
  const module = createStartModule({
    scene,
    viewpoint,
    parameters: PRESENTATION.particles,
    guidance: PRESENTATION.guidance,
    streamQueue: new StreamQueue({ budgetMilliseconds: 1, capacity: 256 }),
    constrainFlightPosition: () => {},
  });
  module.load();
  module.activate();
  const tick = () => module.update?.(1 / 60);
  for (let frame = 0; frame < 125; frame++) tick();
  return { scene, viewpoint, module, tick };
}

function flyApproach(
  fixture: ReturnType<typeof createFixture>,
  leadMeters: number,
): void {
  for (let distance = 0; distance < leadMeters; distance += 0.1) {
    fixture.viewpoint.worldPosition.set(0, 0, -distance);
    fixture.tick();
  }
}

function flyFirstRoute(fixture: ReturnType<typeof createFixture>): void {
  const route = createFlightRoute(
    START_EXERCISES[0].route,
    START_SETTINGS.seed + 1,
  );
  const { viewpoint, tick } = fixture;
  flyApproach(fixture, START_EXERCISES[0].route.leadMeters);
  const previous = new Vector3();
  for (
    let distance = 0;
    distance <= route.lengthMeters + 0.1;
    distance += 0.1
  ) {
    previous.copy(viewpoint.worldPosition);
    route.sample(
      Math.min(distance, route.lengthMeters),
      viewpoint.worldPosition,
    );
    viewpoint.worldFlightDirection
      .subVectors(viewpoint.worldPosition, previous)
      .normalize();
    tick();
  }
}

test("the integrated center advances left to right and reuses one display slot", () => {
  const fixture = createFixture();
  const first = fixture.scene.getObjectByName("StartFlightPath") as Points;
  expect(first).toBeDefined();
  const geometry = first.geometry;
  const material = first.material;
  let disposed = 0;
  geometry.addEventListener("dispose", () => disposed++);
  flyFirstRoute(fixture);
  for (let frame = 0; frame < 200; frame++) fixture.tick();
  const next = fixture.scene.getObjectByName("StartFlightPath") as Points;
  expect(next).toBe(first);
  expect(next.material).toBe(material);
  expect(next.geometry).not.toBe(geometry);
  expect(disposed).toBe(1);
  const positions = next.geometry.getAttribute("position");
  expect(positions.getX(positions.count - 1)).toBeGreaterThan(0);
  fixture.module.unload();
  expect(fixture.scene.children).toHaveLength(0);
});

test("the integrated center repeats left after a miss without retaining the old trail", () => {
  const fixture = createFixture();
  const first = fixture.scene.getObjectByName("StartFlightPath") as Points;
  const geometry = first.geometry;
  for (let step = 1; step <= 70; step++) {
    fixture.viewpoint.worldPosition.set(step * 0.25, 0, 0);
    fixture.tick();
  }
  for (let frame = 0; frame < 210; frame++) fixture.tick();
  const retry = fixture.scene.getObjectByName("StartFlightPath") as Points;
  expect(retry.geometry).not.toBe(geometry);
  const positions = retry.geometry.getAttribute("position");
  expect(positions.getX(positions.count - 1)).toBeLessThan(0);
  expect(retry.position.x).toBeCloseTo(17.5);
  fixture.module.unload();
});
