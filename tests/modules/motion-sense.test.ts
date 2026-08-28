/**
 * Purpose: Verify the Motion Sense module against its bounded-upload and determinism contracts.
 * Context: Fly swarms and the trail ring must stay deterministic, grounded, and cheap per frame.
 * Responsibility: Cover shader patches, ring slot math, thinning, placement, and lifecycle.
 * Boundary: Visual feel and physical PICO performance require separate acceptance.
 */

import { describe, expect, test } from "bun:test";
import {
  BufferAttribute,
  PerspectiveCamera,
  Points,
  type PointsMaterial,
  Scene,
} from "three";
import { createFlySwarms } from "../../src/modules/motion-sense/fly-swarms";
import { createMotionSenseModule } from "../../src/modules/motion-sense/motion-sense";
import {
  MOTION_SENSE_SETTINGS,
  type MotionSenseParameters,
} from "../../src/modules/motion-sense/motion-sense-settings";
import { createMotionTrailBuffer } from "../../src/modules/motion-sense/motion-trail-buffer";
import { createMotionTrailMaterial } from "../../src/modules/motion-sense/motion-trail-material";

describe("Motion Trail material", () => {
  test("patches GPU aging, size fade, and the circle shape", () => {
    const parameters = createMotionParameters();
    const material = createMotionTrailMaterial({
      appearance: parameters.appearance,
      trail: parameters.trail,
      intensity: 0.75,
    });
    const shader = compileMaterialForTest(material.pointsMaterial);

    expect(shader.vertexShader).toContain("expandMotionTrailParticle");
    expect(shader.vertexShader).toContain("motionSpawnFrame");
    expect(shader.vertexShader).toContain("getMotionTrailClipPosition");
    expect(shader.vertexShader).toContain(
      "gl_PointSize *= getMotionTrailSizeScale();",
    );
    expect(shader.fragmentShader).toContain(
      "discardOutsideMotionTrailCircle();",
    );
    expect(shader.fragmentShader).toContain(
      "diffuseColor.a *= getMotionTrailAlpha();",
    );
    expect(shader.uniforms.motionIntensity?.value).toBe(0.75);
    expect(shader.uniforms.motionLifetimeFrames?.value).toBe(
      parameters.trail.lifetimeFrames,
    );
    expect(shader.uniforms.motionExpansionMeters?.value).toBe(
      parameters.trail.expansionDistanceMeters,
    );
    expect(shader.uniforms.motionFadePower?.value).toBe(
      parameters.trail.fadePower,
    );

    material.setFrame(41);
    expect(shader.uniforms.motionFrame?.value).toBe(41);
    material.pointsMaterial.dispose();
  });
});

describe("Motion Trail ring buffer", () => {
  test("prints one bounded slot per frame and wraps the ring", () => {
    const parameters = createMotionParameters();
    const pointCount = 2;
    const lifetimeFrames = parameters.trail.lifetimeFrames;
    const trail = createMotionTrailBuffer({ pointCount, parameters });
    const geometry = trail.points.geometry;
    const positionAttribute = getBufferAttribute(geometry, "position");
    const frameAttribute = getBufferAttribute(geometry, "motionSpawnFrame");
    const intensityAttribute = getBufferAttribute(
      geometry,
      "motionSpawnIntensity",
    );
    expect(positionAttribute.count).toBe(pointCount * lifetimeFrames);

    for (let frame = 0; frame < lifetimeFrames + 1; frame += 1) {
      clearUpdateRanges(geometry);
      trail.spawnFromWorldPoints(new Float32Array([frame, 0, 0, frame, 1, 0]));

      const slotStart = (frame % lifetimeFrames) * pointCount;
      expect(positionAttribute.array[slotStart * 3]).toBe(frame);
      expect(frameAttribute.array[slotStart]).toBe(frame);
      expect(frameAttribute.array[slotStart + 1]).toBe(frame);

      // Exactly one contiguous update range per attribute covers the slot.
      for (const attribute of [
        positionAttribute,
        frameAttribute,
        intensityAttribute,
      ]) {
        expect(attribute.updateRanges).toHaveLength(1);
        expect(attribute.updateRanges[0]?.start).toBe(
          slotStart * attribute.itemSize,
        );
        expect(attribute.updateRanges[0]?.count).toBe(
          pointCount * attribute.itemSize,
        );
      }
    }
    trail.dispose();
  });

  test("prints the floor when resting and full intensity when moving", () => {
    const parameters = createMotionParameters();
    const pointCount = 1;
    const trail = createMotionTrailBuffer({ pointCount, parameters });
    const intensities = trail.points.geometry.getAttribute(
      "motionSpawnIntensity",
    ).array;

    // No previous frame exists, so the first print uses the faint floor.
    trail.spawnFromWorldPoints(new Float32Array([0, 0, 0]));
    expect(intensities[0]).toBeCloseTo(
      MOTION_SENSE_SETTINGS.trailIntensityFloor,
    );

    // 0.1 metres at motionGain 26 saturates the print intensity at one.
    trail.spawnFromWorldPoints(new Float32Array([0.1, 0, 0]));
    expect(intensities[pointCount]).toBe(1);
    trail.dispose();
  });

  test("thins the same deterministic subset of points every frame", () => {
    const parameters = createMotionParameters({
      trail: { ...createMotionParameters().trail, density: 0.5 },
    });
    const pointCount = 32;
    const trail = createMotionTrailBuffer({ pointCount, parameters });
    const intensities = trail.points.geometry.getAttribute(
      "motionSpawnIntensity",
    ).array;
    const positions = new Float32Array(pointCount * 3);

    trail.spawnFromWorldPoints(positions);
    trail.spawnFromWorldPoints(positions);

    const printedSubset = (slot: number): boolean[] =>
      Array.from(
        intensities.slice(slot * pointCount, (slot + 1) * pointCount),
        (intensity) => intensity > 0,
      );
    const firstSubset = printedSubset(0);
    expect(firstSubset).toEqual(printedSubset(1));
    expect(firstSubset).toContain(true);
    expect(firstSubset).toContain(false);
    trail.dispose();
  });
});

describe("Fly swarms", () => {
  test("places identical deterministic swarms outside water", () => {
    const waterBoundaryX = 0;
    const createSwarms = () =>
      createFlySwarms({
        parameters: createMotionParameters(),
        groundYAt: () => 10,
        // Everything west of the player is water and must reject anchors.
        zoneAt: (worldX) => (worldX < waterBoundaryX ? "water" : "meadow"),
        initialPlayerX: 0,
        initialPlayerZ: 0,
      });
    const first = createSwarms();
    const repeated = createSwarms();

    expect(repeated.getWorldPositions()).toEqual(first.getWorldPositions());
    for (const centroid of getSwarmCentroids(
      first.getWorldPositions(),
      createMotionParameters().swarms,
    )) {
      expect(centroid.x).toBeGreaterThanOrEqual(
        waterBoundaryX - MOTION_SENSE_SETTINGS.swarmRadiusMeters,
      );
    }
    first.dispose();
    repeated.dispose();
  });

  test("keeps every fly above the hard ground clearance while buzzing", () => {
    const groundY = 10;
    const swarms = createFlySwarms({
      parameters: createMotionParameters(),
      groundYAt: () => groundY,
      zoneAt: () => "meadow",
      initialPlayerX: 0,
      initialPlayerZ: 0,
    });

    for (let step = 0; step < 240; step += 1) {
      swarms.update(1 / 90, 0, 0);
    }

    const worldPositions = swarms.getWorldPositions();
    const lowestAllowedY = groundY + 0.1;
    for (let value = 1; value < worldPositions.length; value += 3) {
      expect(worldPositions[value] ?? 0).toBeGreaterThan(lowestAllowedY);
    }
    swarms.dispose();
  });

  test("re-anchors all swarms only after the player travels far enough", () => {
    const parameters = createMotionParameters();
    const swarms = createFlySwarms({
      parameters,
      groundYAt: () => 0,
      zoneAt: () => "meadow",
      initialPlayerX: 0,
      initialPlayerZ: 0,
    });
    const initialCentroids = getSwarmCentroids(
      swarms.getWorldPositions(),
      parameters.swarms,
    );

    // Short travel keeps every anchor in place.
    swarms.update(0, 20, 0);
    const settledCentroids = getSwarmCentroids(
      swarms.getWorldPositions(),
      parameters.swarms,
    );
    initialCentroids.forEach((centroid, swarmIndex) => {
      expect(settledCentroids[swarmIndex]?.x).toBeCloseTo(centroid.x);
      expect(settledCentroids[swarmIndex]?.z).toBeCloseTo(centroid.z);
    });

    // Crossing the threshold relocates every swarm around the new position.
    const travelledX = MOTION_SENSE_SETTINGS.reanchorDistanceMeters + 20;
    swarms.update(0, travelledX, 0);
    const farRingReach =
      MOTION_SENSE_SETTINGS.farRing.maxMeters +
      MOTION_SENSE_SETTINGS.swarmRadiusMeters;
    for (const centroid of getSwarmCentroids(
      swarms.getWorldPositions(),
      parameters.swarms,
    )) {
      const distance = Math.hypot(centroid.x - travelledX, centroid.z);
      expect(distance).toBeLessThanOrEqual(farRingReach);
      expect(distance).toBeGreaterThan(1);
    }
    swarms.dispose();
  });
});

describe("Motion Sense module", () => {
  test("keeps two fixed draws through the whole lifecycle", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 0.1, 128);
    const module = createMotionSenseModule({
      scene,
      camera,
      parameters: createMotionParameters(),
      groundYAt: () => 0,
      zoneAt: () => "meadow",
    });

    module.load();
    expect(scene.children).toHaveLength(2);
    expect(scene.children.every((child) => child instanceof Points)).toBe(true);
    expect(scene.children.every((child) => !child.visible)).toBe(true);

    module.activate();
    expect(scene.children.every((child) => child.visible)).toBe(true);

    const trailFrames = scene.children
      .map((child) =>
        (child as Points).geometry.getAttribute("motionSpawnFrame"),
      )
      .find((attribute) => attribute !== undefined);
    if (!trailFrames) throw new Error("Expected the trail ring attribute");
    module.update?.(1 / 90);
    module.update?.(1 / 90);
    expect(Array.from(trailFrames.array)).toContain(1);

    module.deactivate();
    expect(scene.children.every((child) => !child.visible)).toBe(true);

    module.unload();
    expect(scene.children).toHaveLength(0);
  });
});

interface TestShader {
  readonly uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

function createMotionParameters(
  overrides: Partial<MotionSenseParameters> = {},
): MotionSenseParameters {
  return {
    intensity: 1,
    swarms: {
      swarmCount: 3,
      fliesPerSwarm: 8,
      flightSpeedMultiplier: 1,
    },
    appearance: {
      flyColor: 0x212133,
      flySizeMeters: 0.07,
      trailColor: 0x312758,
      trailSizeMeters: 0.055,
      trailOpacity: 1,
    },
    trail: {
      lifetimeFrames: 3,
      expansionDistanceMeters: 0.22,
      motionGain: 26,
      fadePower: 1.6,
      density: 1,
    },
    ...overrides,
  };
}

function compileMaterialForTest(material: PointsMaterial): TestShader {
  const shader: TestShader = {
    uniforms: {},
    vertexShader: [
      "#include <common>",
      "#include <begin_vertex>",
      "#include <project_vertex>",
      "#include <logdepthbuf_vertex>",
    ].join("\n"),
    fragmentShader: [
      "#include <common>",
      "void main() {",
      "#include <clipping_planes_fragment>",
      "}",
    ].join("\n"),
  };

  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

function clearUpdateRanges(geometry: Points["geometry"]): void {
  for (const name of Object.keys(geometry.attributes)) {
    getBufferAttribute(geometry, name).clearUpdateRanges();
  }
}

function getBufferAttribute(
  geometry: Points["geometry"],
  name: string,
): BufferAttribute {
  const attribute = geometry.getAttribute(name);
  if (!(attribute instanceof BufferAttribute)) {
    throw new Error(`Expected a plain BufferAttribute for "${name}"`);
  }
  return attribute;
}

function getSwarmCentroids(
  worldPositions: Float32Array,
  swarms: MotionSenseParameters["swarms"],
): { readonly x: number; readonly z: number }[] {
  return Array.from({ length: swarms.swarmCount }, (_, swarmIndex) => {
    let sumX = 0;
    let sumZ = 0;
    for (
      let localIndex = 0;
      localIndex < swarms.fliesPerSwarm;
      localIndex += 1
    ) {
      const valueOffset = (swarmIndex * swarms.fliesPerSwarm + localIndex) * 3;
      sumX += worldPositions[valueOffset] ?? 0;
      sumZ += worldPositions[valueOffset + 2] ?? 0;
    }
    return {
      x: sumX / swarms.fliesPerSwarm,
      z: sumZ / swarms.fliesPerSwarm,
    };
  });
}
