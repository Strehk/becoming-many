/**
 * Purpose: Verify the Motion Sense module against its bounded-upload and determinism contracts.
 * Context: Fly swarms and the trail ring must stay deterministic, grounded, and cheap per frame.
 * Responsibility: Cover shader patches, ring slot math, thinning, placement, and lifecycle.
 * Boundary: Visual feel and physical PICO performance require separate acceptance.
 */

import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  type PointsMaterial,
  Scene,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createBirdBodies } from "../../src/modules/motion-sense/bird-bodies";
import { createBirdFlocks } from "../../src/modules/motion-sense/bird-flocks";
import { createFlySwarms } from "../../src/modules/motion-sense/fly-swarms";
import { createMotionSenseModule } from "../../src/modules/motion-sense/motion-sense";
import {
  MOTION_SENSE_SETTINGS,
  type MotionSenseParameters,
} from "../../src/modules/motion-sense/motion-sense-settings";
import { createMotionTrailBuffer } from "../../src/modules/motion-sense/motion-trail-buffer";
import { createMotionTrailMaterial } from "../../src/modules/motion-sense/motion-trail-material";
import {
  accumulateEnvelopePull,
  createSwarmShapes,
} from "../../src/modules/motion-sense/swarm-shape";
import type { Viewpoint } from "../../src/world/viewer-rig";

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
    const trail = createTrailBufferForTest(pointCount, parameters);
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
    const trail = createTrailBufferForTest(pointCount, parameters);
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
    const trail = createTrailBufferForTest(pointCount, parameters);
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

  test("holds every fly above sloped ground, not just the anchor height", () => {
    // A fly metres out from its anchor must ride the hill it is over. The
    // anchor's own height alone would leave it inside the uphill terrain.
    const groundSlope = 0.25;
    const groundYAt = (worldX: number, worldZ: number) =>
      (worldX + worldZ) * groundSlope;
    const swarms = createFlySwarms({
      parameters: createMotionParameters({
        swarms: { swarmCount: 4, fliesPerSwarm: 30, flightSpeedMultiplier: 1 },
      }),
      groundYAt,
      zoneAt: () => "meadow",
      initialPlayerX: 0,
      initialPlayerZ: 0,
    });

    for (let step = 0; step < 900; step += 1) {
      swarms.update(1 / 90, 0, 0);
    }

    const worldPositions = swarms.getWorldPositions();
    for (
      let valueOffset = 0;
      valueOffset < worldPositions.length;
      valueOffset += 3
    ) {
      const flyX = worldPositions[valueOffset] ?? 0;
      const flyY = worldPositions[valueOffset + 1] ?? 0;
      const flyZ = worldPositions[valueOffset + 2] ?? 0;
      expect(flyY).toBeGreaterThan(groundYAt(flyX, flyZ) + 0.1);
    }
    swarms.dispose();
  });

  test("settles at a bounded spread once the hard ceiling is gone", () => {
    // The envelope is now the only thing holding a swarm together upward and
    // outward. This guards the settled reach; the recapture that makes the
    // reach finite at all is covered directly in "Swarm shape" below.
    const maximumStrayMeters = 12;
    const parameters = createMotionParameters({
      swarms: { swarmCount: 4, fliesPerSwarm: 30, flightSpeedMultiplier: 1 },
    });
    const swarms = createFlySwarms({
      parameters,
      groundYAt: () => 0,
      zoneAt: () => "meadow",
      initialPlayerX: 0,
      initialPlayerZ: 0,
    });
    const startCentroids = getSwarmCentroids(
      swarms.getWorldPositions(),
      parameters.swarms,
    );

    // Two simulated minutes is far past the point the spread settles.
    for (let step = 0; step < 90 * 120; step += 1) {
      swarms.update(1 / 90, 0, 0);
    }

    const worldPositions = swarms.getWorldPositions();
    const endCentroids = getSwarmCentroids(worldPositions, parameters.swarms);
    endCentroids.forEach((centroid, swarmIndex) => {
      // No swarm walks away from its placement, however far its strays roam.
      const start = startCentroids[swarmIndex];
      expect(
        Math.hypot(centroid.x - (start?.x ?? 0), centroid.z - (start?.z ?? 0)),
      ).toBeLessThan(MOTION_SENSE_SETTINGS.swarmRadiusMeters);
    });
    expect(
      getFurthestStrayMeters(worldPositions, parameters.swarms, endCentroids),
    ).toBeLessThan(maximumStrayMeters);
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

    // Crossing the threshold relocates every swarm around the new position,
    // but no swarm may be seen doing it: each one shrinks its specks away,
    // moves while nothing of it is on screen, and swells back at its new
    // ring. A jump with the flies at any size is the pop this replaces.
    const travelledX = MOTION_SENSE_SETTINGS.reanchorDistanceMeters + 20;
    swarms.update(0, travelledX, 0);
    const stepSeconds = 1 / 60;
    let previous = getSwarmCentroids(
      swarms.getWorldPositions(),
      parameters.swarms,
    );
    const moveSeconds =
      MOTION_SENSE_SETTINGS.swarmFadeStaggerSeconds *
        parameters.swarms.swarmCount +
      MOTION_SENSE_SETTINGS.swarmFadeSeconds * 2;
    for (let step = 0; step * stepSeconds < moveSeconds + 1; step += 1) {
      swarms.update(stepSeconds, travelledX, 0);
      const current = getSwarmCentroids(
        swarms.getWorldPositions(),
        parameters.swarms,
      );
      const arrival = swarms.points.geometry.getAttribute("flyArrival");
      current.forEach((centroid, swarmIndex) => {
        const before = previous[swarmIndex];
        if (!before) return;
        const jumped = Math.hypot(centroid.x - before.x, centroid.z - before.z);
        if (jumped <= 1) return;

        expect(arrival.getX(swarmIndex * parameters.swarms.fliesPerSwarm)).toBe(
          0,
        );
      });
      previous = current;
    }

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

    // And every swarm is fully there again once the moves are walked out.
    const arrival = swarms.points.geometry.getAttribute("flyArrival");
    for (let fly = 0; fly < arrival.count; fly += 1) {
      expect(arrival.getX(fly)).toBe(1);
    }
    swarms.dispose();
  });
});

describe("Swarm shape", () => {
  test("draws one distinct deterministic volume per swarm", () => {
    const first = createSwarmShapes(12);
    const repeated = createSwarmShapes(12);

    expect(repeated).toEqual(first);
    // No two clouds may share a silhouette, which is the whole point of the
    // per-swarm draw; the axes and yaw together are that silhouette.
    const silhouettes = new Set(
      first.map((shape) =>
        [shape.radiusX, shape.radiusY, shape.radiusZ, shape.yawCos].join(":"),
      ),
    );
    expect(silhouettes.size).toBe(first.length);
  });

  test("strengthens the envelope past the dissolve radius so nothing escapes", () => {
    // Removing the ceiling clamp left this the only reason a straggler comes
    // back at all: past the dissolve radius the pull must keep growing with
    // distance. A loose fly feels the weakest version of it, so test that one.
    const shape = createSwarmShapes(1)[0];
    if (!shape) throw new Error("Expected one swarm shape");
    const loosestBinding = MOTION_SENSE_SETTINGS.flyBinding.minimum;
    const acceleration = { x: 0, y: 0, z: 0 };

    // Every distance here is past three core radii for any drawn axis scale.
    let previousPull = 0;
    for (const strayMeters of [10, 15, 20, 30]) {
      acceleration.x = 0;
      acceleration.y = 0;
      acceleration.z = 0;
      accumulateEnvelopePull(
        shape,
        loosestBinding,
        strayMeters,
        0,
        0,
        acceleration,
      );
      // The pull points home, and further out it pulls harder.
      expect(acceleration.x).toBeLessThan(0);
      const pull = Math.hypot(acceleration.x, acceleration.y, acceleration.z);
      expect(pull).toBeGreaterThan(previousPull);
      previousPull = pull;
    }
  });

  test("spaces the density lobes by the documented jitter", () => {
    const { lobesPerSwarm, lobeAngleJitter } = MOTION_SENSE_SETTINGS.swarmShape;
    // The jitter is authored as a fraction of the even spacing, so two
    // neighbours can each close half of that fraction and no more. Applying it
    // to a whole turn instead would let three lobes collapse into two.
    const evenSpacingDegrees = 360 / lobesPerSwarm;
    const closestAllowedDegrees = evenSpacingDegrees * (1 - lobeAngleJitter);

    for (const shape of createSwarmShapes(12)) {
      const angles = shape.lobes.map(
        (lobe) =>
          (Math.atan2(lobe.restZ / shape.radiusZ, lobe.restX / shape.radiusX) *
            180) /
          Math.PI,
      );
      for (let first = 0; first < angles.length; first += 1) {
        for (let second = first + 1; second < angles.length; second += 1) {
          const gap = Math.abs((angles[first] ?? 0) - (angles[second] ?? 0));
          expect(Math.min(gap, 360 - gap)).toBeGreaterThanOrEqual(
            closestAllowedDegrees,
          );
        }
      }
    }
  });
});

describe("Bird bodies", () => {
  const APPEARANCE = { lengthMeters: 0.26, color: 0x171717 };

  const createBodies = (scene: Scene, birdCount: number) =>
    createBirdBodies({
      scene,
      asset: createBirdGltf(),
      appearance: APPEARANCE,
      birdCount,
      effects: [],
    });

  test("flies the whole pool as one instanced draw", () => {
    const scene = new Scene();
    const bodies = createBodies(scene, 4);
    const mesh = scene.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("Expected one pool");

    expect(mesh.count).toBe(4);
    expect(mesh.visible).toBe(false);
    bodies.setVisible(true);
    expect(mesh.visible).toBe(true);

    bodies.dispose();
    expect(scene.children).toHaveLength(0);
  });

  test("scales the model onto the authored length and marks its wings", () => {
    const scene = new Scene();
    const bodies = createBodies(scene, 1);
    const mesh = scene.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("Expected one pool");

    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds) throw new Error("Expected measurable bounds");
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(APPEARANCE.lengthMeters, 5);

    // The signed span drives the beat, so it has to reach a wingtip at one
    // and stay inside the wings everywhere else.
    const span = mesh.geometry.getAttribute("birdWingSpan");
    let widest = 0;
    for (let vertex = 0; vertex < span.count; vertex += 1) {
      widest = Math.max(widest, Math.abs(span.getX(vertex)));
    }
    expect(widest).toBeCloseTo(1, 5);
    bodies.dispose();
  });

  test("places every body where the flock says it flies", () => {
    const scene = new Scene();
    const bodies = createBodies(scene, 2);
    const mesh = scene.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("Expected one pool");

    const stride = MOTION_SENSE_SETTINGS.birdBodyValuesPerBird;
    const stream = new Float32Array(2 * stride);
    stream.set([3, 14, -7, Math.PI / 2, 0.5], 0);
    stream.set([-2, 11, 5, 0, -1], stride);
    bodies.update(stream);

    const placement = new Matrix4();
    const position = new Vector3();
    mesh.getMatrixAt(0, placement);
    position.setFromMatrixPosition(placement);
    expect(position.toArray()).toEqual([3, 14, -7]);

    // A quarter turn about up: the bird's own +z now points along world +x.
    const facing = new Vector3(0, 0, 1).transformDirection(placement);
    expect(facing.x).toBeCloseTo(1, 5);
    expect(facing.z).toBeCloseTo(0, 5);

    mesh.getMatrixAt(1, placement);
    position.setFromMatrixPosition(placement);
    expect(position.toArray()).toEqual([-2, 11, 5]);

    const beats = mesh.geometry.getAttribute("birdBeat");
    expect(beats.getX(0)).toBeCloseTo(0.5, 5);
    expect(beats.getX(1)).toBeCloseTo(-1, 5);
    bodies.dispose();
  });
});

describe("Bird flocks", () => {
  const createBirds = () =>
    createBirdFlocks({
      birds: createBirdParameters(),
      groundYAt: () => 10,
      initialPlayerX: 0,
      initialPlayerZ: 0,
    });

  test("streams identical deterministic flocks and flapping wingtips", () => {
    const first = createBirds();
    const repeated = createBirds();
    for (let step = 0; step < 30; step += 1) {
      first.update(1 / 90, 0, 0);
      repeated.update(1 / 90, 0, 0);
    }

    expect(repeated.getWorldPositions()).toEqual(first.getWorldPositions());

    // Wingtips sit half a wingspan beside the body and lift with the flap.
    const points = first.getWorldPositions();
    const bodyY = points[1] ?? 0;
    const leftTipY = points[4] ?? 0;
    const rightTipY = points[7] ?? 0;
    expect(leftTipY).toBe(rightTipY);
    expect(Math.abs(leftTipY - bodyY)).toBeLessThanOrEqual(
      MOTION_SENSE_SETTINGS.birdFlapAmplitudeMeters + 1e-6,
    );
    const wingDistance = Math.hypot(
      (points[3] ?? 0) - (points[0] ?? 0),
      (points[5] ?? 0) - (points[2] ?? 0),
    );
    expect(wingDistance).toBeCloseTo(
      MOTION_SENSE_SETTINGS.birdWingSpanMeters / 2,
    );
  });

  test("streams one body per bird, on the trace it prints", () => {
    const birds = createBirds();
    const parameters = createBirdParameters();
    for (let step = 0; step < 30; step += 1) birds.update(1 / 90, 0, 0);

    const points = birds.getWorldPositions();
    const bodies = birds.getBodyStream();
    const birdCount = parameters.flockCount * parameters.birdsPerFlock;
    expect(bodies).toHaveLength(
      birdCount * MOTION_SENSE_SETTINGS.birdBodyValuesPerBird,
    );

    for (let bird = 0; bird < birdCount; bird += 1) {
      const body = bird * MOTION_SENSE_SETTINGS.birdBodyValuesPerBird;
      const point = bird * MOTION_SENSE_SETTINGS.birdPointsPerBird * 3;
      // A body stands exactly where the trace says the bird is; anything else
      // would draw a bird beside its own trail.
      expect(bodies[body]).toBe(points[point]);
      expect(bodies[body + 1]).toBe(points[point + 1]);
      expect(bodies[body + 2]).toBe(points[point + 2]);
      expect(Math.abs(bodies[body + 4] ?? 2)).toBeLessThanOrEqual(1);
    }
  });

  test("faces every body along the ring it flies", () => {
    const birds = createBirds();
    for (let step = 0; step < 30; step += 1) birds.update(1 / 90, 0, 0);
    const before = birds.getBodyStream().slice();
    for (let step = 0; step < 30; step += 1) birds.update(1 / 90, 0, 0);
    const after = birds.getBodyStream();

    // The heading is the direction the first bird actually travelled in;
    // anything else would fly the pool sideways along its own ring.
    const travelled = Math.atan2(
      (after[0] ?? 0) - (before[0] ?? 0),
      (after[2] ?? 0) - (before[2] ?? 0),
    );
    const heading = after[3] ?? 0;
    const difference = Math.atan2(
      Math.sin(travelled - heading),
      Math.cos(travelled - heading),
    );
    expect(Math.abs(difference)).toBeLessThan(0.2);
  });

  // The bug this guards: the flock's anchor drifts after the traveller, so a
  // bearing taken from the orbit tangent alone flies the whole flock sideways
  // across its own path the moment someone moves.
  test("faces every body along its travel while the traveller moves", () => {
    const birds = createBirds();
    let playerX = 0;
    for (let step = 0; step < 120; step += 1) {
      playerX += 5 / 90;
      birds.update(1 / 90, playerX, 0);
    }

    const before = birds.getBodyStream().slice();
    for (let step = 0; step < 30; step += 1) {
      playerX += 5 / 90;
      birds.update(1 / 90, playerX, 0);
    }
    const after = birds.getBodyStream();
    const stride = MOTION_SENSE_SETTINGS.birdBodyValuesPerBird;

    for (let bird = 0; bird < 6; bird += 1) {
      const offset = bird * stride;
      const travelled = Math.atan2(
        (after[offset] ?? 0) - (before[offset] ?? 0),
        (after[offset + 2] ?? 0) - (before[offset + 2] ?? 0),
      );
      const heading = after[offset + 3] ?? 0;
      const difference = Math.atan2(
        Math.sin(travelled - heading),
        Math.cos(travelled - heading),
      );
      expect(Math.abs(difference)).toBeLessThan(0.35);
    }
  });

  test("keeps every bird on its air ring above the sampled ground", () => {
    const birds = createBirds();
    const parameters = createBirdParameters();
    for (let step = 0; step < 240; step += 1) {
      birds.update(1 / 90, 0, 0);
    }

    const points = birds.getWorldPositions();
    const lowestAllowedY =
      10 +
      parameters.flightHeightMeters -
      MOTION_SENSE_SETTINGS.birdScatter.heightMeters -
      MOTION_SENSE_SETTINGS.birdFlapAmplitudeMeters;
    const farthestAllowed =
      MOTION_SENSE_SETTINGS.birdOrbitRadius.maxMeters +
      MOTION_SENSE_SETTINGS.birdScatter.radiusMeters +
      1;
    for (let point = 0; point < points.length; point += 3) {
      expect(points[point + 1] ?? 0).toBeGreaterThanOrEqual(lowestAllowedY);
      expect(
        Math.hypot(points[point] ?? 0, points[point + 2] ?? 0),
      ).toBeLessThanOrEqual(farthestAllowed);
    }
  });

  test("draws its own size for every flock without resizing the pool", () => {
    const parameters = {
      ...createBirdParameters(),
      flockCount: 5,
      birdsPerFlock: 12,
    };
    const birds = createBirdFlocks({
      birds: parameters,
      groundYAt: () => 10,
      initialPlayerX: 0,
      initialPlayerZ: 0,
    });

    const points = birds.getWorldPositions();
    const { birdPointsPerBird, birdOrbitRadius, minBirdsPerFlock } =
      MOTION_SENSE_SETTINGS;
    expect(points.length).toBe(
      parameters.flockCount * parameters.birdsPerFlock * birdPointsPerBird * 3,
    );

    // Each flock circles its own ring, and the rings sit further apart than a
    // flock is wide, so a body's distance from the anchor names its flock.
    const flockSizes = new Map<number, number>();
    const valuesPerBird = birdPointsPerBird * 3;
    for (let value = 0; value < points.length; value += valuesPerBird) {
      const distance = Math.hypot(points[value] ?? 0, points[value + 2] ?? 0);
      const ring = Math.round(
        ((distance - birdOrbitRadius.minMeters) /
          (birdOrbitRadius.maxMeters - birdOrbitRadius.minMeters)) *
          (parameters.flockCount - 1),
      );
      flockSizes.set(ring, (flockSizes.get(ring) ?? 0) + 1);
    }

    // Every flock is present, none is a stray pair, no bird is lost, and the
    // sizes actually differ — an unwritten slot would print a stale trail.
    expect(flockSizes.size).toBe(parameters.flockCount);
    const sizes = [...flockSizes.values()];
    expect(sizes.reduce((total, size) => total + size, 0)).toBe(
      parameters.flockCount * parameters.birdsPerFlock,
    );
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(minBirdsPerFlock);
    }
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  test("moves every point between frames so trails always print", () => {
    const birds = createBirds();
    const before = Array.from(birds.getWorldPositions());

    birds.update(1 / 90, 0, 0);

    const after = birds.getWorldPositions();
    let movedPoints = 0;
    for (let point = 0; point < after.length; point += 3) {
      const movedMeters = Math.hypot(
        (after[point] ?? 0) - (before[point] ?? 0),
        (after[point + 1] ?? 0) - (before[point + 1] ?? 0),
        (after[point + 2] ?? 0) - (before[point + 2] ?? 0),
      );
      if (movedMeters > 0.001) movedPoints += 1;
    }
    expect(movedPoints).toBe(after.length / 3);
  });
});

describe("Motion Sense module", () => {
  test("keeps two fixed draws through the whole lifecycle", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3();
    const viewpoint: Viewpoint = {
      worldPosition: viewerPosition,
      viewDistanceMeters: 128,
    };
    const { module } = createMotionSenseModule({
      scene,
      viewpoint,
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

  test("adds one invisible-actor trail draw when birds are authored", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3();
    const viewpoint: Viewpoint = {
      worldPosition: viewerPosition,
      viewDistanceMeters: 128,
    };
    const { module } = createMotionSenseModule({
      scene,
      viewpoint,
      parameters: createMotionParameters({ birds: createBirdParameters() }),
      groundYAt: () => 0,
      zoneAt: () => "meadow",
    });

    module.load();
    module.activate();

    // Flies, fly trails, and bird trails; bird bodies render nothing.
    expect(scene.children).toHaveLength(3);
    expect(scene.children.every((child) => child instanceof Points)).toBe(true);

    module.update?.(1 / 90);
    module.update?.(1 / 90);
    const trailFrameAttributes = scene.children
      .map((child) =>
        (child as Points).geometry.getAttribute("motionSpawnFrame"),
      )
      .filter((attribute) => attribute !== undefined);
    expect(trailFrameAttributes).toHaveLength(2);
    for (const attribute of trailFrameAttributes) {
      expect(Array.from(attribute.array)).toContain(1);
    }

    module.unload();
    expect(scene.children).toHaveLength(0);
  });

  test("sizes the bird ring on its own depth, not the fly trail's", () => {
    const scene = new Scene();
    const viewpoint: Viewpoint = {
      worldPosition: new Vector3(),
      viewDistanceMeters: 128,
    };
    const birds = { ...createBirdParameters(), trailLifetimeFrames: 9 };
    const parameters = createMotionParameters({ birds });
    const { module } = createMotionSenseModule({
      scene,
      viewpoint,
      parameters,
      groundYAt: () => 0,
      zoneAt: () => "meadow",
    });

    module.load();

    // A bird crosses the sky and a fly buzzes in place, so the two traces are
    // authored to different lengths and each ring is sized for its own.
    const trailCounts = scene.children
      .filter(
        (child) =>
          child instanceof Points &&
          child.geometry.getAttribute("motionSpawnFrame") !== undefined,
      )
      .map(
        (child) => (child as Points).geometry.getAttribute("position").count,
      );
    const flyPoints =
      parameters.swarms.swarmCount * parameters.swarms.fliesPerSwarm;
    const birdPoints =
      birds.flockCount *
      birds.birdsPerFlock *
      MOTION_SENSE_SETTINGS.birdPointsPerBird;
    expect(trailCounts).toEqual([
      flyPoints * parameters.trail.lifetimeFrames,
      birdPoints * birds.trailLifetimeFrames,
    ]);

    module.unload();
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

function createBirdParameters(): NonNullable<MotionSenseParameters["birds"]> {
  return {
    flockCount: 2,
    birdsPerFlock: 4,
    flightSpeedMetersPerSecond: 8,
    trailLifetimeFrames: 5,
    flightHeightMeters: 14,
    appearance: {
      trailColor: 0x10bedb,
      trailSizeMeters: 0.18,
      trailOpacity: 1,
    },
  };
}

function createTrailBufferForTest(
  pointCount: number,
  parameters: MotionSenseParameters,
) {
  return createMotionTrailBuffer({
    pointCount,
    trail: parameters.trail,
    appearance: parameters.appearance,
    intensity: parameters.intensity,
  });
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

/** The single fly furthest from its own swarm centroid, in metres. */
function getFurthestStrayMeters(
  worldPositions: Float32Array,
  swarms: MotionSenseParameters["swarms"],
  centroids: readonly { readonly x: number; readonly z: number }[],
): number {
  let furthest = 0;
  for (let flyIndex = 0; flyIndex < worldPositions.length / 3; flyIndex += 1) {
    const centroid = centroids[Math.floor(flyIndex / swarms.fliesPerSwarm)];
    const valueOffset = flyIndex * 3;
    furthest = Math.max(
      furthest,
      Math.hypot(
        (worldPositions[valueOffset] ?? 0) - (centroid?.x ?? 0),
        worldPositions[valueOffset + 1] ?? 0,
        (worldPositions[valueOffset + 2] ?? 0) - (centroid?.z ?? 0),
      ),
    );
  }
  return furthest;
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

/** A bird-shaped stand-in: two metres of span, one of length, facing +z. */
function createBirdGltf(): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(2, 0.2, 1), new MeshBasicMaterial()));
  return {
    animations: [],
    asset: {},
    cameras: [],
    parser: {} as GLTF["parser"],
    scene,
    scenes: [scene],
    userData: {},
  };
}
