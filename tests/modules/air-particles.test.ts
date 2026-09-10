/**
 * Purpose: Verify the Air Particles module against the shared streaming contracts.
 * Context: The first volumetric consumer combines a fixed slot window into one GPU draw.
 * Responsibility: Cover fixed capacity, queued edge updates, visibility, and cleanup.
 * Boundary: Visual density and physical Windows-PCVR performance require separate acceptance.
 */

import { describe, expect, test } from "bun:test";
import { Points, type PointsMaterial, Scene, ShaderLib, Vector3 } from "three";
import {
  createAirParticleCloud,
  disposeAirParticleCloud,
  initializeAirParticleSlots,
} from "../../src/modules/air-particles/air-particle-cloud";
import { createAirParticleMaterial } from "../../src/modules/air-particles/air-particle-material";
import {
  type AirParticleShape,
  type AirParticlesParameters,
  createAirParticlesModule,
} from "../../src/modules/air-particles/air-particles";
import { StreamQueue } from "../../src/world/stream-queue";
import type { Viewpoint } from "../../src/world/viewpoint";

describe("Air Particles material", () => {
  test("keeps the square default free of circle fragment work", () => {
    const squareMaterial = createAirParticleMaterial(
      createAirParticlesParameters(PARTICLES_PER_TEST_CHUNK),
    );
    const squareShader = compileMaterialForTest(squareMaterial.pointsMaterial);

    expect(squareShader.fragmentShader).toBe(TEST_FRAGMENT_SHADER);
    expect(squareMaterial.pointsMaterial.transparent).toBe(false);
    expect(squareMaterial.pointsMaterial.depthWrite).toBe(true);
    expect(squareShader.vertexShader).toContain("animateAirParticle");
    expect(squareShader.vertexShader).not.toContain("gl_PointSize = min(");
    expect(squareShader.uniforms.airParticleHorizontalAmplitude?.value).toBe(
      0.04,
    );
    expect(squareShader.uniforms.airParticleVerticalAmplitude?.value).toBe(
      0.08,
    );

    squareMaterial.update(0.25);
    expect(squareShader.uniforms.airParticleTime?.value).toBe(0.25);
    squareMaterial.pointsMaterial.dispose();
  });

  test("compiles the circle shader only for the circle shape", () => {
    const squareMaterial = createAirParticleMaterial(
      createAirParticlesParameters(PARTICLES_PER_TEST_CHUNK),
    );
    const circleMaterial = createAirParticleMaterial(
      createAirParticlesParameters(PARTICLES_PER_TEST_CHUNK, "circle"),
    );
    const circleShader = compileMaterialForTest(circleMaterial.pointsMaterial);

    expect(circleShader.fragmentShader).toContain(
      "discardOutsideAirParticleCircle();",
    );
    expect(circleMaterial.pointsMaterial.customProgramCacheKey()).not.toBe(
      squareMaterial.pointsMaterial.customProgramCacheKey(),
    );

    squareMaterial.pointsMaterial.dispose();
    circleMaterial.pointsMaterial.dispose();
  });

  test("applies one speed multiplier to the shared animation time", () => {
    const parameters = createAirParticlesParameters(PARTICLES_PER_TEST_CHUNK);
    const material = createAirParticleMaterial({
      appearance: parameters.appearance,
      motion: { ...parameters.motion, speedMultiplier: 2 },
    });
    const shader = compileMaterialForTest(material.pointsMaterial);

    material.update(0.25);

    expect(shader.uniforms.airParticleTime?.value).toBe(0.5);
    material.pointsMaterial.dispose();
  });

  test("fades only an authored local field using radial view-space distance", () => {
    const parameters = createAirParticlesParameters(48, "circle");
    const material = createAirParticleMaterial({
      ...parameters,
      streaming: { chunkLevel: 0, viewDistanceMeters: 32, fadeStartMeters: 24 },
    });
    const shader = compileMaterialForTest(material.pointsMaterial);

    expect(material.pointsMaterial.transparent).toBe(true);
    expect(material.pointsMaterial.depthWrite).toBe(false);
    expect(shader.uniforms.airParticleFadeStart?.value).toBe(24);
    expect(shader.uniforms.airParticleFadeEnd?.value).toBe(32);
    expect(shader.vertexShader).toContain("length(viewPosition)");
    expect(shader.vertexShader).toContain(
      "AIR_PARTICLE_NEAR_FADE_START_METERS = 0.5;",
    );
    expect(shader.vertexShader).toContain(
      "AIR_PARTICLE_NEAR_FADE_END_METERS = 2.0;",
    );
    const sizeLimitIndex = shader.vertexShader.indexOf("gl_PointSize = min(");
    expect(sizeLimitIndex).toBeGreaterThan(
      shader.vertexShader.indexOf(
        "gl_PointSize *= ( scale / - mvPosition.z );",
      ),
    );
    expect(shader.vertexShader).toContain(
      "AIR_PARTICLE_MAXIMUM_SIZE_PIXELS = 12.0;",
    );
    expect(shader.fragmentShader).toContain(
      "diffuseColor.a *= airParticleDistanceOpacity;",
    );
    expect(shader.fragmentShader).toContain(
      "discardOutsideAirParticleCircle();",
    );
    material.pointsMaterial.dispose();
  });
});

describe("Air Particles streaming", () => {
  test("keeps a dense nearfield world-anchored and recycles only its outer face", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3(1, 1, 1);
    const streamQueue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    );
    const module = createAirParticlesModule({
      scene,
      viewpoint: {
        worldPosition: viewerPosition,
        worldDirection: new Vector3(0, 0, -1),
        worldUp: new Vector3(0, 1, 0),
        viewHalfAngleRadians: Math.PI / 4,
        viewDistanceMeters: 128,
      },
      streamQueue,
      parameters: {
        ...createAirParticlesParameters(48, "circle"),
        streaming: {
          chunkLevel: 0,
          viewDistanceMeters: 32,
          fadeStartMeters: 24,
        },
      },
    });
    module.load();
    const points = scene.children[0];
    if (!(points instanceof Points)) throw new Error("Expected Points");
    const position = points.geometry.getAttribute("position");
    const initialPositions = Array.from(position.array);
    const buffer = position.array;
    expect(position.count).toBe(16_464);

    viewerPosition.set(15, 2, 3);
    module.update?.(1 / 90);
    expect(streamQueue.size).toBe(0);
    expect(Array.from(position.array)).toEqual(initialPositions);
    expect(points.position.toArray()).toEqual([0, 0, 0]);
    expect(points.quaternion.toArray()).toEqual([0, 0, 0, 1]);

    viewerPosition.x = 16;
    module.update?.(1 / 90);
    expect(streamQueue.size).toBe(49);
    streamQueue.update();
    expect(position.array).toBe(buffer);
    expect(position.count).toBe(16_464);
    let changedParticles = 0;
    for (let offset = 0; offset < buffer.length; offset += 3) {
      if (buffer[offset] === initialPositions[offset]) continue;
      changedParticles += 1;
      expect(buffer[offset]).toBeGreaterThanOrEqual(64);
      expect(buffer[offset]).toBeLessThan(80);
    }
    expect(changedParticles).toBe(49 * 48);

    // Unloading invalidates work already queued for another face.
    viewerPosition.y = 16;
    module.update?.(1 / 90);
    expect(streamQueue.size).toBe(49);
    let geometryDisposals = 0;
    let materialDisposals = 0;
    if (Array.isArray(points.material))
      throw new Error("Expected one material");
    points.geometry.addEventListener("dispose", () => {
      geometryDisposals += 1;
    });
    points.material.addEventListener("dispose", () => {
      materialDisposals += 1;
    });
    module.unload();
    streamQueue.update();
    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
    expect(scene.children).toHaveLength(0);
  });

  test("rejects invalid local fade ranges before allocating a field", () => {
    const scene = new Scene();
    const module = createAirParticlesModule({
      scene,
      viewpoint: {
        worldPosition: new Vector3(),
        worldDirection: new Vector3(0, 0, -1),
        worldUp: new Vector3(0, 1, 0),
        viewHalfAngleRadians: Math.PI / 4,
        viewDistanceMeters: 128,
      },
      streamQueue: new StreamQueue({ budgetMilliseconds: 1, capacity: 256 }),
      parameters: {
        ...createAirParticlesParameters(48),
        streaming: {
          chunkLevel: 0,
          viewDistanceMeters: 24,
          fadeStartMeters: 32,
        },
      },
    });
    expect(() => module.load()).toThrow("ordered finite fade range");
    expect(scene.children).toHaveLength(0);
  });

  test("creates deterministic but different particle layouts per volume", () => {
    const firstPositions = createTwoChunkParticlePositions();
    const repeatedPositions = createTwoChunkParticlePositions();

    expect(repeatedPositions).toEqual(firstPositions);
    expect(readChunkHeights(firstPositions, 0)).not.toEqual(
      readChunkHeights(firstPositions, 1),
    );
  });

  test("renders particles only above the sampled world surface", () => {
    const cloud = createAirParticleCloud({
      parameters: createAirParticlesParameters(PARTICLES_PER_TEST_CHUNK),
      chunkSize: 64,
      chunkSlotCount: 2,
      surfaceYAt: () => 63.5,
    });

    initializeAirParticleSlots(cloud, [
      createVolumeAssignment(0, 0, 0),
      createVolumeAssignment(1, 0, 1),
    ]);

    expect(readChunkVisibility(cloud.renderedVisibility, 0)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(readChunkVisibility(cloud.renderedVisibility, 1)).toEqual([
      1, 1, 1, 1,
    ]);
    disposeAirParticleCloud(cloud);
  });

  test("keeps one fixed draw while recycling buffered volume faces", () => {
    const scene = new Scene();
    const viewerPosition = new Vector3();
    const viewpoint: Viewpoint = {
      worldPosition: viewerPosition,
      worldDirection: new Vector3(0, 0, -1),
      worldUp: new Vector3(0, 1, 0),
      viewHalfAngleRadians: Math.PI / 4,
      viewDistanceMeters: 24,
    };
    const streamQueue = new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    );
    const module = createAirParticlesModule({
      scene,
      viewpoint,
      streamQueue,
      parameters: createAirParticlesParameters(2),
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
    expect(positionAttribute.count).toBe(250);
    expect(positionArray.some((value: number) => value !== 0)).toBe(true);
    expect(positionAttribute.updateRanges).toHaveLength(0);

    viewerPosition.x = 64;
    module.update?.(1 / 90);

    expect(streamQueue.size).toBe(25);
    streamQueue.update();
    expect(streamQueue.size).toBe(0);
    expect(scene.children).toEqual([points]);
    expect(points.geometry).toBe(geometry);
    expect(points.geometry.attributes.position?.array).toBe(positionArray);
    expect(positionAttribute.updateRanges.length).toBeGreaterThan(0);

    viewerPosition.y = 64;
    module.update?.(1 / 90);

    expect(streamQueue.size).toBe(25);
    streamQueue.update();
    expect(streamQueue.size).toBe(0);

    module.deactivate();
    expect(points.visible).toBe(false);

    module.unload();
    expect(scene.children).toHaveLength(0);
  });
});

const PARTICLES_PER_TEST_CHUNK = 4;
const POSITION_COMPONENT_COUNT = 3;
const TEST_FRAGMENT_SHADER = [
  "#include <common>",
  "void main() {",
  "#include <clipping_planes_fragment>",
  "}",
].join("\n");

interface TestShader {
  readonly uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

function createAirParticlesParameters(
  particlesPerChunk: number,
  shape?: AirParticleShape,
): AirParticlesParameters {
  return {
    density: { particlesPerChunk },
    appearance: {
      color: 0xffffff,
      sizeMeters: 0.025,
      shape,
    },
    motion: {
      horizontalAmplitudeMeters: 0.04,
      verticalAmplitudeMeters: 0.08,
      speedMultiplier: 1,
    },
  };
}

function compileMaterialForTest(material: PointsMaterial): TestShader {
  const shader: TestShader = {
    uniforms: {},
    vertexShader: ShaderLib.points.vertexShader,
    fragmentShader: TEST_FRAGMENT_SHADER,
  };

  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

function createTwoChunkParticlePositions(): number[] {
  const cloud = createAirParticleCloud({
    parameters: createAirParticlesParameters(PARTICLES_PER_TEST_CHUNK),
    chunkSize: 64,
    chunkSlotCount: 2,
  });

  initializeAirParticleSlots(cloud, [
    createVolumeAssignment(0, 0, 0),
    createVolumeAssignment(1, 1, 0),
  ]);
  const positions = Array.from(cloud.renderedPositions);
  disposeAirParticleCloud(cloud);
  return positions;
}

function createVolumeAssignment(
  slotIndex: number,
  chunkX: number,
  chunkY: number,
) {
  return {
    slotIndex,
    revision: 1,
    chunkX,
    chunkY,
    chunkZ: 0,
    originX: chunkX * 64,
    originY: chunkY * 64,
    originZ: 0,
  } as const;
}

function readChunkHeights(positions: readonly number[], slotIndex: number) {
  const valuesPerChunk = PARTICLES_PER_TEST_CHUNK * POSITION_COMPONENT_COUNT;
  const slotStart = slotIndex * valuesPerChunk;

  return Array.from(
    { length: PARTICLES_PER_TEST_CHUNK },
    (_, particleIndex) =>
      positions[slotStart + particleIndex * POSITION_COMPONENT_COUNT + 1],
  );
}

function readChunkVisibility(
  visibility: ArrayLike<number>,
  slotIndex: number,
): number[] {
  const slotStart = slotIndex * PARTICLES_PER_TEST_CHUNK;
  return Array.from(
    { length: PARTICLES_PER_TEST_CHUNK },
    (_, particleIndex) => visibility[slotStart + particleIndex] ?? -1,
  );
}
