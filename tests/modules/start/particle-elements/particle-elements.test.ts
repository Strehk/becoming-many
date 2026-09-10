import { describe, expect, test } from "bun:test";
import { Points, PointsMaterial, Scene, Vector3 } from "three";
import { createFlightRoute } from "../../../../src/modules/start/flight-path/flight-route";
import { createPathParticleGeometry } from "../../../../src/modules/start/flight-path/path-particles";
import { createArrowShape } from "../../../../src/modules/start/particle-elements/arrow-shape";
import { placeElements } from "../../../../src/modules/start/particle-elements/element-placement";
import { createElementRetirement } from "../../../../src/modules/start/particle-elements/element-retirement";
import { createParticleAnimation } from "../../../../src/modules/start/particle-elements/particle-animation";
import { createParticleElements } from "../../../../src/modules/start/particle-elements/particle-elements";
import { createParticleLight } from "../../../../src/modules/start/particle-elements/particle-light";
import { createParticleSimulation } from "../../../../src/modules/start/particle-elements/particle-simulation";
import { createRingShape } from "../../../../src/modules/start/particle-elements/ring-shape";
import {
  START_EXERCISES,
  START_SETTINGS,
} from "../../../../src/modules/start/start-exercises";

// Geometry contracts: route centering, exterior placement, and stable reproduction
for (const exercise of START_EXERCISES) {
  test(`${exercise.id}: rings center on route and arrows remain outside the turn`, () => {
    const route = createFlightRoute(exercise.route, 18);
    const settings = { ...exercise.elements, showArrows: true };
    const placements = placeElements(route, settings);
    expect(placeElements(route, exercise.elements)).toEqual(
      placements.filter((placement) => placement.kind === "ring"),
    );
    const rings = placements.filter((placement) => placement.kind === "ring");
    const arrows = placements.filter((placement) => placement.kind === "arrow");
    expect(arrows.length).toBeGreaterThan(0);
    rings.forEach((ring, index) => {
      const point = new Vector3();
      route.sample(
        exercise.elements.firstMeters + index * exercise.elements.spacingMeters,
        point,
      );
      expect(ring.position.distanceTo(point)).toBeLessThan(1e-6);
    });
    for (const arrow of arrows) {
      const center = new Vector3();
      route.sample(arrow.routeDistanceMeters, center);
      const offset = arrow.position.clone().sub(center);
      expect(
        rings.some(
          (ring) => ring.routeDistanceMeters === arrow.routeDistanceMeters,
        ),
      ).toBe(false);
      expect(offset.length()).toBeCloseTo(exercise.elements.arrowOffsetMeters);
      const before = new Vector3();
      const after = new Vector3();
      route.sampleDirection(arrow.routeDistanceMeters - 2, before);
      route.sampleDirection(arrow.routeDistanceMeters + 2, after);
      expect(offset.dot(after.sub(before))).toBeLessThan(0);
      expect(Math.abs(offset.dot(arrow.direction))).toBeLessThan(0.01);
    }
    expect(placeElements(route, settings)).toEqual(placements);
  });
}

test("shape samplers preserve ring opening and filled arrow bounds", () => {
  const ring = createRingShape(3);
  const arrow = createArrowShape(4);
  const point = new Vector3();
  for (let step = 0; step <= 20; step++) {
    ring.sample((ring.lengthMeters * step) / 20, point);
    expect(point.length()).toBeCloseTo(3);
    expect(point.x).toBe(0);
    arrow.sample((arrow.lengthMeters * step) / 20, point);
    expect(point.x).toBeGreaterThanOrEqual(-2);
    expect(point.x).toBeLessThanOrEqual(2);
  }
});

// Animation and physical response remain independent of the chosen shape
test("animation can reverse without a jump and finishes dissolved", () => {
  const animation = createParticleAnimation(START_SETTINGS.elementAnimation);
  animation.reveal();
  const midway = animation.update(0.4);
  animation.dissolve();
  expect(animation.update(0)).toBe(midway);
  expect(animation.update(2)).toBe(0);
  expect(animation.isFinished()).toBe(true);
});

describe("flight disturbance", () => {
  test("nearby particles move, distant particles stay, then settle", () => {
    const simulation = createParticleSimulation(
      START_SETTINGS.elementSimulation,
    );
    simulation.reset(new Float32Array([3, 0, 0, 20, 0, 0]));
    const player = new Vector3(0, 0, 1);
    simulation.update(1 / 60, player);
    for (let step = 0; step < 60; step++) {
      player.z -= 1 / 30;
      simulation.update(1 / 60, player);
    }
    const disturbed = simulation.update(1 / 60, player);
    expect(Math.abs(disturbed[2] ?? 0)).toBeGreaterThan(0.05);
    expect(disturbed[5]).toBe(0);
    for (let step = 0; step < 600; step++) simulation.update(1 / 60, player);
    expect(Math.abs(disturbed[2] ?? 0)).toBeLessThan(0.001);
  });
  test("stationary player and reset displacements do not trigger wind", () => {
    const simulation = createParticleSimulation(
      START_SETTINGS.elementSimulation,
    );
    simulation.reset(new Float32Array([0, 0, 0]));
    const player = new Vector3();
    simulation.update(1 / 60, player);
    expect([...simulation.update(1 / 60, player)]).toEqual([0, 0, 0]);
    player.z = 20;
    expect([...simulation.update(1 / 60, player)]).toEqual([0, 0, 0]);
  });
});

test("combined display dissolves and releases owned rendering resources", () => {
  const scene = new Scene();
  const material = new PointsMaterial();
  let disposed = false;
  material.addEventListener("dispose", () => {
    disposed = true;
  });
  const display = createParticleElements({
    retirement: createElementRetirement(START_SETTINGS.elementRetirement),
    readDirection: () => new Vector3(0, 0, -1),
    light: createParticleLight(START_SETTINGS.elementLight),
    grainsPerSample: START_SETTINGS.elementVolume.grainsPerSample,
    scene,
    belowFlightMeters: 0.5,
    animationSettings: START_SETTINGS.elementAnimation,
    animation: createParticleAnimation(START_SETTINGS.elementAnimation),
    simulation: createParticleSimulation(START_SETTINGS.elementSimulation),
    readPosition: () => new Vector3(0, 0, -10),
    createGeometry: (shape) =>
      createPathParticleGeometry(shape, START_SETTINGS.elementParticles),
    createMaterial: () => ({ pointsMaterial: material, update: () => {} }),
  });
  display.load();
  display.show(
    [
      {
        placement: {
          kind: "ring",
          routeDistanceMeters: 0,
          position: new Vector3(),
          direction: new Vector3(0, 0, -1),
        },
        shape: createRingShape(3),
      },
    ],
    { position: new Vector3(), yawRadians: 0 },
  );
  display.update(2);
  const cloud = scene.getObjectByName("StartParticleElements");
  if (!(cloud instanceof Points)) throw new Error("Missing grain cloud");
  expect(cloud.geometry.getAttribute("grainIndex").count).toBe(
    START_SETTINGS.elementVolume.grainsPerSample,
  );
  expect(cloud.geometry.getAttribute("elementCenter").count).toBe(
    cloud.geometry.getAttribute("position").count,
  );
  expect(scene.children.length).toBe(1);
  display.dissolve();
  display.update(2);
  expect(scene.children.length).toBe(0);
  display.unload();
  display.unload();
  expect(disposed).toBe(true);
});
