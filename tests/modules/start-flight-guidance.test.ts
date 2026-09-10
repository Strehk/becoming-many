import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { type Mesh, Scene, Vector3 } from "three";
import { keepFlightWithinHeightLimits } from "../../src/control/flight-pose";
import { level } from "../../src/levels/start.level";
import { createFlightGuidance } from "../../src/modules/start/flight-guidance";
import { createStartModule } from "../../src/modules/start/start.module";
import { StreamQueue } from "../../src/world/stream-queue";

const unconstrained = () => {};

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
    constrainFlightPosition: unconstrained,
  });
  module.load();
  module.activate();
  const mesh = scene.children[0] as Mesh;
  expect(
    new Vector3()
      .fromBufferAttribute(mesh.geometry.getAttribute("position"), 4)
      .normalize()
      .distanceTo(new Vector3(1, 0, 0)),
  ).toBeLessThan(1e-6);
  expect(mesh.position.toArray()).toEqual([10, 4.5, 20]);
  viewpoint.worldDirection.set(-1, 0, 0);
  viewpoint.worldFlightDirection.set(0, 0.6, -0.8);
  module.update?.(1 / 90);
  expect(
    new Vector3()
      .fromBufferAttribute(mesh.geometry.getAttribute("position"), 4)
      .normalize()
      .distanceTo(new Vector3(0, 0.6, -0.8)),
  ).toBeLessThan(1e-6);
  module.unload();
});

test("guidance reuses resources and disposes each loaded lifetime once", () => {
  const scene = new Scene();
  const module = createFlightGuidance({
    scene,
    viewpoint: createViewpoint(),
    parameters: guidance,
    constrainFlightPosition: unconstrained,
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
    constrainFlightPosition: unconstrained,
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

for (const turn of [-1, 1]) {
  test(`continued horizontal turn ${turn} keeps its arc and settles to straight flight`, () => {
    const scene = new Scene();
    const viewpoint = createViewpoint();
    viewpoint.worldFlightPosition.set(0, 0, 0);
    viewpoint.worldFlightDirection.set(0, 0, -1);
    const module = createFlightGuidance({
      scene,
      viewpoint,
      parameters: guidance,
      constrainFlightPosition: unconstrained,
    });
    module.load();
    module.activate();
    for (let frame = 1; frame <= 50; frame++) {
      viewpoint.worldFlightDirection.set(
        Math.sin(turn * frame * 0.02),
        0,
        -Math.cos(frame * 0.02),
      );
      viewpoint.worldFlightPosition.addScaledVector(
        viewpoint.worldFlightDirection,
        0.1,
      );
      module.update?.(0.05);
    }
    const mesh = scene.children[0] as Mesh;
    const tip = new Vector3().fromBufferAttribute(
      mesh.geometry.getAttribute("position"),
      4,
    );
    tip.applyAxisAngle(new Vector3(0, 1, 0), turn);
    expect(tip.x).toBeCloseTo(turn * 5, 1);
    expect(tip.z).toBeCloseTo(-5, 1);
    for (let frame = 0; frame < 30; frame++) {
      viewpoint.worldFlightPosition.addScaledVector(
        viewpoint.worldFlightDirection,
        0.1,
      );
      module.update?.(0.05);
    }
    tip
      .fromBufferAttribute(mesh.geometry.getAttribute("position"), 4)
      .normalize();
    expect(tip.distanceTo(viewpoint.worldFlightDirection)).toBeLessThan(1e-6);
    module.unload();
  });
}

for (const vertical of [-0.6, 0.6]) {
  test(`flight preview reaches the ${vertical > 0 ? "ceiling" : "floor"} and continues along it`, () => {
    const scene = new Scene();
    const viewpoint = createViewpoint();
    viewpoint.worldFlightPosition.set(0, 0, 0);
    viewpoint.worldFlightDirection.set(0, vertical, -0.8);
    const module = createFlightGuidance({
      scene,
      viewpoint,
      parameters: guidance,
      constrainFlightPosition: (position) =>
        keepFlightWithinHeightLimits(position, () => -2, {
          minimumGroundClearanceMeters: 1,
          maximumGroundClearanceMeters: 3,
        }),
    });
    module.load();
    module.activate();
    const positions = (scene.children[0] as Mesh).geometry.getAttribute(
      "position",
    );
    expect(positions.getY(4)).toBeCloseTo(Math.sign(vertical), 6);
    expect(positions.getY(13)).toBeCloseTo(Math.sign(vertical), 6);
    expect(positions.getZ(4)).toBeLessThan(positions.getZ(13));
    expect(positions.getY(175)).toBeCloseTo(
      vertical *
        (guidance.lengthMeters -
          (19 * (guidance.lengthMeters + guidance.behindMeters)) / 24),
      5,
    );
    for (let index = 0; index < positions.count; index++) {
      expect(positions.getY(index)).toBeGreaterThanOrEqual(-1);
      expect(positions.getY(index)).toBeLessThanOrEqual(1);
    }
    expect(viewpoint.worldFlightPosition.toArray()).toEqual([0, 0, 0]);
    module.unload();
  });
}

for (const pitch of [-0.1, 0.1]) {
  test(`pitch change ${pitch} adds only the authored small vertical bend`, () => {
    const scene = new Scene();
    const viewpoint = createViewpoint();
    viewpoint.worldFlightPosition.set(0, 0, 0);
    viewpoint.worldFlightDirection.set(0, 0, -1);
    const module = createFlightGuidance({
      scene,
      viewpoint,
      parameters: guidance,
      constrainFlightPosition: unconstrained,
    });
    module.load();
    module.activate();
    viewpoint.worldFlightDirection.set(0, Math.sin(pitch), -Math.cos(pitch));
    viewpoint.worldFlightPosition.addScaledVector(
      viewpoint.worldFlightDirection,
      0.1,
    );
    module.update?.(0.05);
    const tipY = (scene.children[0] as Mesh).geometry
      .getAttribute("position")
      .getY(4);
    const bend =
      tipY - viewpoint.worldFlightDirection.y * guidance.lengthMeters;
    expect(Math.sign(bend)).toBe(Math.sign(pitch));
    expect(Math.abs(bend)).toBeGreaterThan(0.1);
    expect(Math.abs(bend)).toBeLessThanOrEqual(
      guidance.verticalBendMeters + 1e-6,
    );
    module.unload();
  });
}
