import { expect, test } from "bun:test";
import {
  BufferGeometry,
  Float32BufferAttribute,
  type Points,
  PointsMaterial,
  Scene,
  Vector3,
} from "three";
import { createFlightPath } from "../../../../src/modules/start/flight-path/flight-path";

function createDisplay() {
  const scene = new Scene();
  const material = new PointsMaterial();
  const module = createFlightPath({
    scene,
    belowFlightMeters: 0.5,
    createMaterial: () => ({ pointsMaterial: material, update: () => {} }),
  });
  module.load();
  module.activate();
  return { scene, module, material };
}

function createGrowingDisplay() {
  let renderedFront = 0;
  const module = createFlightPath({
    scene: new Scene(),
    belowFlightMeters: 0.5,
    growth: { speedMetersPerSecond: 12, softEdgeMeters: 3 },
    createMaterial: () => ({
      pointsMaterial: new PointsMaterial(),
      update: () => {},
      setRevealMeters: (front) => {
        renderedFront = front;
      },
    }),
  });
  module.load();
  const geometry = () =>
    new BufferGeometry().setAttribute(
      "routeDistance",
      new Float32BufferAttribute([0, 10], 1),
    );
  return { module, geometry, readFront: () => renderedFront };
}

test("a joined trail inherits the seam feather without advancing the ring clock", () => {
  const previous = createGrowingDisplay();
  const next = createGrowingDisplay();
  const pose = { position: new Vector3(), yawRadians: 0 };
  previous.module.show(previous.geometry(), pose);
  previous.module.update(2);
  next.module.show(next.geometry(), pose, {
    incomingMeters: previous.module.readContinuationMeters(),
  });
  expect(next.readFront()).toBe(previous.readFront() - 10);
  expect(next.readFront()).toBe(3);
  expect(next.module.readRevealMeters()).toBe(-3);
  next.module.update(0.1);
  expect(next.readFront()).toBeCloseTo(4.2);
  expect(next.module.readRevealMeters()).toBeCloseTo(-1.8);
  next.module.show(next.geometry(), pose);
  expect(next.readFront()).toBe(0);
  previous.module.unload();
  next.module.unload();
});

test("presentation waits for an explicit show and copies its fixed pose", () => {
  const { scene, module } = createDisplay();
  module.update(30);
  expect(scene.children).toHaveLength(0);
  const position = new Vector3(10, 5, 20);
  module.show(new BufferGeometry(), { position, yawRadians: 1 });
  const cloud = scene.children[0] as Points;
  position.set(40, 10, 80);
  module.update(1);
  expect(cloud.position.toArray()).toEqual([10, 4.5, 20]);
  expect(cloud.rotation.y).toBe(1);
  module.unload();
});

test("retirement fades without changing geometry and detaches the trail", () => {
  const { scene, module, material } = createDisplay();
  const geometry = new BufferGeometry();
  module.show(geometry, { position: new Vector3(), yawRadians: 0 });
  module.retire(1);
  module.update(0.5);
  expect(material.opacity).toBeCloseTo(0.5);
  expect((scene.children[0] as Points).geometry).toBe(geometry);
  module.update(0.5);
  expect(scene.children).toHaveLength(0);
  module.unload();
});

test("replacement reuses one material and disposes both geometries once", () => {
  const { scene, module, material } = createDisplay();
  let disposals = 0;
  material.addEventListener("dispose", () => disposals++);
  for (let attempt = 0; attempt < 2; attempt++) {
    const geometry = new BufferGeometry();
    geometry.addEventListener("dispose", () => disposals++);
    module.show(geometry, {
      position: new Vector3(attempt, 0, 0),
      yawRadians: 0,
    });
    expect(scene.children).toHaveLength(1);
  }
  module.unload();
  module.unload();
  expect(disposals).toBe(3);
  expect(scene.children).toHaveLength(0);
});
