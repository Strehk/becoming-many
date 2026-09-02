/**
 * Purpose: Own the clipmap of grass chunks, their geometry, materials, and uniforms.
 * Context: An endless field must reuse bounded GPU buffers while following the camera.
 * Responsibility: Lay out levels, choose detail and allocation per chunk, and drive the field uniforms.
 * Boundary: Ground sampling lives in the height field; module lifecycle lives beside this file.
 */

import type { PerspectiveCamera } from "three";
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Frustum,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import { getWorldWind, wrapWindSeconds } from "../../world/wind";
import fragmentShader from "./grass-clipmap.frag.glsl?raw";
import vertexShader from "./grass-clipmap.vert.glsl?raw";
import type { GrassClipmapPreset } from "./grass-clipmap-settings";
import { GRASS_CLIPMAP_SETTINGS } from "./grass-clipmap-settings";
import type { GrassHeightField } from "./grass-height-field";

interface ChunkState {
  detailIndex: number;
  densityStep: number;
  placed: boolean;
}

interface ClipmapLevel {
  readonly index: number;
  readonly chunkSizeMeters: number;
  readonly innerEdgeMeters: number;
  readonly allocatedDensity: number;
  /** Indexed by detail step, then by density step. */
  readonly geometries: readonly (readonly InstancedBufferGeometry[])[];
  /** Indexed by shader tier, then by density step. */
  readonly materials: readonly (readonly ShaderMaterial[])[];
  readonly chunks: readonly Mesh[];
  readonly chunkStates: readonly ChunkState[];
  startX: number;
  startZ: number;
}

export interface GrassClipmapField {
  readonly group: Group;
  /** Re-snap the chunk grid; true when the layout actually moved. */
  readonly followCamera: (cameraX: number, cameraZ: number) => boolean;
  readonly selectDetail: (cameraX: number, cameraZ: number) => void;
  readonly updateFrustum: (camera: PerspectiveCamera) => void;
  readonly advanceWind: (deltaSeconds: number) => void;
  readonly publishHeightWindow: () => void;
  readonly dispose: () => void;
}

export interface GrassClipmapFieldOptions {
  readonly preset: GrassClipmapPreset;
  readonly heightField: GrassHeightField;
  /** The carried level haze the field fades into where no sense covers it. */
  readonly fogColor: number;
  /** Sense responses the composition root patches into the blade material. */
  readonly effects?: readonly UnlitMaterialEffect[];
}

const DEGENERATE_TIERS = [0, 1, 2] as const;

export function createGrassClipmapField(
  options: GrassClipmapFieldOptions,
): GrassClipmapField {
  const layout = GRASS_CLIPMAP_SETTINGS.layout;
  const ring = getLegalRing(layout.ring, layout.levels);
  const span = ring * 2;
  const chunkSizeMeters = layout.coverage0Meters / ring;
  const cells = createCellAttribute();
  const shared = createSharedUniforms(options);
  const group = new Group();
  group.matrixAutoUpdate = false;

  const levels = Array.from({ length: layout.levels }, (_, index) =>
    createLevel({ index, ring, span, chunkSizeMeters, cells, shared, options }),
  );
  for (const level of levels) {
    for (const chunk of level.chunks) group.add(chunk);
  }

  const windClock = { seconds: 0 };
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  let laidOut = false;

  return {
    group,

    followCamera: (cameraX, cameraZ) => {
      let moved = false;
      for (const level of levels) {
        const size = level.chunkSizeMeters;
        // Snap to the doubled grid so every level's edges fall on the grid of
        // the next coarser one. Without it the inner hole lands inside a chunk
        // and the border tears a gap or draws an area twice. A single level
        // has no coarser grid to meet, so it may snap finely, which doubles
        // the guaranteed margin.
        const single = levels.length === 1;
        const startX = single
          ? Math.floor(cameraX / size) - ring
          : Math.floor(cameraX / (2 * size)) * 2 - ring;
        const startZ = single
          ? Math.floor(cameraZ / size) - ring
          : Math.floor(cameraZ / (2 * size)) * 2 - ring;
        if (startX !== level.startX || startZ !== level.startZ || !laidOut) {
          level.startX = startX;
          level.startZ = startZ;
          moved = true;
        }
      }
      if (!moved) return false;

      layOutChunks(levels, span);
      laidOut = true;
      return true;
    },

    selectDetail: (cameraX, cameraZ) =>
      selectDetail(levels, cameraX, cameraZ, options.preset),

    updateFrustum: (camera) => {
      camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      frustum.setFromProjectionMatrix(viewProjection);
      // Three gives right, left, bottom, top, far, near; the first four are the
      // side planes and the distance test already covers near and far.
      for (let index = 0; index < 4; index++) {
        const plane = frustum.planes[index];
        const target = shared.uGrassFrustum.value[index];
        if (!plane || !target) continue;
        target.set(
          plane.normal.x,
          plane.normal.y,
          plane.normal.z,
          plane.constant,
        );
      }
    },

    advanceWind: (deltaSeconds) => {
      windClock.seconds = wrapWindSeconds(windClock.seconds + deltaSeconds);
      shared.uGrassTime.value = windClock.seconds;
      const wind = getWorldWind(windClock.seconds);
      shared.uGrassWindDirection.value.set(wind.directionX, wind.directionZ);
      shared.uGrassWindStrength.value =
        wind.strength * GRASS_CLIPMAP_SETTINGS.wind.strengthScale;
    },

    publishHeightWindow: () => {
      shared.uGrassHeightPlacement.value.copy(options.heightField.placement);
    },

    dispose: () => {
      for (const level of levels) {
        for (const perDetail of level.geometries) {
          for (const geometry of perDetail) geometry.dispose();
        }
        for (const perTier of level.materials) {
          for (const material of perTier) material.dispose();
        }
      }
    },
  };
}

/**
 * The worst-case distance from the camera to the outer edge of level zero is
 * `(ring - 2) * chunkSize`, which is zero at ring two: the camera can stand on
 * the edge, and behind it a level allocated for a multiple of that distance
 * takes over — a hard line with an order of magnitude less grass behind it.
 * With a single level there is no coarser grid to align to, so a finer snap is
 * allowed and ring two becomes usable.
 */
export function getLegalRing(ring: number, levels: number): number {
  const even = Math.max(2, Math.round(ring / 2) * 2);
  return levels > 1 ? Math.max(4, even) : even;
}

/**
 * The distance up to which grass is guaranteed to stand. Not the nominal
 * extent: grid snapping means the camera does not sit at the centre of its own
 * grid, so the outermost level keeps only this much margin in the worst case.
 */
export function getGuaranteedMarginMeters(): number {
  const layout = GRASS_CLIPMAP_SETTINGS.layout;
  const ring = getLegalRing(layout.ring, layout.levels);
  const outerChunkSize =
    (layout.coverage0Meters / ring) * 2 ** (layout.levels - 1);
  const tight = layout.levels <= 1;

  return (tight ? ring - 1 : ring - 2) * outerChunkSize;
}

/** How many instances one chunk of a level starts with, and why. */
export interface GrassLevelAllocation {
  readonly chunkSizeMeters: number;
  /** Where this level must carry the highest density the law asks of it. */
  readonly innerEdgeMeters: number;
  /** The density the allocation below actually delivers. */
  readonly allocatedDensity: number;
  readonly baseInstanceCount: number;
  /** The largest step, which is the one that could hit the buffer ceiling. */
  readonly largestStepInstanceCount: number;
  readonly instanceCeiling: number;
}

/**
 * Every level allocates what the density law demands at its inner edge; the
 * shader thins the rest by rank. Exposed because two invariants depend on it
 * and neither is visible from the outside: no step may be clamped by the
 * buffer ceiling, or the exact factor-of-four progression breaks and blades
 * change identity across a step; and the allocation must never fall short of
 * the law, because the shader can only take away.
 */
export function getGrassLevelAllocation(
  index: number,
  preset: GrassClipmapPreset,
): GrassLevelAllocation {
  const layout = GRASS_CLIPMAP_SETTINGS.layout;
  const ring = getLegalRing(layout.ring, layout.levels);
  const chunkSizeMeters = (layout.coverage0Meters / ring) * 2 ** index;
  const innerEdgeMeters =
    index === 0 ? 0 : layout.coverage0Meters * 2 ** (index - 1);
  const instanceCeiling = 4 ** GRASS_CLIPMAP_SETTINGS.instanceGridBits;

  let allocatedDensity = getLawDensity(innerEdgeMeters, preset);
  let baseInstanceCount = Math.max(
    16,
    Math.round(allocatedDensity * chunkSizeMeters * chunkSizeMeters),
  );
  if (baseInstanceCount > instanceCeiling) {
    baseInstanceCount = instanceCeiling;
    allocatedDensity = baseInstanceCount / (chunkSizeMeters * chunkSizeMeters);
  }

  return {
    chunkSizeMeters,
    innerEdgeMeters,
    allocatedDensity,
    baseInstanceCount,
    largestStepInstanceCount: Math.round(
      baseInstanceCount * getStepMultiplier(0),
    ),
    instanceCeiling,
  };
}

/** `D(d) = density0 * min(1, fullDensityRadius / d)^2` */
function getLawDensity(distance: number, preset: GrassClipmapPreset): number {
  const ratio =
    preset.fullDensityRadiusMeters /
    Math.max(distance, preset.fullDensityRadiusMeters);
  return preset.tuftsPerSquareMeter * ratio * ratio;
}

function getDensityStepCount(): number {
  const density = GRASS_CLIPMAP_SETTINGS.density;
  return density.stepsUp + density.stepsDown + 1;
}

/** Allocation factor of step `index`; the step at `stepsUp` is one. */
function getStepMultiplier(index: number): number {
  return 4 ** (GRASS_CLIPMAP_SETTINGS.density.stepsUp - index);
}

/**
 * Low-discrepancy distribution of the blades in a chunk. The instance index is
 * bit-reversed and spread across both axes, the way Hammersley and Sobol do
 * it, so every prefix of the sequence is spread evenly over the chunk. That is
 * what makes the instance count a continuous density dial: the blades thin out
 * evenly instead of leaving one edge of the chunk bare.
 */
function createCellAttribute(): {
  readonly attribute: InstancedBufferAttribute;
  readonly maxInstances: number;
} {
  const bits = GRASS_CLIPMAP_SETTINGS.instanceGridBits;
  const side = 1 << bits;
  const total = side * side;
  const data = new Float32Array(total * 3);

  for (let index = 0; index < total; index++) {
    let x = 0;
    let z = 0;
    for (let bit = 0; bit < bits; bit++) {
      x |= ((index >> (2 * bit)) & 1) << (bits - 1 - bit);
      z |= ((index >> (2 * bit + 1)) & 1) << (bits - 1 - bit);
    }
    data[index * 3] = (x + 0.5) / side;
    data[index * 3 + 1] = (z + 0.5) / side;
    // The rank is the normalized index, so "rank < f" stays evenly spread.
    data[index * 3 + 2] = index / total;
  }

  return {
    attribute: new InstancedBufferAttribute(data, 3),
    maxInstances: total,
  };
}

type SharedUniforms = ReturnType<typeof createSharedUniforms>;

function createSharedUniforms(options: GrassClipmapFieldOptions) {
  const { preset } = options;
  const settings = GRASS_CLIPMAP_SETTINGS;
  const lighting = settings.lighting;
  const [sunX, sunY, sunZ] = lighting.sunDirection;

  return {
    uGrassTime: { value: 0 },
    uGrassBladeHeight: { value: preset.bladeHeightMeters },
    uGrassBladeWidth: { value: preset.bladeWidthMeters },
    uGrassMinAngular: { value: settings.blade.minAngularWidth },
    uGrassCurve: { value: settings.blade.curve },
    uGrassWindDirection: { value: new Vector2(1, 0) },
    uGrassWindStrength: { value: 0 },
    uGrassWindSpeed: { value: settings.wind.phaseSpeed },
    uGrassWindScale: { value: settings.wind.phaseScalePerMeter },
    uGrassFadeStart: { value: settings.fade.startMeters },
    uGrassFadeEnd: { value: settings.fade.endMeters },
    uGrassDensityRef: { value: preset.fullDensityRadiusMeters },
    uGrassDissolve: { value: settings.density.dissolve },
    uGrassJitter: { value: settings.density.jitter },
    uGrassDensity0: { value: preset.tuftsPerSquareMeter },
    uGrassFrustum: {
      value: [0, 1, 2, 3].map(() => new Vector4()),
    },
    uGrassCullRadius: { value: settings.cullRadiusMeters },
    uGrassHeightField: { value: options.heightField.texture },
    uGrassHeightPlacement: { value: options.heightField.placement.clone() },
    uGrassHeightRange: { value: options.heightField.range.clone() },
    uGrassSunDirection: {
      value: new Vector3(sunX, sunY, sunZ).normalize(),
    },
    uGrassSunColor: { value: new Color(lighting.sunColor) },
    uGrassSkyColor: { value: new Color(lighting.skyColor) },
    uGrassRootColor: { value: new Color(preset.colors.rootColor) },
    uGrassTipColor: { value: new Color(preset.colors.tipColor) },
    uGrassFogColor: { value: new Color(options.fogColor) },
    uGrassFogDensity: { value: lighting.fogDensity },
    uGrassExposure: { value: lighting.exposure },
    uGrassAmbientOcclusion: { value: lighting.ambientOcclusion },
    uGrassTranslucency: { value: lighting.translucency },
  };
}

/**
 * Feature set per shader tier; distant blades drop what nobody can see.
 *
 * `GRASS_LIT` is off wherever a sense is patched in. Echo Depth replaces the
 * surface color outright and Thermal covers it inside its radius, so the whole
 * lighting block would be computed and then discarded. What stays is the
 * root-to-tip gradient that shows below full sense intensity.
 */
function getTierDefines(tier: number, lit: boolean): Record<string, number> {
  return {
    GRASS_LIT: lit ? 1 : 0,
    GRASS_WIND: 1,
    GRASS_CURVE: 1,
    GRASS_WIND_SIMPLE: tier >= 1 ? 1 : 0,
    GRASS_FLUTTER: tier === 0 ? 1 : 0,
    GRASS_NORMAL_BEND: tier === 0 ? 1 : 0,
    GRASS_SPECULAR: tier === 0 ? 1 : 0,
    GRASS_TRANSLUCENCY: tier <= 1 ? 1 : 0,
  };
}

/**
 * Blade template: `segments` quads plus the tip. `position.x` is the side,
 * `position.y` the height, `position.z` which strip of a cross tuft. The
 * vertex shader needs nothing else.
 */
function createBladeGeometry(
  segments: number,
  cells: InstancedBufferAttribute,
): InstancedBufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  const addStrip = (strip: number): void => {
    const base = positions.length / 3;
    for (let segment = 0; segment < segments; segment++) {
      const height = segment / segments;
      positions.push(-1, height, strip, 1, height, strip);
    }
    positions.push(0, 1, strip);
    for (let segment = 0; segment < segments - 1; segment++) {
      const a = base + 2 * segment;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const last = base + 2 * (segments - 1);
    indices.push(last, base + 2 * segments, last + 1);
  };

  addStrip(0);
  if (GRASS_CLIPMAP_SETTINGS.blade.cross) addStrip(1);

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.setAttribute("aGrassCell", cells);

  return geometry;
}

function createLevel(context: {
  readonly index: number;
  readonly ring: number;
  readonly span: number;
  readonly chunkSizeMeters: number;
  readonly cells: ReturnType<typeof createCellAttribute>;
  readonly shared: SharedUniforms;
  readonly options: GrassClipmapFieldOptions;
}): ClipmapLevel {
  const { index, span, cells, shared, options } = context;
  const settings = GRASS_CLIPMAP_SETTINGS;
  const allocation = getGrassLevelAllocation(index, options.preset);
  const { chunkSizeMeters, innerEdgeMeters, allocatedDensity } = allocation;
  const baseCount = allocation.baseInstanceCount;
  const stepCount = getDensityStepCount();
  const countOfStep = (step: number): number =>
    Math.max(
      16,
      Math.min(
        cells.maxInstances,
        Math.round(baseCount * getStepMultiplier(step)),
      ),
    );

  // The bounding sphere has to hold the whole chunk, not the blade template,
  // or the per-chunk frustum culling is simply wrong.
  const bounds = new Sphere(
    new Vector3(chunkSizeMeters * 0.5, 1, chunkSizeMeters * 0.5),
    chunkSizeMeters * 0.7072 + 5,
  );

  const uGrassChunkSize = { value: chunkSizeMeters };
  // Indexed by detail step, then by density step. All of them are tiny — nine
  // vertices at most — and all sit on the same instance buffer; only the
  // segment count and the instance count differ.
  const geometries = settings.detail.segments.map((segments) =>
    Array.from({ length: stepCount }, (_, step) => {
      const geometry = createBladeGeometry(segments, cells.attribute);
      geometry.instanceCount = countOfStep(step);
      geometry.boundingSphere = bounds;
      return geometry;
    }),
  );

  const stepUniforms = Array.from({ length: stepCount }, (_, step) => ({
    uGrassRankScale: { value: cells.maxInstances / countOfStep(step) },
    // The gain is the base density over the density this step actually
    // allocated, so the rank test yields exactly one at the inner edge.
    uGrassDensityGain: {
      value:
        options.preset.tuftsPerSquareMeter /
        (countOfStep(step) / (chunkSizeMeters * chunkSizeMeters)),
    },
  }));

  // Many material objects but only three programs: three keys its program
  // cache by source and defines, and those differ per tier alone.
  const effects = options.effects ?? [];
  const materials = DEGENERATE_TIERS.map((tier) =>
    Array.from({ length: stepCount }, (_, step) => {
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: DoubleSide,
        defines: getTierDefines(tier, effects.length === 0),
        uniforms: {
          ...shared,
          uGrassChunkSize,
          ...stepUniforms[step],
        },
      });
      // Every tier and step is its own material object, but the patched
      // sources are identical per tier, so three still compiles one program
      // per tier and keys the rest to its cache.
      applyMaterialEffects(effects, material);
      return material;
    }),
  );

  const chunkCount = span * span;
  const chunks: Mesh[] = [];
  const chunkStates: ChunkState[] = [];
  for (let slot = 0; slot < chunkCount; slot++) {
    const mesh = new Mesh(geometries[0]?.[0], materials[0]?.[0]);
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    // Front to back, so the near levels fill the depth buffer first.
    mesh.renderOrder = index;
    chunks.push(mesh);
    chunkStates.push({ detailIndex: -1, densityStep: -1, placed: false });
  }

  return {
    index,
    chunkSizeMeters,
    innerEdgeMeters,
    allocatedDensity,
    geometries,
    materials,
    chunks,
    chunkStates,
    startX: 0,
    startZ: 0,
  };
}

/** The area the next finer level already covers, in world coordinates. */
interface ClipmapHole {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function getInnerHole(
  inner: ClipmapLevel | undefined,
  span: number,
): ClipmapHole | undefined {
  if (!inner) return undefined;

  const size = inner.chunkSizeMeters;
  return {
    minX: inner.startX * size,
    maxX: (inner.startX + span) * size,
    minZ: inner.startZ * size,
    maxZ: (inner.startZ + span) * size,
  };
}

function coversHole(
  hole: ClipmapHole | undefined,
  x: number,
  z: number,
  size: number,
): boolean {
  if (!hole) return false;

  return (
    x >= hole.minX &&
    x + size <= hole.maxX &&
    z >= hole.minZ &&
    z + size <= hole.maxZ
  );
}

function placeChunk(
  level: ClipmapLevel,
  slot: number,
  x: number,
  z: number,
): void {
  const mesh = level.chunks[slot];
  const state = level.chunkStates[slot];
  if (!mesh || !state) return;

  state.placed = true;
  mesh.visible = true;
  mesh.matrix.makeTranslation(x, 0, z);
  mesh.matrixWorldNeedsUpdate = true;
}

function retireChunk(level: ClipmapLevel, slot: number): void {
  const mesh = level.chunks[slot];
  const state = level.chunkStates[slot];
  if (!mesh || !state) return;

  mesh.visible = false;
  state.placed = false;
}

/**
 * Place one level's chunks on its snapped grid, skipping the hole the finer
 * level already fills. The chunks themselves never travel; only which of them
 * exist changes.
 */
function layOutLevel(
  level: ClipmapLevel,
  hole: ClipmapHole | undefined,
  span: number,
): void {
  const size = level.chunkSizeMeters;
  let slot = 0;

  for (let column = 0; column < span; column++) {
    for (let row = 0; row < span; row++) {
      const x = (level.startX + column) * size;
      const z = (level.startZ + row) * size;
      if (coversHole(hole, x, z, size)) continue;

      placeChunk(level, slot, x, z);
      slot++;
    }
  }
  for (; slot < level.chunks.length; slot++) retireChunk(level, slot);
}

function layOutChunks(levels: readonly ClipmapLevel[], span: number): void {
  levels.forEach((level, index) => {
    layOutLevel(level, getInnerHole(levels[index - 1], span), span);
  });
}

/**
 * Distance to the nearest point of the chunk, not to its centre: a large chunk
 * under the camera would otherwise get too little detail although its near
 * edge lies right in front of the viewer.
 */
function getChunkDistance(
  mesh: Mesh,
  chunkSizeMeters: number,
  cameraX: number,
  cameraZ: number,
): number {
  const half = chunkSizeMeters * 0.5;
  const originX = mesh.matrix.elements[12] ?? 0;
  const originZ = mesh.matrix.elements[14] ?? 0;
  const dx = Math.max(0, Math.abs(cameraX - (originX + half)) - half);
  const dz = Math.max(0, Math.abs(cameraZ - (originZ + half)) - half);

  return Math.sqrt(dx * dx + dz * dz);
}

/** Segments per blade, held steady across a threshold by the hysteresis. */
function chooseDetailIndex(distance: number, previous: number): number {
  const detail = GRASS_CLIPMAP_SETTINGS.detail;
  if (!detail.byDistance) return detail.uniformSegmentIndex;

  for (let step = 0; step < detail.switchDistanceMeters.length; step++) {
    const limit =
      (detail.switchDistanceMeters[step] ?? 0) *
      (previous <= step ? detail.hysteresis : 1);
    if (distance < limit) return step;
  }

  return detail.segments.length - 1;
}

/**
 * The smallest allocation that still suffices at the nearest edge, rounded up
 * because the shader can only take blades away, never add them.
 */
function chooseDensityStep(
  distance: number,
  allocatedDensity: number,
  preset: GrassClipmapPreset,
): number {
  const ratio = getLawDensity(distance, preset) / allocatedDensity;
  const steps = GRASS_CLIPMAP_SETTINGS.density;

  return Math.min(
    getDensityStepCount() - 1,
    Math.max(0, steps.stepsUp - Math.ceil(Math.log2(ratio) / 2)),
  );
}

/**
 * Detail and allocation step per placed chunk, from its distance to the
 * camera. A few hundred scalar iterations per frame; swapping geometry and
 * material costs the GPU nothing, it only changes which buffer and which
 * program get bound.
 */
function selectDetail(
  levels: readonly ClipmapLevel[],
  cameraX: number,
  cameraZ: number,
  preset: GrassClipmapPreset,
): void {
  for (const level of levels) {
    level.chunks.forEach((mesh, slot) => {
      const state = level.chunkStates[slot];
      if (!state?.placed) return;

      const distance = getChunkDistance(
        mesh,
        level.chunkSizeMeters,
        cameraX,
        cameraZ,
      );
      // Beyond the fade every blade stands at zero height, so those chunks
      // only produce degenerate triangles. Not drawing them is free.
      const inRange = distance < GRASS_CLIPMAP_SETTINGS.fade.endMeters;
      if (mesh.visible !== inRange) mesh.visible = inRange;
      if (!inRange) return;

      const detailIndex = chooseDetailIndex(distance, state.detailIndex);
      const densityStep = chooseDensityStep(
        distance,
        level.allocatedDensity,
        preset,
      );
      if (
        detailIndex === state.detailIndex &&
        densityStep === state.densityStep
      ) {
        return;
      }

      state.detailIndex = detailIndex;
      state.densityStep = densityStep;
      const geometry = level.geometries[detailIndex]?.[densityStep];
      const tier = Math.max(
        0,
        GRASS_CLIPMAP_SETTINGS.detail.tierOfDetail[detailIndex] ?? 0,
      );
      const material = level.materials[tier]?.[densityStep];
      if (geometry) mesh.geometry = geometry;
      if (material) mesh.material = material;
    });
  }
}
