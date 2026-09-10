import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { type Mesh, Scene, Vector3 } from "three";
import { level } from "../../src/levels/start.level";
import { createFlightGuidance } from "../../src/modules/start/flight-guidance";
import { createStartModule } from "../../src/modules/start/start.module";
import { StreamQueue } from "../../src/world/stream-queue";

const guidance = level.flightGuidance;
const particles = level.airParticles;
assert(guidance && particles);

function createViewpoint() {
  return {
    worldPosition: new Vector3(10, 5, 20),
    worldFlightPosition: new Vector3(10, 5, 20),
    worldFlightDirection: new Vector3(1, 0, 0),
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(0, 1, 0),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 16,
  };
}

test("guidance follows travel and rig position independently of gaze", () => {
  const scene = new Scene();
  const viewpoint = createViewpoint();
  const module = createFlightGuidance({
    scene,
    viewpoint,
    parameters: guidance,
  });
  module.load();
  module.activate();
  const mesh = scene.children[0] as Mesh;
  expect(
    new Vector3(0, 0, -1)
      .applyQuaternion(mesh.quaternion)
      .distanceTo(new Vector3(1, 0, 0)),
  ).toBeLessThan(1e-10);
  expect(mesh.position.toArray()).toEqual([10, 4.5, 20]);
  viewpoint.worldDirection.set(-1, 0, 0);
  viewpoint.worldFlightDirection.set(0, 0.6, -0.8);
  module.update?.(1 / 90);
  expect(
    new Vector3(0, 0, -1)
      .applyQuaternion(mesh.quaternion)
      .distanceTo(new Vector3(0, 0.6, -0.8)),
  ).toBeLessThan(1e-10);
  module.unload();
});

test("guidance reuses resources and disposes each loaded lifetime once", () => {
  const scene = new Scene();
  const module = createFlightGuidance({
    scene,
    viewpoint: createViewpoint(),
    parameters: guidance,
  });
  module.load();
  module.load();
  const mesh = scene.children[0] as Mesh;
  const geometry = mesh.geometry;
  let disposals = 0;
  mesh.geometry.addEventListener("dispose", () => disposals++);
  expect(mesh.visible).toBe(false);
  module.activate();
  for (let frame = 0; frame < 900; frame++) module.update?.(1 / 90);
  expect(scene.children).toEqual([mesh]);
  expect(mesh.geometry).toBe(geometry);
  module.deactivate();
  expect(mesh.visible).toBe(false);
  module.unload();
  module.unload();
  expect(disposals).toBe(1);
  expect(scene.children).toHaveLength(0);
  module.load();
  expect(scene.children[0]).not.toBe(mesh);
  module.unload();
});

test("Start owns particles and guidance through activation and restart", () => {
  const scene = new Scene();
  const module = createStartModule({
    scene,
    viewpoint: createViewpoint(),
    streamQueue: new StreamQueue({ budgetMilliseconds: 1, capacity: 256 }),
    parameters: particles,
    guidance: guidance,
  });
  module.load();
  expect(scene.children).toHaveLength(2);
  module.activate();
  module.update?.(1 / 90);
  expect(scene.children.every((child) => child.visible)).toBe(true);
  module.deactivate();
  expect(scene.children.every((child) => !child.visible)).toBe(true);
  module.unload();
  expect(scene.children).toHaveLength(0);
  module.load();
  module.activate();
  expect(scene.children).toHaveLength(2);
  module.unload();
});
