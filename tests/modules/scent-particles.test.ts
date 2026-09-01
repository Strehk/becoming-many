/**
 * Purpose: Verify the Scent Particles module against the shared streaming contracts.
 * Context: Scent sources generate deterministically per chunk and follow the traveler.
 * Responsibility: Cover shader patches, deterministic slots, palette colors, and cleanup.
 * Boundary: Visual density and physical PICO performance require separate acceptance.
 */

import { describe, expect, test } from "bun:test";
import {
  Color,
  PerspectiveCamera,
  Points,
  type PointsMaterial,
  Scene,
} from "three";
import {
  createScentParticleField,
  disposeScentParticleField,
  initializeScentParticleSlots,
} from "../../src/modules/scent-particles/scent-particle-field";
import { createScentParticleMaterial } from "../../src/modules/scent-particles/scent-particle-material";
import {
  createScentParticlesModule,
  type ScentParticlesParameters,
} from "../../src/modules/scent-particles/scent-particles";
import { StreamQueue } from "../../src/world/stream-queue";

describe("Scent Particles material", () => {
  test("patches life-cycle motion, size fade, and the circle shape", () => {
    const material = createScentParticleMaterial(createScentParameters());
    const shader = compileMaterialForTest(material.pointsMaterial);

    expect(shader.vertexShader).toContain("animateScentParticle");
    expect(shader.vertexShader).toContain("scentVisible");
    expect(shader.vertexShader).toContain("getScentParticleClipPosition");
    expect(shader.vertexShader).toContain(
      "gl_PointSize *= getScentParticleSizeScale();",
    );
    expect(shader.fragmentShader).toContain(
      "discardOutsideScentParticleCircle();",
    );
    expect(shader.uniforms.scentIntensity?.value).toBe(1);
    expect(shader.uniforms.scentRiseHeight?.value).toBe(4);
    expect(shader.uniforms.scentRiseDuration?.value).toBe(10);
    expect(shader.uniforms.scentDriftAmplitude?.value).toBe(0.4);
    expect(material.pointsMaterial.customProgramCacheKey()).toBe(
      createScentParticleMaterial(
        createScentParameters(),
      ).pointsMaterial.customProgramCacheKey(),
    );
    material.pointsMaterial.dispose();
  });

  test("applies authored intensity and one speed multiplier to the time", () => {
    const parameters = createScentParameters();
    const material = createScentParticleMaterial({
      appearance: { ...parameters.appearance, intensity: 0.5 },
      motion: { ...parameters.motion, speedMultiplier: 2 },
    });
    const shader = compileMaterialForTest(material.pointsMaterial);

    material.update(0.25);

    expect(shader.uniforms.scentIntensity?.value).toBe(0.5);
    expect(shader.uniforms.scentTime?.value).toBe(0.5);
    material.pointsMaterial.dispose();
  });
});

describe("Scent Particles streaming", () => {
  test("creates deterministic but different emitter layouts per chunk", () => {
    const firstPositions = createTwoChunkParticlePositions();
    const repeatedPositions = createTwoChunkParticlePositions();

    expect(repeatedPositions).toEqual(firstPositions);
    expect(readChunkValues(firstPositions, 0)).not.toEqual(
      readChunkValues(firstPositions, 1),
    );
  });

  test("anchors emitters in the authored band above the sampled ground", () => {
    const parameters = createScentParameters();
    const field = createScentParticleField({
      parameters,
      chunkSize: 64,
      chunkSlotCount: 1,
      groundYAt: () => 50,
      zoneAt: () => "coniferForest",
    });

    initializeScentParticleSlots(field, [createChunkAssignment(0, 0, 0)]);

    const lowestRestY =
      50 +
      parameters.placement.minHeightMeters -
      parameters.emission.cloudHeightMeters / 2;
    const highestRestY =
      50 +
      parameters.placement.maxHeightMeters +
      parameters.emission.cloudHeightMeters / 2;
    for (
      let particleIndex = 0;
      particleIndex < field.particlesPerChunk;
      particleIndex += 1
    ) {
      const restY =
        field.renderedPositions[particleIndex * 3 + 1] ?? Number.NaN;
      expect(restY).toBeGreaterThanOrEqual(lowestRestY);
      expect(restY).toBeLessThanOrEqual(highestRestY);
    }
    disposeScentParticleField(field);
  });

  test("thins the cloud out toward its edge instead of ending at a wall", () => {
    const parameters: ScentParticlesParameters = {
      ...createScentParameters(),
      placement: {
        emittersPerChunk: 1,
        minHeightMeters: 2,
        maxHeightMeters: 6,
      },
      emission: {
        particlesPerEmitter: 4000,
        cloudRadiusMeters: 1,
        cloudHeightMeters: 0.5,
      },
    };
    const field = createScentParticleField({
      parameters,
      chunkSize: 64,
      chunkSlotCount: 1,
      groundYAt: () => 50,
      zoneAt: () => "coniferForest",
    });

    initializeScentParticleSlots(field, [createChunkAssignment(0, 0, 0)]);

    const restXValues: number[] = [];
    for (
      let particleIndex = 0;
      particleIndex < field.particlesPerChunk;
      particleIndex += 1
    ) {
      restXValues.push(
        field.renderedPositions[particleIndex * 3] ?? Number.NaN,
      );
    }
    const anchorX =
      restXValues.reduce((sum, restX) => sum + restX, 0) / restXValues.length;
    const innerHalfShare =
      restXValues.filter(
        (restX) =>
          Math.abs(restX - anchorX) < parameters.emission.cloudRadiusMeters / 2,
      ).length / restXValues.length;

    // An even spread leaves half the particles in the inner half of the cloud.
    // A cloud that tapers to nothing at its boundary leaves three quarters.
    expect(innerHalfShare).toBeGreaterThan(0.65);
    disposeScentParticleField(field);
  });

  test("gives every emitter one uniform color from the authored palette", () => {
    const parameters = createScentParameters();
    const field = createScentParticleField({
      parameters,
      chunkSize: 64,
      chunkSlotCount: 1,
      groundYAt: () => 0,
      zoneAt: () => "deciduousForest",
    });

    initializeScentParticleSlots(field, [createChunkAssignment(0, 0, 0)]);

    // The stored buffer holds 32-bit floats, so the palette must be rounded
    // the same way before comparing.
    const paletteTriples = parameters.colors.map((color) => {
      const converted = new Color(color);
      return [
        Math.fround(converted.r),
        Math.fround(converted.g),
        Math.fround(converted.b),
      ];
    });
    const readTriple = (valueIndex: number): number[] => [
      field.renderedColors[valueIndex] ?? -1,
      field.renderedColors[valueIndex + 1] ?? -1,
      field.renderedColors[valueIndex + 2] ?? -1,
    ];
    const particlesPerEmitter = parameters.emission.particlesPerEmitter;
    for (
      let emitterIndex = 0;
      emitterIndex < parameters.placement.emittersPerChunk;
      emitterIndex += 1
    ) {
      const firstValueIndex = emitterIndex * particlesPerEmitter * 3;
      const emitterTriple = readTriple(firstValueIndex);

      expect(paletteTriples).toContainEqual(emitterTriple);
      for (
        let particleIndex = 1;
        particleIndex < particlesPerEmitter;
        particleIndex += 1
      ) {
        expect(readTriple(firstValueIndex + particleIndex * 3)).toEqual(
          emitterTriple,
        );
      }
    }
    disposeScentParticleField(field);
  });

  test("spawns clouds only where the sampled zone grows trees", () => {
    const field = createScentParticleField({
      parameters: createScentParameters(),
      chunkSize: 64,
      chunkSlotCount: 2,
      groundYAt: () => 0,

      // Chunk 0 spans meadow only; chunk 1 spans conifer forest only.
      zoneAt: (worldX) => (worldX < 64 ? "meadow" : "coniferForest"),
    });

    initializeScentParticleSlots(field, [
      createChunkAssignment(0, 0, 0),
      createChunkAssignment(1, 1, 0),
    ]);

    const meadowVisibility = Array.from(
      field.renderedVisibility.slice(0, field.particlesPerChunk),
    );
    const forestVisibility = Array.from(
      field.renderedVisibility.slice(
        field.particlesPerChunk,
        2 * field.particlesPerChunk,
      ),
    );

    expect(meadowVisibility.every((visible) => visible === 0)).toBe(true);
    expect(forestVisibility.every((visible) => visible === 1)).toBe(true);
    disposeScentParticleField(field);
  });

  test("keeps one fixed draw while recycling chunk edges", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 0.1, 24);
    const streamQueue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    );
    const { module } = createScentParticlesModule({
      scene,
      camera,
      streamQueue,
      parameters: createScentParameters(),
      groundYAt: () => 0,
      zoneAt: () => "coniferForest",
    });

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

    // A 24-metre camera range in 64-metre chunks keeps a 5 x 5 slot window.
    expect(positionAttribute.count).toBe(25 * 4);
    expect(positionArray.some((value: number) => value !== 0)).toBe(true);
    expect(positionAttribute.updateRanges).toHaveLength(0);

    camera.position.x = 64;
    module.update?.(1 / 90);

    expect(streamQueue.size).toBe(5);
    streamQueue.update();
    expect(streamQueue.size).toBe(0);
    expect(scene.children).toEqual([points]);
    expect(points.geometry).toBe(geometry);
    expect(points.geometry.attributes.position?.array).toBe(positionArray);
    expect(positionAttribute.updateRanges.length).toBeGreaterThan(0);

    module.deactivate();
    expect(points.visible).toBe(false);

    module.unload();
    expect(scene.children).toHaveLength(0);
  });
});

const EMITTERS_PER_TEST_CHUNK = 2;
const PARTICLES_PER_TEST_EMITTER = 2;

interface TestShader {
  readonly uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

function createScentParameters(): ScentParticlesParameters {
  return {
    colors: [0xb8e0e1, 0xfda39d],
    placement: {
      emittersPerChunk: EMITTERS_PER_TEST_CHUNK,
      minHeightMeters: 2,
      maxHeightMeters: 6,
    },
    emission: {
      particlesPerEmitter: PARTICLES_PER_TEST_EMITTER,
      cloudRadiusMeters: 1,
      cloudHeightMeters: 0.5,
    },
    appearance: {
      sizeMeters: 0.15,
    },
    motion: {
      riseHeightMeters: 4,
      riseDurationSeconds: 10,
      driftAmplitudeMeters: 0.4,
      speedMultiplier: 1,
    },
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

function createTwoChunkParticlePositions(): number[] {
  const field = createScentParticleField({
    parameters: createScentParameters(),
    chunkSize: 64,
    chunkSlotCount: 2,
    groundYAt: (worldX, worldZ) => Math.sin(worldX * 0.05 + worldZ * 0.03),
    zoneAt: () => "coniferForest",
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
    originX: chunkX * 64,
    originZ: chunkZ * 64,
  } as const;
}

function readChunkValues(positions: readonly number[], slotIndex: number) {
  const valuesPerChunk =
    EMITTERS_PER_TEST_CHUNK * PARTICLES_PER_TEST_EMITTER * 3;
  return positions.slice(
    slotIndex * valuesPerChunk,
    (slotIndex + 1) * valuesPerChunk,
  );
}
