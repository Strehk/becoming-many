import { expect, test } from "bun:test";
import {
  BufferGeometry,
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
