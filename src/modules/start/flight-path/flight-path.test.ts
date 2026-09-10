import { expect, test } from "bun:test";
import { type Points, PointsMaterial, Scene, Vector3 } from "three";
import { createFlightPath } from "./flight-path";
import { createFlightRoute } from "./flight-route";
import {
  createPathParticleGeometry,
  PATH_PARTICLE_SETTINGS,
} from "./path-particles";

function createExercise() {
  const scene = new Scene();
  const viewpoint = {
    worldPosition: new Vector3(10, 5, 20),
    worldFlightDirection: new Vector3(0, 0, -1),
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(1, 0, 0),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 128,
  };
  const material = new PointsMaterial();
  const module = createFlightPath({
    scene,
    viewpoint,
    createGeometry: () =>
      createPathParticleGeometry(createFlightRoute(), PATH_PARTICLE_SETTINGS),
    createMaterial: () => ({ pointsMaterial: material, update: () => {} }),
  });
  module.load();
  module.activate();
  return { scene, viewpoint, module, material };
}

test("exercise captures flight heading at its cue and stays fixed during travel", () => {
  const { scene, viewpoint, module } = createExercise();
  module.update?.(1);
  expect(scene.children).toHaveLength(0);
  viewpoint.worldFlightDirection.set(1, 0, 0);
  module.update?.(1);
  const cloud = scene.children[0] as Points;
  expect(cloud.rotation.y).toBeCloseTo(-Math.PI / 2);
  const anchor = cloud.position.clone();
  viewpoint.worldPosition.set(40, 10, 80);
  viewpoint.worldFlightDirection.set(0, 0, -1);
  module.update?.(1);
  expect(cloud.position.equals(anchor)).toBe(true);
  expect(cloud.rotation.y).toBeCloseTo(-Math.PI / 2);
  module.unload();
});

test("left route stays bounded and wind never uploads new geometry", () => {
  const { scene, module } = createExercise();
  module.update?.(2);
  const cloud = scene.children[0] as Points;
  const positions = cloud.geometry.getAttribute("position");
  const last = positions.count - 1;
  expect(positions.getX(0)).toBeGreaterThan(-1);
  expect(positions.getZ(0)).toBeCloseTo(-9, 0);
  expect(positions.getX(last)).toBeLessThan(-9);
  expect(positions.getZ(last)).toBeLessThan(-30);
  const before = Array.from(positions.array);
  for (let frame = 0; frame < 900; frame++) module.update?.(1 / 90);
  expect(Array.from(positions.array)).toEqual(before);
  expect(scene.children).toEqual([cloud]);
  module.unload();
});

test("exercise hides, reanchors on restart, and disposes once", () => {
  const { scene, viewpoint, module, material } = createExercise();
  module.update?.(2);
  const cloud = scene.children[0] as Points;
  let disposals = 0;
  cloud.geometry.addEventListener("dispose", () => disposals++);
  material.addEventListener("dispose", () => disposals++);
  module.deactivate();
  expect(cloud.visible).toBe(false);
  module.activate();
  viewpoint.worldPosition.set(30, 8, 50);
  module.update?.(2);
  expect(cloud.position.toArray()).toEqual([30, 7.5, 50]);
  expect(scene.children).toEqual([cloud]);
  module.unload();
  module.unload();
  expect(disposals).toBe(2);
  expect(scene.children).toHaveLength(0);
});
