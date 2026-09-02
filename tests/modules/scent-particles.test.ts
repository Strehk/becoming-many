/**
 * Purpose: Verify the Scent Particles module against the shared streaming contracts.
 * Context: Scent radiates from the plants of a streamed world and from live animals.
 * Responsibility: Cover shader patches, per-plant emission, printed trails, and cleanup.
 * Boundary: Visual density and physical PICO performance require separate acceptance.
 */

import { describe, expect, test } from "bun:test";
import {
  Color,
  Points,
  type PointsMaterial,
  Scene,
  Vector2,
  Vector3,
} from "three";
import {
  createScentParticleField,
  disposeScentParticleField,
  initializeScentParticleSlots,
} from "../../src/modules/scent-particles/scent-particle-field";
import {
  createScentParticleMaterial,
  createScentTrailMaterial,
} from "../../src/modules/scent-particles/scent-particle-material";
import {
  createScentParticlesModule,
  type ScentParticlesParameters,
} from "../../src/modules/scent-particles/scent-particles";
import {
  createScentTrailField,
  disposeScentTrailField,
  printScentTrail,
} from "../../src/modules/scent-particles/scent-trail-field";
import type {
  PlantScentSource,
  ScentActorBody,
} from "../../src/modules/scent-sources";
import { StreamQueue } from "../../src/world/stream-queue";
import type { Viewpoint } from "../../src/world/viewer-rig";

const TEST_CHUNK_SIZE = 64;
const PLANTS_PER_TEST_CHUNK = 3;
const CONIFER_PARTICLES = 4;
const BUSH_PARTICLES = 2;
const TEST_PLANT_HEIGHT_METERS = 8;

describe("Scent Particles material", () => {
  test("patches life-cycle motion, size fade, and the circle shape", () => {
    const parameters = createScentParameters();
    const material = createScentParticleMaterial(parameters);
    const shader = compileMaterialForTest(material.pointsMaterial);

    expect(shader.vertexShader).toContain("animateScentParticle");
    expect(shader.vertexShader).toContain("scentVisible");
    expect(shader.vertexShader).toContain("scentRise");
    expect(shader.vertexShader).toContain("getScentParticleClipPosition");
    expect(shader.vertexShader).toContain(
      "gl_PointSize *= getScentParticleSizeScale();",
    );
    expect(shader.fragmentShader).toContain(
      "discardOutsideScentParticleCircle();",
    );
    expect(shader.vertexShader).toContain("scentWind");
    expect(shader.uniforms.scentIntensity?.value).toBe(1);
    expect(shader.vertexShader).toContain("scentSenseFade");
    expect(shader.uniforms.scentSenseFade?.value).toBe(1);
    expect(shader.uniforms.scentRiseDuration?.value).toBe(10);
    expect(shader.uniforms.scentDriftAmplitude?.value).toBe(0.4);
    expect(material.pointsMaterial.customProgramCacheKey()).toBe(
      createScentParticleMaterial(
        createScentParameters(),
      ).pointsMaterial.customProgramCacheKey(),
    );
    material.pointsMaterial.dispose();
  });

  test("patches the trail layer with its own life cycle", () => {
    const parameters = createScentParameters();
    const animals = parameters.animals;
    if (!animals) throw new Error("Expected authored animal scent");

    const material = createScentTrailMaterial({ ...parameters, animals });
    const shader = compileMaterialForTest(material.pointsMaterial);

    expect(shader.vertexShader).toContain("animateScentTrailParticle");
    expect(shader.vertexShader).toContain("scentPrintTime");
    expect(shader.vertexShader).toContain("scentPhase");
    expect(shader.vertexShader).toContain("scentWind");
    expect(shader.vertexShader).toContain("scentSenseFade");
    expect(shader.uniforms.scentTrailLifetime?.value).toBe(20);
    expect(shader.uniforms.scentLoopSeconds?.value).toBe(60);
    expect(material.pointsMaterial.customProgramCacheKey()).not.toBe(
      createScentParticleMaterial(
        parameters,
      ).pointsMaterial.customProgramCacheKey(),
    );
    material.pointsMaterial.dispose();
  });

  test("applies the authored intensity and the module clock", () => {
    const parameters = createScentParameters();
    const material = createScentParticleMaterial({
      appearance: { ...parameters.appearance, intensity: 0.5 },
      motion: parameters.motion,
    });
    const shader = compileMaterialForTest(material.pointsMaterial);

    material.setTime(0.5);

    expect(shader.uniforms.scentIntensity?.value).toBe(0.5);
    expect(shader.uniforms.scentTime?.value).toBe(0.5);
    material.pointsMaterial.dispose();
  });

  test("rejects timings that would break the looping clock", () => {
    const parameters = createScentParameters();

    expect(() =>
      createScentParticleMaterial({
        appearance: parameters.appearance,
        motion: { ...parameters.motion, riseDurationSeconds: 7 },
      }),
    ).toThrow(/divide 60 seconds evenly/);

    const animals = parameters.animals;
    if (!animals) throw new Error("Expected authored animal scent");
    expect(() =>
      createScentTrailMaterial({
        ...parameters,
        animals: { ...animals, lifetimeSeconds: 61 },
      }),
    ).toThrow(/at most 60 seconds/);
  });
});

describe("Scent Particles plant layer", () => {
  test("creates deterministic but different plant scent per chunk", () => {
    const firstPositions = createTwoChunkParticlePositions();
    const repeatedPositions = createTwoChunkParticlePositions();

    expect(repeatedPositions).toEqual(firstPositions);
    expect(readChunkValues(firstPositions, 0)).not.toEqual(
      readChunkValues(firstPositions, 1),
    );
  });

  test("keeps every particle inside the emission volume of its own plant", () => {
    const parameters = createScentParameters();
    const field = createScentParticleField({
      parameters,
      plantSource: createTestPlantSource(),
      chunkSize: TEST_CHUNK_SIZE,
      chunkSlotCount: 1,
    });

    initializeScentParticleSlots(field, [createChunkAssignment(0, 0, 0)]);

    const conifer = parameters.plants.conifer;
    const radius = conifer.emissionRadiusFraction * TEST_PLANT_HEIGHT_METERS;
    // The first plant of every test chunk is a conifer at a known place.
    for (
      let particleIndex = 0;
      particleIndex < conifer.particlesPerPlant;
      particleIndex += 1
    ) {
      const valueOffset = particleIndex * 3;
      const [plantX, groundY, plantZ] = readTestPlant(0);
      expect(
        Math.abs((field.renderedPositions[valueOffset] ?? 0) - plantX),
      ).toBeLessThanOrEqual(radius);
      expect(
        Math.abs((field.renderedPositions[valueOffset + 2] ?? 0) - plantZ),
      ).toBeLessThanOrEqual(radius);

      const restY = field.renderedPositions[valueOffset + 1] ?? Number.NaN;
      expect(restY).toBeGreaterThanOrEqual(
        groundY + conifer.emissionBottomFraction * TEST_PLANT_HEIGHT_METERS,
      );
      expect(restY).toBeLessThanOrEqual(
        groundY + conifer.emissionTopFraction * TEST_PLANT_HEIGHT_METERS,
      );
      expect(field.renderedRises[particleIndex]).toBeCloseTo(
        conifer.riseHeightMeters,
        5,
      );
      expect(field.renderedVisibility[particleIndex]).toBe(1);
    }
    disposeScentParticleField(field);
  });

  test("gives every plant the one signature color of its family", () => {
    const parameters = createScentParameters();
    const field = createScentParticleField({
      parameters,
      plantSource: createTestPlantSource(),
      chunkSize: TEST_CHUNK_SIZE,
      chunkSlotCount: 1,
    });

    initializeScentParticleSlots(field, [createChunkAssignment(0, 0, 0)]);

    // The test source alternates conifer, bush, conifer.
    expect(readColorTriple(field, 0)).toEqual(
      roundedTriple(parameters.plants.conifer.color),
    );
    expect(readColorTriple(field, CONIFER_PARTICLES)).toEqual(
      roundedTriple(parameters.plants.bush.color),
    );
    expect(readColorTriple(field, CONIFER_PARTICLES + BUSH_PARTICLES)).toEqual(
      roundedTriple(parameters.plants.conifer.color),
    );
    disposeScentParticleField(field);
  });

  test("hides the capacity no plant in this chunk needed", () => {
    const field = createScentParticleField({
      parameters: createScentParameters(),
      plantSource: createTestPlantSource(),
      chunkSize: TEST_CHUNK_SIZE,
      chunkSlotCount: 1,
    });

    initializeScentParticleSlots(field, [createChunkAssignment(0, 0, 0)]);

    // Three plants spend two conifers and one bush; the slot is sized for
    // three conifers, so its tail must stay hidden.
    const usedParticles = CONIFER_PARTICLES * 2 + BUSH_PARTICLES;
    for (
      let particleIndex = usedParticles;
      particleIndex < field.particlesPerChunk;
      particleIndex += 1
    ) {
      expect(field.renderedVisibility[particleIndex]).toBe(0);
    }
    disposeScentParticleField(field);
  });
});

describe("Scent Particles trail layer", () => {
  test("prints at the authored rate and leaves the prints behind", () => {
    const parameters = createScentParameters();
    const animals = parameters.animals;
    if (!animals) throw new Error("Expected authored animal scent");

    const field = createScentTrailField({
      parameters,
      animals,
      maxActorCount: 2,
    });
    const body: ScentActorBody = {
      x: 10,
      y: 5,
      z: -4,
      heightMeters: 1.2,
      speciesId: "deer",
    };

    // Ten prints a second: half a second owes five prints.
    printScentTrail(field, [body], 1, 0.5);

    expect(field.printCursor).toBe(5);
    expect(Array.from(field.printedVisibility.slice(0, 5))).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(Array.from(field.printTimes.slice(0, 5))).toEqual([1, 1, 1, 1, 1]);
    expect(readColorTripleFrom(field.printedColors, 0)).toEqual(
      roundedTriple(animals.signatures.deer?.color ?? 0),
    );

    const printedX = field.printedPositions[0] ?? Number.NaN;
    const radius = animals.emissionRadiusFraction * body.heightMeters;
    expect(Math.abs(printedX - body.x)).toBeLessThanOrEqual(radius);

    // Moving the animal on must not move what it already left behind.
    printScentTrail(field, [{ ...body, x: 40 }], 2, 0.5);
    expect(field.printedPositions[0]).toBe(printedX);
    expect(field.printCursor).toBe(10);

    disposeScentTrailField(field);
  });

  test("keeps the ring bounded and skips unsigned species", () => {
    const parameters = createScentParameters();
    const animals = parameters.animals;
    if (!animals) throw new Error("Expected authored animal scent");

    const field = createScentTrailField({
      parameters,
      animals,
      maxActorCount: 1,
    });
    const body: ScentActorBody = {
      x: 0,
      y: 0,
      z: 0,
      heightMeters: 1,
      speciesId: "deer",
    };

    // The ring holds ten prints a second for twenty seconds.
    expect(field.capacity).toBe(200);
    for (let frame = 0; frame < 400; frame += 1) {
      printScentTrail(field, [body], frame, 0.5);
    }
    expect(field.printCursor).toBeLessThan(field.capacity);
    expect(field.printedVisibility.every((visible) => visible === 1)).toBe(
      true,
    );

    const cursorBefore = field.printCursor;
    printScentTrail(field, [{ ...body, speciesId: "unicorn" }], 1, 1);
    expect(field.printCursor).toBe(cursorBefore);

    disposeScentTrailField(field);
  });
});

test("one show fade dims both layers of the sense at once", () => {
  const scene = new Scene();
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: 24,
  };
  const streamQueue = new StreamQueue(
    { budgetMilliseconds: 1, capacity: 256 },
    () => 0,
  );
  const handle = createScentParticlesModule({
    scene,
    viewpoint,
    streamQueue,
    parameters: createScentParameters(),
    plantSource: createTestPlantSource(),
    maxActorCount: 2,
  });

  handle.module.load();
  const plantFade = readFadeUniform(scene, 0);
  const trailFade = readFadeUniform(scene, 1);
  expect(plantFade.value).toBe(1);
  expect(trailFade.value).toBe(1);

  handle.setIntensity(0.25);

  // The plant layer and the printed routes are one sense, so a show that
  // fades it must not leave half of it standing.
  expect(plantFade.value).toBe(0.25);
  expect(trailFade.value).toBe(0.25);

  handle.module.unload();
});

describe("Scent Particles streaming", () => {
  test("keeps one fixed draw while recycling chunk edges", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3();
    const viewpoint: Viewpoint = {
      worldPosition: viewerPosition,
      viewDistanceMeters: 24,
    };
    const streamQueue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    );
    const handle = createScentParticlesModule({
      scene,
      viewpoint,
      streamQueue,
      parameters: createScentParameters(),
      plantSource: createTestPlantSource(),
    });
    const module = handle.module;

    module.load();
    module.activate();

    const points = scene.children[0];
    expect(points).toBeInstanceOf(Points);
    if (!(points instanceof Points)) throw new Error("Expected Points");

    const geometry = points.geometry;
    const positionAttribute = geometry.attributes.position;
    if (!positionAttribute) throw new Error("Expected position attribute");

    const positionArray = positionAttribute.array;
    expect(points.visible).toBe(true);

    // A 24-metre camera range in 64-metre chunks keeps a 5 x 5 slot window,
    // each sized for the worst case of three conifers.
    expect(positionAttribute.count).toBe(
      25 * PLANTS_PER_TEST_CHUNK * CONIFER_PARTICLES,
    );
    expect(positionArray.some((value: number) => value !== 0)).toBe(true);
    expect(positionAttribute.updateRanges).toHaveLength(0);

    viewerPosition.x = 64;
    module.update?.(1 / 90);

    expect(streamQueue.size).toBe(5);

    // A slot is gathered in one step and then written in bounded steps, so
    // draining takes a few frames instead of one long one.
    let frames = 0;
    while (streamQueue.size > 0 && frames < 16) {
      streamQueue.update();
      frames += 1;
    }
    expect(streamQueue.size).toBe(0);
    expect(frames).toBeGreaterThan(1);
    expect(scene.children).toEqual([points]);
    expect(points.geometry).toBe(geometry);
    expect(points.geometry.attributes.position?.array).toBe(positionArray);
    expect(positionAttribute.updateRanges.length).toBeGreaterThan(0);

    module.deactivate();
    expect(points.visible).toBe(false);

    module.unload();
    expect(scene.children).toHaveLength(0);
  });

  test("adds the trail layer only where actors actually run", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3();
    const viewpoint: Viewpoint = {
      worldPosition: viewerPosition,
      viewDistanceMeters: 24,
    };
    const streamQueue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    );
    const handle = createScentParticlesModule({
      scene,
      viewpoint,
      streamQueue,
      parameters: createScentParameters(),
      plantSource: createTestPlantSource(),
      maxActorCount: 2,
    });

    handle.module.load();
    handle.module.activate();
    expect(scene.children).toHaveLength(2);

    // Reporting before an update spends no clock and prints nothing.
    handle.observeActorBodies([
      { x: 0, y: 0, z: 0, heightMeters: 1, speciesId: "deer" },
    ]);
    handle.module.update?.(0.5);
    handle.observeActorBodies([
      { x: 0, y: 0, z: 0, heightMeters: 1, speciesId: "deer" },
    ]);

    const trailPoints = scene.children[1];
    if (!(trailPoints instanceof Points)) throw new Error("Expected Points");
    const visibility = trailPoints.geometry.attributes.scentVisible;
    expect(visibility?.array.some((value: number) => value === 1)).toBe(true);

    handle.module.unload();
    expect(scene.children).toHaveLength(0);
  });
});

describe("Scent Particles wind", () => {
  test("carries both layers along one wind, each by its own reach", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3();
    const viewpoint: Viewpoint = {
      worldPosition: viewerPosition,
      viewDistanceMeters: 24,
    };
    const streamQueue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    );
    const parameters = createScentParameters();
    const handle = createScentParticlesModule({
      scene,
      viewpoint,
      streamQueue,
      parameters,
      plantSource: createTestPlantSource(),
      maxActorCount: 2,
    });

    handle.module.load();
    handle.module.activate();

    const plantWind = readWindUniform(scene, 0);
    const trailWind = readWindUniform(scene, 1);

    // Nothing is carried before the first update advances the wind clock.
    expect(Math.hypot(plantWind.x, plantWind.y)).toBe(0);

    handle.module.update?.(1 / 90);

    const plantReach = Math.hypot(plantWind.x, plantWind.y);
    const trailReach = Math.hypot(trailWind.x, trailWind.y);
    expect(plantReach).toBeGreaterThan(0);

    // One shared wind: the two layers lean the same way and differ only by
    // the reach each authored for itself.
    const animals = parameters.animals;
    if (!animals) throw new Error("Expected authored animal scent");
    expect(trailReach / plantReach).toBeCloseTo(
      animals.windResponseMeters / parameters.motion.windResponseMeters,
      5,
    );
    expect(plantWind.x * trailWind.y - plantWind.y * trailWind.x).toBeCloseTo(
      0,
      9,
    );

    handle.module.unload();
  });

  test("gives every print its own bearing to fray along", () => {
    const parameters = createScentParameters();
    const animals = parameters.animals;
    if (!animals) throw new Error("Expected authored animal scent");

    const field = createScentTrailField({
      parameters,
      animals,
      maxActorCount: 1,
    });
    const body: ScentActorBody = {
      x: 0,
      y: 0,
      z: 0,
      heightMeters: 1,
      speciesId: "deer",
    };

    printScentTrail(field, [body], 1, 2);

    const phases = Array.from(field.printedPhases.slice(0, field.printCursor));
    expect(phases.length).toBeGreaterThan(1);
    for (const phase of phases) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
    // Prints of one burst must not share one bearing, or the route would
    // travel as a single thread instead of spreading.
    expect(new Set(phases).size).toBe(phases.length);

    disposeScentTrailField(field);
  });
});

interface TestShader {
  readonly uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

/**
 * Three plants per chunk in a fixed pattern — conifer, bush, conifer — placed
 * on a slope so neighbouring chunks never repeat one layout.
 */
function createTestPlantSource(): PlantScentSource {
  return {
    groupIds: ["conifer", "bush"],
    maxPlantsPerChunk: () => PLANTS_PER_TEST_CHUNK,
    appendChunkPlants: (chunkX, chunkZ, chunkSizeMeters, pushPlant) => {
      for (
        let plantIndex = 0;
        plantIndex < PLANTS_PER_TEST_CHUNK;
        plantIndex++
      ) {
        const worldX = chunkX * chunkSizeMeters + 8 + plantIndex * 16;
        const worldZ = chunkZ * chunkSizeMeters + 12 + plantIndex * 9;
        pushPlant(
          worldX,
          Math.sin(worldX * 0.05 + worldZ * 0.03),
          worldZ,
          TEST_PLANT_HEIGHT_METERS,
          plantIndex === 1 ? 1 : 0,
        );
      }
    },
  };
}

/** The world position of one plant of the chunk at the world origin. */
function readTestPlant(plantIndex: number): [number, number, number] {
  const worldX = 8 + plantIndex * 16;
  const worldZ = 12 + plantIndex * 9;
  return [worldX, Math.sin(worldX * 0.05 + worldZ * 0.03), worldZ];
}

function createScentParameters(): ScentParticlesParameters {
  const shape = {
    emissionBottomFraction: 0.25,
    emissionTopFraction: 1,
    emissionRadiusFraction: 0.2,
    riseHeightMeters: 2,
  };

  return {
    plants: {
      conifer: {
        ...shape,
        color: 0x9dd2c8,
        particlesPerPlant: CONIFER_PARTICLES,
      },
      deciduous: { ...shape, color: 0xb8e0e1, particlesPerPlant: 2 },
      birch: { ...shape, color: 0xd1c1d7, particlesPerPlant: 2 },
      bush: { ...shape, color: 0x8fc2a6, particlesPerPlant: BUSH_PARTICLES },
      floweringBush: { ...shape, color: 0xc3a7d0, particlesPerPlant: 2 },
      deadWood: { ...shape, color: 0xc9c2b4, particlesPerPlant: 1 },
    },
    animals: {
      signatures: {
        deer: { color: 0xfdbb54 },
        fox: { color: 0xfda39d },
      },
      printsPerSecond: 10,
      lifetimeSeconds: 20,
      emissionBottomFraction: 0.15,
      emissionTopFraction: 0.85,
      emissionRadiusFraction: 0.35,
      riseHeightMeters: 0.8,
      windResponseMeters: 4,
    },
    appearance: {
      sizeMeters: 0.15,
    },
    motion: {
      riseDurationSeconds: 10,
      driftAmplitudeMeters: 0.4,
      speedMultiplier: 1,
      windResponseMeters: 1,
    },
  };
}

/** Read the live sense-fade uniform of one scene layer. */
function readFadeUniform(scene: Scene, childIndex: number): { value: number } {
  const points = scene.children[childIndex];
  if (!(points instanceof Points)) throw new Error("Expected Points");
  const shader = compileMaterialForTest(points.material as PointsMaterial);
  const fade = shader.uniforms.scentSenseFade;
  if (!fade) throw new Error("Expected a sense fade uniform");
  return fade as { value: number };
}

/** Read the live wind uniform of one scene layer without compiling GLSL. */
function readWindUniform(scene: Scene, childIndex: number): Vector2 {
  const points = scene.children[childIndex];
  if (!(points instanceof Points)) throw new Error("Expected Points");
  const material = points.material as PointsMaterial;
  const shader = compileMaterialForTest(material);
  const wind = shader.uniforms.scentWind?.value;
  if (!(wind instanceof Vector2)) throw new Error("Expected a wind uniform");
  return wind;
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

function createTwoChunkParticlePositions(): number[] {
  const field = createScentParticleField({
    parameters: createScentParameters(),
    plantSource: createTestPlantSource(),
    chunkSize: TEST_CHUNK_SIZE,
    chunkSlotCount: 2,
  });

  initializeScentParticleSlots(field, [
    createChunkAssignment(0, 0, 0),
    createChunkAssignment(1, 1, 0),
  ]);
  const positions = Array.from(field.renderedPositions);
  disposeScentParticleField(field);
  return positions;
}

function createChunkAssignment(
  slotIndex: number,
  chunkX: number,
  chunkZ: number,
) {
  return {
    slotIndex,
    revision: 1,
    chunkX,
    chunkZ,
    originX: chunkX * TEST_CHUNK_SIZE,
    originZ: chunkZ * TEST_CHUNK_SIZE,
  } as const;
}

function readChunkValues(positions: readonly number[], slotIndex: number) {
  const valuesPerChunk = PLANTS_PER_TEST_CHUNK * CONIFER_PARTICLES * 3;
  return positions.slice(
    slotIndex * valuesPerChunk,
    (slotIndex + 1) * valuesPerChunk,
  );
}

function readColorTriple(
  field: { readonly renderedColors: Float32Array },
  particleIndex: number,
): number[] {
  return readColorTripleFrom(field.renderedColors, particleIndex);
}

function readColorTripleFrom(
  colors: Float32Array,
  particleIndex: number,
): number[] {
  const valueOffset = particleIndex * 3;
  return [
    colors[valueOffset] ?? -1,
    colors[valueOffset + 1] ?? -1,
    colors[valueOffset + 2] ?? -1,
  ];
}

/** The stored buffers hold 32-bit floats, so compare rounded the same way. */
function roundedTriple(color: number): number[] {
  const converted = new Color(color);
  return [
    Math.fround(converted.r),
    Math.fround(converted.g),
    Math.fround(converted.b),
  ];
}
