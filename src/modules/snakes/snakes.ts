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
import { getCellRandom } from "../../world/chunk-candidates";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import { createSnakeGeometry } from "./snake-geometry";
import slitherShader from "./snake-slither.vert.glsl?raw";
import { SNAKES_DEFINITION } from "./snakes-definition";

const SLITHER_CACHE_KEY = "snake-slither-v1";
const RANDOM_VALUES_PER_CANDIDATE = 7;
const RANDOM_OFFSET_X = 0;
const RANDOM_OFFSET_Z = 1;
const RANDOM_LENGTH = 2;
const RANDOM_HEADING = 3;
const RANDOM_PHASE = 4;
const RANDOM_CRAWLS = 5;
const RANDOM_GROUND = 6;

const UP = new Vector3(0, 1, 0);
/*
 * How far into its own square a candidate may be jittered. Keeping a margin
 * at the edges is what stops two snakes of neighbouring squares from meeting
 * at the line between them.
 */
const JITTER_EDGE = 0.2;
const JITTER_SPAN = 0.6;
/** How much of its own length a snake swings sideways at the tail. */
const WAVE_AMPLITUDE_SHARE = 0.09;
/** Waves standing in the body at once, and how fast they run down it. */
const WAVE_LENGTHS = 1.35;
const WAVE_SPEED = 0.9;

export interface SnakesPreset {
  /**
   * How many places one 64-metre cell offers. The ground refuses most of
   * them, so this is the coarse knob on how much snake a landscape holds and
   * the crawling share is the fine one.
   */
  readonly candidatesPerCell: number;
  /** How many of the offered places carry a snake, 0..1. */
  readonly crawlingShare: number;
  /** Skin tone; the senses recolour it from here like any other surface. */
  readonly color: number;
}

export interface SnakesModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: SnakesPreset;
  readonly worldSurface: WorldSurface;
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
  readonly mesh: InstancedMesh;
  readonly phases: InstancedBufferAttribute;
  readonly cells: (ChunkAssignment | undefined)[];
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
  const capacity = chunkWindow.slotCount * options.preset.candidatesPerCell;

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
    mesh,
    phases,
    cells: Array.from({ length: chunkWindow.slotCount }, () => undefined),
    crawling: [],
    timeUniform,
  };
  state.currentStream = stream;
  rememberCells(
    stream,
    chunkWindow.update(
      options.viewpoint.worldPosition.x,
      options.viewpoint.worldPosition.z,
    ),
  );
  gatherSnakes(stream, options);
  // Placed before the first frame, so a snake is on the ground the moment it
  // may be seen rather than at the origin for one frame.
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

  const changed = stream.chunkWindow.update(
    options.viewpoint.worldPosition.x,
    options.viewpoint.worldPosition.z,
  );
  if (changed.length > 0) {
    rememberCells(stream, changed);
    gatherSnakes(stream, options);
  }
  placeSnakes(stream, options, state.elapsedSeconds);
}

/**
 * Draw the ways the window now holds. A place is offered by a cell and
 * answered by the ground: the whole way must stay in open country, and stay
 * level enough that a body lying on it is not half buried in a bank.
 */
function gatherSnakes(
  stream: SnakesStream,
  options: SnakesModuleOptions,
): void {
  const chunkSize = stream.chunkWindow.chunkSize;
  stream.crawling.length = 0;

  for (const cell of stream.cells) {
    if (!cell) continue;

    for (
      let candidate = 0;
      candidate < options.preset.candidatesPerCell;
      candidate += 1
    ) {
      const channel = candidate * RANDOM_VALUES_PER_CANDIDATE;
      const draw = (valueIndex: number): number =>
        getCellRandom(
          SNAKES_DEFINITION.seed,
          cell.chunkX,
          cell.chunkZ,
          channel + valueIndex,
        );

      // Its own channel: sharing one with the phase would leave every snake
      // that survived the refusal crawling in step with its neighbours.
      if (draw(RANDOM_CRAWLS) >= options.preset.crawlingShare) continue;

      // Each candidate keeps its own square of the cell and is jittered
      // inside it. Drawing freely across the whole cell let a dozen snakes
      // land on top of each other while the rest of it stayed empty.
      const lattice = Math.ceil(Math.sqrt(options.preset.candidatesPerCell));
      const squareSize = chunkSize / lattice;
      const squareX = candidate % lattice;
      const squareZ = Math.floor(candidate / lattice);
      const startX =
        cell.originX +
        (squareX + JITTER_EDGE + draw(RANDOM_OFFSET_X) * JITTER_SPAN) *
          squareSize;
      const startZ =
        cell.originZ +
        (squareZ + JITTER_EDGE + draw(RANDOM_OFFSET_Z) * JITTER_SPAN) *
          squareSize;
      const heading = draw(RANDOM_HEADING) * Math.PI * 2;
      const headingX = Math.sin(heading);
      const headingZ = Math.cos(heading);
      const groundWeight = readGroundWeight(
        startX,
        startZ,
        headingX,
        headingZ,
        options.worldSurface,
      );
      // The weakest ground the way crosses decides it, so a crossing is never
      // accepted on the strength of the end it started at.
      if (groundWeight <= 0 || draw(RANDOM_GROUND) >= groundWeight) continue;

      const { minimum, maximum } = SNAKES_DEFINITION.lengthMeters;
      stream.crawling.push({
        startX,
        startZ,
        headingX,
        headingZ,
        heading,
        lengthMeters: minimum + draw(RANDOM_LENGTH) * (maximum - minimum),
        phase: draw(RANDOM_PHASE),
      });
    }
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
  const placement = new Matrix4();
  const position = new Vector3();
  const facing = new Quaternion();
  const scale = new Vector3();
  const { crawlSpeedMetersPerSecond, crawlDistanceMeters } = SNAKES_DEFINITION;

  for (const [index, snake] of stream.crawling.entries()) {
    // The way is walked and started again, so a snake never crawls out of the
    // country its place was accepted in.
    const travelled =
      (elapsedSeconds * crawlSpeedMetersPerSecond + snake.phase * 17) %
      crawlDistanceMeters;
    const headX = snake.startX + snake.headingX * travelled;
    const headZ = snake.startZ + snake.headingZ * travelled;

    position.set(
      headX,
      options.worldSurface.groundYAt(headX, headZ) +
        SNAKES_DEFINITION.bodyRadiusMeters,
      headZ,
    );
    facing.setFromAxisAngle(UP, snake.heading + Math.PI);
    // The body is authored at unit length; its girth is authored in metres.
    scale.set(
      SNAKES_DEFINITION.bodyRadiusMeters,
      SNAKES_DEFINITION.bodyRadiusMeters,
      snake.lengthMeters,
    );
    placement.compose(position, facing, scale);
    stream.mesh.setMatrixAt(index, placement);
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

function rememberCells(
  stream: SnakesStream,
  changed: readonly ChunkAssignment[],
): void {
  for (const assignment of changed) {
    stream.cells[assignment.slotIndex] = assignment;
  }
}

function setSnakesVisible(state: SnakesState, visible: boolean): void {
  if (state.currentStream) state.currentStream.mesh.visible = visible;
}

function unloadSnakes(state: SnakesState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.currentStream = undefined;
  scene.remove(stream.mesh);
  stream.mesh.geometry.dispose();
  const materials = Array.isArray(stream.mesh.material)
    ? stream.mesh.material
    : [stream.mesh.material];
  for (const material of materials) material.dispose();
  stream.mesh.dispose();
}
