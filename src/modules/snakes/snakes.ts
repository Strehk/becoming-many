/**
 * Purpose: Crawl the snakes the open ground carries.
 * Context: One pool, one draw call, one travelling wave; no skeleton anywhere.
 * Responsibility: Own the cell window, the ground test, the crawl, and the pool.
 * Boundary: The body is the geometry's, the wave the shader's, the density the definition's.
 */

import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  type Scene,
  Vector3,
} from "three";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import {
  type ChunkCandidate,
  type ChunkCandidateGrid,
  createChunkCandidateGrid,
  getCellRandom,
  getChunkCandidate,
} from "../../world/chunk-candidates";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import { createSnakeGeometry } from "./snake-geometry";
import slitherShader from "./snake-slither.vert.glsl?raw";
import { SNAKES_DEFINITION } from "./snakes-definition";

const SLITHER_CACHE_KEY = "snake-slither-v1";
/*
 * The cell random values one candidate draws. Zero and one are the shared
 * candidate grid's own jitter, so every draw a snake makes starts above them.
 */
const CRAWLING_RANDOM_INDEX = 2;
const HEADING_RANDOM_INDEX = 3;
const LENGTH_RANDOM_INDEX = 4;
const PHASE_RANDOM_INDEX = 5;
const GROUND_RANDOM_INDEX = 6;

const UP_AXIS = new Vector3(0, 1, 0);
/** Reused every frame: one snake's placement is composed, never allocated. */
const PLACEMENT = new Matrix4();
const PLACEMENT_POSITION = new Vector3();
const PLACEMENT_FACING = new Quaternion();
const PLACEMENT_SCALE = new Vector3();

/** How much of its own length a snake swings sideways at the tail. */
const WAVE_AMPLITUDE_SHARE = 0.09;
/** Waves standing in the body at once, and how fast they run down it. */
const WAVE_LENGTHS = 1.35;
const WAVE_SPEED = 0.9;

export interface SnakesPreset {
  /**
   * How many of the places a cell offers carry a snake, 0..1. The ground
   * refuses most of what survives this, so it is the level's one knob on how
   * much snake a landscape holds; how far apart the places stand is the
   * module's, like every other zone-driven population.
   */
  readonly crawlingShare: number;
  /** Skin tone; the senses recolour it from here like any other surface. */
  readonly color: number;
}

export interface SnakesModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: SnakesPreset;
  readonly worldSurface: WorldSurface;
  readonly streamQueue: StreamQueue;
  readonly effects?: readonly UnlitMaterialEffect[];
}

/** One snake's whole way: where it starts, which way it goes, how it looks. */
interface CrawlingSnake {
  readonly startX: number;
  readonly startZ: number;
  readonly headingX: number;
  readonly headingZ: number;
  readonly heading: number;
  readonly lengthMeters: number;
  readonly phase: number;
}

interface SnakesStream {
  readonly chunkWindow: ChunkWindow;
  readonly candidateGrid: ChunkCandidateGrid;
  readonly mesh: InstancedMesh;
  readonly phases: InstancedBufferAttribute;
  /** One list per window slot, so a moved cell regathers only itself. */
  readonly slotSnakes: CrawlingSnake[][];
  /** One stable queue key per slot replaces obsolete pending work. */
  readonly slotJobKeys: readonly object[];
  /** Every slot's snakes in one draw order, rebuilt when a slot changes. */
  readonly crawling: CrawlingSnake[];
  readonly timeUniform: { value: number };
}

interface SnakesState {
  currentStream: SnakesStream | undefined;
  elapsedSeconds: number;
}

/**
 * The authored model was one rigid tube of 57,600 triangles that could only
 * slide. What ships is its girth, rebuilt at 120 triangles, with the wave that
 * carries it running in the vertex shader — so a snake crawls, and a whole
 * pool of them is one draw call.
 */
export function createSnakesModule(options: SnakesModuleOptions): WorldModule {
  const state: SnakesState = { currentStream: undefined, elapsedSeconds: 0 };

  return {
    load: () => loadSnakes(state, options),
    activate: () => setSnakesVisible(state, true),
    update: (deltaSeconds) => updateSnakes(state, options, deltaSeconds),
    deactivate: () => setSnakesVisible(state, false),
    unload: () => unloadSnakes(state, options.scene),
  };
}

function loadSnakes(state: SnakesState, options: SnakesModuleOptions): void {
  const chunkSize = getChunkSize(SNAKES_DEFINITION.chunkLevel);
  const radius = Math.max(
    1,
    Math.ceil(options.viewpoint.viewDistanceMeters / chunkSize),
  );
  const chunkWindow = new ChunkWindow({
    level: SNAKES_DEFINITION.chunkLevel,
    radius,
  });
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    SNAKES_DEFINITION.candidateSpacingMeters,
  );
  const capacity = chunkWindow.slotCount * candidateGrid.candidateCount;

  const timeUniform = { value: 0 };
  const geometry = createSnakeGeometry();
  const material = createSnakeMaterial(options, timeUniform);
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = "Snakes";
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  mesh.visible = false;
  // The pool follows the traveller, so its bounds change with every crawl.
  mesh.frustumCulled = false;

  const phases = new InstancedBufferAttribute(new Float32Array(capacity), 1);
  phases.setUsage(DynamicDrawUsage);
  geometry.setAttribute("snakePhase", phases);
  options.scene.add(mesh);

  const stream: SnakesStream = {
    chunkWindow,
    candidateGrid,
    mesh,
    phases,
    slotSnakes: Array.from({ length: chunkWindow.slotCount }, () => []),
    slotJobKeys: Array.from({ length: chunkWindow.slotCount }, () => ({})),
    crawling: [],
    timeUniform,
  };
  state.currentStream = stream;

  // Loading happens before the first render, so the whole window is gathered
  // here: a snake is on the ground the moment it may be seen rather than at
  // the origin for one frame. Every later cell goes through the frame budget.
  const initialAssignments = chunkWindow.update(
    options.viewpoint.worldPosition.x,
    options.viewpoint.worldPosition.z,
  );
  for (const assignment of initialAssignments) {
    gatherCellSnakes(stream, options, assignment);
  }
  collectSnakes(stream);
  placeSnakes(stream, options, 0);
}

function updateSnakes(
  state: SnakesState,
  options: SnakesModuleOptions,
  deltaSeconds: number,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.elapsedSeconds += deltaSeconds;
  stream.timeUniform.value = state.elapsedSeconds;

  // Most frames return no assignments. After a boundary crossing, only the
  // recycled edge enters the shared frame-budgeted queue: a slot keeps the
  // snakes it already carries until its own job replaces them.
  for (const assignment of stream.chunkWindow.update(
    options.viewpoint.worldPosition.x,
    options.viewpoint.worldPosition.z,
  )) {
    const job = createCellGatherJob(state, stream, options, assignment);
    if (job && options.streamQueue.enqueue(job)) continue;

    // One cell is cheap to gather synchronously. Keeping coverage is
    // preferable if the queue reaches its defensive capacity.
    gatherCellSnakes(stream, options, assignment);
    collectSnakes(stream);
  }

  placeSnakes(stream, options, state.elapsedSeconds);
}

function createCellGatherJob(
  state: SnakesState,
  stream: SnakesStream,
  options: SnakesModuleOptions,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const jobKey = stream.slotJobKeys[assignment.slotIndex];
  if (!jobKey) return undefined;

  return {
    key: jobKey,

    // The traveller may cross another boundary before this job runs. Both
    // checks keep delayed work out of an unloaded or reassigned slot.
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),

    runStep: () => {
      gatherCellSnakes(stream, options, assignment);
      collectSnakes(stream);
      return true;
    },
  };
}

/**
 * Draw the ways one cell holds. A place is offered by the shared candidate
 * grid and answered by the ground: the whole way must stay in open country,
 * and stay level enough that a body lying on it is not half buried in a bank.
 */
function gatherCellSnakes(
  stream: SnakesStream,
  options: SnakesModuleOptions,
  assignment: ChunkAssignment,
): void {
  const cellSnakes = stream.slotSnakes[assignment.slotIndex];
  if (!cellSnakes) return;

  cellSnakes.length = 0;
  for (
    let candidateIndex = 0;
    candidateIndex < stream.candidateGrid.candidateCount;
    candidateIndex += 1
  ) {
    const candidate = getChunkCandidate(
      assignment,
      stream.candidateGrid,
      SNAKES_DEFINITION.seed,
      candidateIndex,
    );
    const snake = readCrawlingSnake(candidate, options);
    if (snake) cellSnakes.push(snake);
  }
}

/** The snake one offered place carries, or nothing where it carries none. */
function readCrawlingSnake(
  candidate: ChunkCandidate,
  options: SnakesModuleOptions,
): CrawlingSnake | undefined {
  const draw = (valueIndex: number): number =>
    getCellRandom(
      SNAKES_DEFINITION.seed,
      candidate.cellX,
      candidate.cellZ,
      valueIndex,
    );

  // Its own value: sharing one with the phase would leave every snake that
  // survived the refusal crawling in step with its neighbours. Drawn before
  // the ground is read, so a place nothing carries costs no surface samples.
  if (draw(CRAWLING_RANDOM_INDEX) >= options.preset.crawlingShare) {
    return undefined;
  }

  const heading = draw(HEADING_RANDOM_INDEX) * Math.PI * 2;
  const headingX = Math.sin(heading);
  const headingZ = Math.cos(heading);
  const groundWeight = readGroundWeight(
    candidate.worldX,
    candidate.worldZ,
    headingX,
    headingZ,
    options.worldSurface,
  );
  // The weakest ground the way crosses decides it, so a crossing is never
  // accepted on the strength of the end it started at.
  if (groundWeight <= 0 || draw(GROUND_RANDOM_INDEX) >= groundWeight) {
    return undefined;
  }

  const { minimum, maximum } = SNAKES_DEFINITION.lengthMeters;
  return {
    startX: candidate.worldX,
    startZ: candidate.worldZ,
    headingX,
    headingZ,
    heading,
    lengthMeters: minimum + draw(LENGTH_RANDOM_INDEX) * (maximum - minimum),
    phase: draw(PHASE_RANDOM_INDEX),
  };
}

/** Lay the gathered cells into one draw order and publish their phases. */
function collectSnakes(stream: SnakesStream): void {
  stream.crawling.length = 0;
  for (const cellSnakes of stream.slotSnakes) {
    for (const snake of cellSnakes) stream.crawling.push(snake);
  }

  for (const [index, snake] of stream.crawling.entries()) {
    stream.phases.setX(index, snake.phase);
  }
  stream.phases.needsUpdate = true;
}

/** Carry every snake along its way and lay it back down on the ground. */
function placeSnakes(
  stream: SnakesStream,
  options: SnakesModuleOptions,
  elapsedSeconds: number,
): void {
  const { crawlSpeedMetersPerSecond, crawlDistanceMeters } = SNAKES_DEFINITION;

  for (const [index, snake] of stream.crawling.entries()) {
    // The way is walked and started again, so a snake never crawls out of the
    // country its place was accepted in.
    const travelled =
      (elapsedSeconds * crawlSpeedMetersPerSecond + snake.phase * 17) %
      crawlDistanceMeters;
    const headX = snake.startX + snake.headingX * travelled;
    const headZ = snake.startZ + snake.headingZ * travelled;

    PLACEMENT_POSITION.set(
      headX,
      options.worldSurface.groundYAt(headX, headZ) +
        SNAKES_DEFINITION.bodyRadiusMeters,
      headZ,
    );
    PLACEMENT_FACING.setFromAxisAngle(UP_AXIS, snake.heading + Math.PI);
    // The body is authored at unit length; its girth is authored in metres.
    PLACEMENT_SCALE.set(
      SNAKES_DEFINITION.bodyRadiusMeters,
      SNAKES_DEFINITION.bodyRadiusMeters,
      snake.lengthMeters,
    );
    PLACEMENT.compose(PLACEMENT_POSITION, PLACEMENT_FACING, PLACEMENT_SCALE);
    stream.mesh.setMatrixAt(index, PLACEMENT);
  }

  stream.mesh.count = stream.crawling.length;
  stream.mesh.instanceMatrix.needsUpdate = true;
}

/**
 * How readily this way carries a body, or zero when it refuses one: every
 * step of it on ground that carries snakes at all, and the ground never
 * falling further than one can follow. The weakest ground along the way is
 * what the whole way is worth.
 */
function readGroundWeight(
  startX: number,
  startZ: number,
  headingX: number,
  headingZ: number,
  worldSurface: WorldSurface,
): number {
  const steps = 4;
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  let weakest = 1;

  for (let step = 0; step <= steps; step += 1) {
    const along = (step / steps) * SNAKES_DEFINITION.crawlDistanceMeters;
    const worldX = startX + headingX * along;
    const worldZ = startZ + headingZ * along;
    const zone = worldSurface.zoneAt(worldX, worldZ);
    const weight = SNAKES_DEFINITION.zoneWeights[zone] ?? 0;
    if (weight <= 0) return 0;
    weakest = Math.min(weakest, weight);

    const groundY = worldSurface.groundYAt(worldX, worldZ);
    lowest = Math.min(lowest, groundY);
    highest = Math.max(highest, groundY);
  }
  if (highest - lowest > SNAKES_DEFINITION.maximumGroundFallMeters) return 0;

  return weakest;
}

function createSnakeMaterial(
  options: SnakesModuleOptions,
  timeUniform: { value: number },
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: options.preset.color });
  material.name = "snake-skin";
  applyMaterialEffects(options.effects ?? [], material);
  applyShaderPatch(material, {
    cacheKey: SLITHER_CACHE_KEY,
    uniforms: {
      snakeTime: timeUniform,
      snakeWaveLengths: { value: WAVE_LENGTHS },
      snakeWaveSpeed: { value: WAVE_SPEED },
      // The body is built at unit length but drawn at its girth across, so a
      // swing authored as a share of the snake has to be carried back into
      // the radii the sideways axis is scaled by.
      snakeWaveAmplitude: { value: readWaveAmplitude() },
    },
    vertexHeader: slitherShader,
    vertexAnchor: "#include <begin_vertex>",
    vertexCall: "transformed = applySnakeSlither(transformed);",
    fragmentHeader: "",
    colorFragmentCall: "",
  });
  return material;
}

/** The sideways swing in body radii, which is what the local axis measures. */
function readWaveAmplitude(): number {
  const { lengthMeters, bodyRadiusMeters } = SNAKES_DEFINITION;
  const middleLength = (lengthMeters.minimum + lengthMeters.maximum) / 2;
  return (WAVE_AMPLITUDE_SHARE * middleLength) / bodyRadiusMeters;
}

function setSnakesVisible(state: SnakesState, visible: boolean): void {
  if (state.currentStream) state.currentStream.mesh.visible = visible;
}

function unloadSnakes(state: SnakesState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  // Clear the reference first so pending queue jobs immediately become stale.
  state.currentStream = undefined;
  scene.remove(stream.mesh);
  stream.mesh.geometry.dispose();
  const materials = Array.isArray(stream.mesh.material)
    ? stream.mesh.material
    : [stream.mesh.material];
  for (const material of materials) material.dispose();
  stream.mesh.dispose();
}
