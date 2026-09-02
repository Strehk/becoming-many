/**
 * Purpose: Create the Connections sense: the pulsing root system in the opened soil.
 * Context: The final level reveals relationships between the already perceived world elements.
 * Responsibility: Validate parameters, share uniforms, stream chunk gathering, own the worker.
 * Boundary: Anchor providers stay in their modules; topology math stays worker-side and pure.
 *
 * Two windows, and the reason is the pop. The gather window keeps one ring more
 * ground than the build window draws, so every chunk that gets cords has all
 * eight neighbours resident and is therefore built once, completely, from data
 * that is a pure function of its world coordinates. A chunk already on screen is
 * consequently never rebuilt into something different — walking only ever adds
 * ground at the rim, and that new ground fades in.
 */

import { Color, type PerspectiveCamera, type Scene } from "three";
import { isNormalized, isPositiveFinite } from "../../utils/number-ranges";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import {
  type StreamJob,
  type StreamQueue,
  SURFACE_STREAM_PRIORITY,
} from "../../world/stream-queue";
import type { WorldSurface } from "../../world-surface/world-surface";
import type {
  ConnectionActorSource,
  ConnectionNodeSource,
  ConnectionSourceClass,
} from "../connection-nodes";
import type { TerrainMaterialEffect } from "../terrain/terrain-geometry";
import {
  type ConnectionsParameters,
  MYCELIUM_SETTINGS,
} from "./mycelium-settings";
import {
  type ConnectionWeb,
  createConnectionWeb,
  disposeConnectionWeb,
  getNodeSlotOffset,
  updateAnimalLinks,
  type WebSourceStyle,
  writeSlotEdges,
  writeSlotNodes,
} from "./network-web";
import { createSoilNodeSource } from "./soil-nodes";
import { createSoilOpening, type GroundCoverSampler } from "./soil-opening";
import {
  type ConnectionTopologyResult,
  createTopologyWorkerPort,
  type TopologyPort,
} from "./topology-messages";

export type { ConnectionsParameters } from "./mycelium-settings";

const ANIMAL_CLASS_INDEX = 2;
const COMPONENTS_PER_VALUE = 3;

/** Fixed class order mapping packed class indices to preset styles. */
const SOURCE_CLASS_ORDER: readonly ConnectionSourceClass[] = [
  "vegetation",
  "scentEmitters",
  "animals",
  "rocks",
  "soil",
];

/** Chebyshev offsets of one chunk and its eight neighbours. */
const NEIGHBOUR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export interface ConnectionsOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly streamQueue: StreamQueue;
  /** Ground the module seeds its own soil points against. */
  readonly worldSurface: WorldSurface;
  /** Wired by the composition root for every enabled static source class. */
  readonly staticSources: readonly ConnectionNodeSource[];
  /** Live animal positions; present only when animals participate. */
  readonly animalSource?: ConnectionActorSource;
  /**
   * How much of the ground something else already grows on. Wired by the
   * composition root from whatever covers this level's surface, so the
   * opening never re-derives another module's zones.
   */
  readonly groundCoverAt: GroundCoverSampler;
  /** Test seam; defaults to the real module-owned worker. */
  readonly createTopologyPort?: () => TopologyPort;
}

/** The CPU mirror of the node pool, laid out slot by slot like the GPU side. */
interface NodeStaging {
  readonly positions: Float32Array;
  readonly weights: Float32Array;
  readonly classIndices: Uint8Array;
  /** Nodes actually written per gather slot. */
  readonly slotNodeCounts: Int32Array;
  /** The chunk each gather slot's nodes belong to, once its gather finished. */
  readonly gatheredChunkX: Int32Array;
  readonly gatheredChunkZ: Int32Array;
  readonly isGathered: Uint8Array;
}

interface WebStream {
  readonly staging: NodeStaging;
  readonly gatherWindow: ChunkWindow;
  readonly buildWindow: ChunkWindow;
  readonly web: ConnectionWeb;
  readonly topologyPort: TopologyPort;
  /** One stable stream-job key per gather slot, as the grass field keeps. */
  readonly slotJobKeys: readonly object[];
  /** The assignment each build slot is waiting to have topology for. */
  readonly buildAssignments: (ChunkAssignment | undefined)[];
  /** 1 while a build slot still needs its topology request posted. */
  readonly buildPending: Uint8Array;
}

interface MyceliumState {
  currentStream: WebStream | undefined;
  /** Unwrapped seconds since load; the fade-in stamps against this. */
  clockSeconds: number;
}

/** The module beside its runtime sense driver and the ground it opens. */
export interface ConnectionsModuleHandle {
  readonly module: WorldModule;
  /** Drive the sense strength at runtime; cords, nodes, and soil share the value. */
  readonly setIntensity: (intensity: number) => void;
  /**
   * The ground opening, applied by the composition root to the terrain
   * material. Without it the web renders correctly and stays buried.
   */
  readonly terrain: TerrainMaterialEffect;
}

/** Create the Connections web world module. */
export function createConnectionsModule(
  parameters: ConnectionsParameters,
  options: ConnectionsOptions,
): ConnectionsModuleHandle {
  validateConnectionsParameters(parameters);
  const timeUniform = { value: 0 };
  const clockUniform = { value: 0 };
  const intensityUniform = { value: parameters.intensity };
  const uniforms = {
    connectionsTime: timeUniform,
    connectionsClock: clockUniform,
    connectionsIntensity: intensityUniform,
    connectionsWebRadius: { value: parameters.webRadiusMeters },
    connectionsWebFadeBand: { value: MYCELIUM_SETTINGS.webFadeBandMeters },
    connectionsPulseSpeed: { value: parameters.pulseSpeedMetersPerSecond },
    connectionsPulseLength: { value: MYCELIUM_SETTINGS.pulseLengthFraction },
    connectionsEdgeBaseWidth: { value: MYCELIUM_SETTINGS.edgeBaseWidthMeters },
    connectionsEdgeWidthSpan: {
      value: MYCELIUM_SETTINGS.edgeWeightWidthSpanMeters,
    },
    connectionsFilamentWidth: {
      value: MYCELIUM_SETTINGS.filamentWidthFraction,
    },
    connectionsWobbleAmplitude: {
      value: MYCELIUM_SETTINGS.wobbleAmplitudeMeters,
    },
    connectionsKnotSpacing: { value: MYCELIUM_SETTINGS.knotSpacingMeters },
    connectionsGrowthNearDistance: {
      value: MYCELIUM_SETTINGS.growthNearDistanceMeters,
    },
    connectionsGrowthFarFraction: {
      value: MYCELIUM_SETTINGS.growthFarFraction,
    },
    connectionsEdgeFade: { value: MYCELIUM_SETTINGS.edgeFadeSeconds },
    connectionsNodeBaseSize: { value: MYCELIUM_SETTINGS.nodeBaseSizeMeters },
    connectionsNodePixelScale: { value: MYCELIUM_SETTINGS.nodePixelScale },
    connectionsDepthColor: { value: new Color(parameters.colors.depthColor) },
    connectionsPulseColor: { value: new Color(parameters.colors.pulseColor) },
  };
  const styles = createSourceStyles(parameters);
  const soilOpening = createSoilOpening(
    intensityUniform,
    options.groundCoverAt,
  );
  // The soil mat is the module's own content, not another module's, so it is
  // appended here rather than wired by the composition root. An unstyled soil
  // class drops out in the gather loop and no points are ever placed.
  const gatherOptions: ConnectionsOptions = {
    ...options,
    staticSources: [
      ...options.staticSources,
      createSoilNodeSource(options.worldSurface),
    ],
  };
  const state: MyceliumState = { currentStream: undefined, clockSeconds: 0 };

  return {
    module: {
      load: () => loadWeb(state, styles, uniforms, gatherOptions),
      activate: () => setWebVisible(state, true),
      update: (deltaSeconds) => {
        state.clockSeconds += deltaSeconds;
        clockUniform.value = state.clockSeconds;
        timeUniform.value =
          (timeUniform.value + deltaSeconds) %
          MYCELIUM_SETTINGS.animationLoopSeconds;
        updateWeb(state, styles, gatherOptions);
      },
      deactivate: () => setWebVisible(state, false),
      unload: () => unloadWeb(state, options.scene),
    },
    setIntensity: (intensity) => {
      intensityUniform.value = intensity;
    },
    terrain: soilOpening,
  };
}

function loadWeb(
  state: MyceliumState,
  styles: readonly (WebSourceStyle | undefined)[],
  uniforms: Record<string, { value: unknown }>,
  options: ConnectionsOptions,
): void {
  const gatherWindow = new ChunkWindow({
    level: MYCELIUM_SETTINGS.chunkLevel,
    radius: MYCELIUM_SETTINGS.gatherChunkRadius,
  });
  const buildWindow = new ChunkWindow({
    level: MYCELIUM_SETTINGS.chunkLevel,
    radius: MYCELIUM_SETTINGS.buildChunkRadius,
  });
  const web = createConnectionWeb(uniforms, {
    gatherSlotCount: gatherWindow.slotCount,
    buildSlotCount: buildWindow.slotCount,
  });
  web.edges.frustumCulled = false;
  web.nodes.frustumCulled = false;
  web.edges.visible = false;
  web.nodes.visible = false;
  // Ahead of the opened ground, which joins the transparent pass at the
  // default order: the mat is drawn first and the soil blends over it, which is
  // what puts the roots underneath the surface rather than on it. Opaque
  // content — trees, rocks, animals, and the grass blades that weaken the mat
  // under a lawn — still occludes the web through ordinary depth testing,
  // because it was drawn before either of them.
  web.edges.renderOrder = MYCELIUM_SETTINGS.webRenderOrder;
  web.nodes.renderOrder = MYCELIUM_SETTINGS.webRenderOrder;
  options.scene.add(web.edges);
  options.scene.add(web.nodes);

  const topologyPort = options.createTopologyPort
    ? options.createTopologyPort()
    : createTopologyWorkerPort();
  const staging = createNodeStaging(gatherWindow.slotCount);
  const stream: WebStream = {
    staging,
    gatherWindow,
    buildWindow,
    web,
    topologyPort,
    slotJobKeys: Array.from({ length: gatherWindow.slotCount }, () => ({})),
    buildAssignments: Array.from({ length: buildWindow.slotCount }),
    buildPending: new Uint8Array(buildWindow.slotCount),
  };
  topologyPort.setResultHandler((result) =>
    publishTopologyResult(state, styles, result),
  );
  state.currentStream = stream;

  // The first window fills synchronously like the other streamed modules; the
  // first cords appear when the worker replies a few frames later.
  const { x, z } = options.camera.position;
  for (const assignment of gatherWindow.update(x, z)) {
    gatherSlot(stream, staging, styles, options, assignment);
  }
  for (const assignment of buildWindow.update(x, z)) {
    stream.buildAssignments[assignment.slotIndex] = assignment;
    stream.buildPending[assignment.slotIndex] = 1;
  }
  postReadyBuilds(stream, staging);
}

function updateWeb(
  state: MyceliumState,
  styles: readonly (WebSourceStyle | undefined)[],
  options: ConnectionsOptions,
): void {
  const stream = state.currentStream;
  if (!stream) return;
  const { staging } = stream;

  const { x, z } = options.camera.position;
  for (const assignment of stream.gatherWindow.update(x, z)) {
    staging.isGathered[assignment.slotIndex] = 0;
    options.streamQueue.enqueue(
      createGatherJob(stream, staging, styles, options, assignment),
    );
  }
  for (const assignment of stream.buildWindow.update(x, z)) {
    stream.buildAssignments[assignment.slotIndex] = assignment;
    stream.buildPending[assignment.slotIndex] = 1;
  }
  postReadyBuilds(stream, staging);

  const animalStyle = styles[ANIMAL_CLASS_INDEX];
  if (options.animalSource && animalStyle) {
    updateAnimalLinks(
      stream.web,
      options.animalSource.getWorldPositions(),
      animalStyle,
      state.clockSeconds,
    );
  }
}

/**
 * One job per slot, keyed by that slot: re-entering the same slot replaces the
 * pending gather, so rapid boundary crossings collapse into the latest state.
 */
function createGatherJob(
  stream: WebStream,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  options: ConnectionsOptions,
  assignment: ChunkAssignment,
): StreamJob {
  return {
    key: stream.slotJobKeys[assignment.slotIndex] ?? {},
    // The surface priority, shared with Terrain. On the default priority the
    // queue runs surface work first and the mat not at all while it lasts, so
    // entering ground arrived after the visitor had already walked onto it.
    priority: SURFACE_STREAM_PRIORITY,
    isCurrent: () => stream.gatherWindow.isCurrent(assignment),
    runStep: () => {
      gatherSlot(stream, staging, styles, options, assignment);
      return true;
    },
  };
}

/** Write one chunk's anchors into its own node range, GPU side and mirror. */
function gatherSlot(
  stream: WebStream,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  options: ConnectionsOptions,
  assignment: ChunkAssignment,
): void {
  const { nodeSlotCapacity } = MYCELIUM_SETTINGS;
  const chunkSize = getChunkSize(MYCELIUM_SETTINGS.chunkLevel);
  const firstNode = getNodeSlotOffset(assignment.slotIndex);
  let nodeCount = 0;
  let droppedAnchorCount = 0;

  for (const source of options.staticSources) {
    const classIndex = SOURCE_CLASS_ORDER.indexOf(source.sourceClass);
    const style = classIndex >= 0 ? styles[classIndex] : undefined;
    if (classIndex < 0 || !style) continue;
    // Soil points are placed at their own depth; everything else stands on the
    // ground and meets the mat just below its own footing.
    const anchorDepth =
      source.sourceClass === "soil"
        ? 0
        : MYCELIUM_SETTINGS.surfaceRootDepthMeters;
    source.appendChunkAnchors(
      assignment.chunkX,
      assignment.chunkZ,
      chunkSize,
      (x, y, z) => {
        if (nodeCount >= nodeSlotCapacity) {
          droppedAnchorCount += 1;
          return;
        }
        const offset = (firstNode + nodeCount) * COMPONENTS_PER_VALUE;
        staging.positions[offset] = x;
        staging.positions[offset + 1] = y - anchorDepth;
        staging.positions[offset + 2] = z;
        staging.classIndices[firstNode + nodeCount] = classIndex;
        staging.weights[firstNode + nodeCount] = style.weight;
        nodeCount += 1;
      },
    );
  }

  if (droppedAnchorCount > 0) {
    console.warn(
      `Connections web dropped ${droppedAnchorCount} anchors beyond one chunk's node capacity`,
    );
  }

  staging.slotNodeCounts[assignment.slotIndex] = nodeCount;
  staging.gatheredChunkX[assignment.slotIndex] = assignment.chunkX;
  staging.gatheredChunkZ[assignment.slotIndex] = assignment.chunkZ;
  staging.isGathered[assignment.slotIndex] = 1;

  writeSlotNodes(
    stream.web,
    assignment.slotIndex,
    staging.positions.subarray(
      firstNode * COMPONENTS_PER_VALUE,
      (firstNode + nodeCount) * COMPONENTS_PER_VALUE,
    ),
    staging.classIndices.subarray(firstNode, firstNode + nodeCount),
    nodeCount,
    styles,
  );
}

/** Post every build slot whose own chunk and eight neighbours are gathered. */
function postReadyBuilds(stream: WebStream, staging: NodeStaging): void {
  for (let slot = 0; slot < stream.buildPending.length; slot += 1) {
    if (stream.buildPending[slot] !== 1) continue;
    const assignment = stream.buildAssignments[slot];
    if (!assignment) continue;
    const ownSlot = readySlotFor(
      stream,
      staging,
      assignment.chunkX,
      assignment.chunkZ,
    );
    if (ownSlot < 0) continue;

    const haloSlots: number[] = [];
    let haloReady = true;
    for (const [offsetX, offsetZ] of NEIGHBOUR_OFFSETS) {
      const slotIndex = readySlotFor(
        stream,
        staging,
        assignment.chunkX + offsetX,
        assignment.chunkZ + offsetZ,
      );
      if (slotIndex < 0) {
        haloReady = false;
        break;
      }
      haloSlots.push(slotIndex);
    }
    if (!haloReady) continue;

    stream.topologyPort.postRequest({
      buildSlotIndex: slot,
      revision: assignment.revision,
      own: collectSlotNodes(staging, [ownSlot]),
      halo: collectSlotNodes(staging, haloSlots),
      neighborsPerNode: MYCELIUM_SETTINGS.neighborsPerNode,
      edgeCapacity: MYCELIUM_SETTINGS.edgeSlotCapacity,
    });
    stream.buildPending[slot] = 0;
  }
}

/** The gather slot holding this chunk with current nodes, or -1. */
function readySlotFor(
  stream: WebStream,
  staging: NodeStaging,
  chunkX: number,
  chunkZ: number,
): number {
  const slotIndex = stream.gatherWindow.slotIndexFor(chunkX, chunkZ);
  if (staging.isGathered[slotIndex] !== 1) return -1;
  if (staging.gatheredChunkX[slotIndex] !== chunkX) return -1;
  if (staging.gatheredChunkZ[slotIndex] !== chunkZ) return -1;
  return slotIndex;
}

/** Copy the given slots' nodes into fresh transferable buffers. */
function collectSlotNodes(
  staging: NodeStaging,
  slotIndices: readonly number[],
): {
  positions: Float32Array;
  weights: Float32Array;
  classIndices: Uint8Array;
  nodeCount: number;
} {
  let nodeCount = 0;
  for (const slotIndex of slotIndices) {
    nodeCount += staging.slotNodeCounts[slotIndex] ?? 0;
  }

  const positions = new Float32Array(nodeCount * COMPONENTS_PER_VALUE);
  const weights = new Float32Array(nodeCount);
  const classIndices = new Uint8Array(nodeCount);
  let written = 0;
  for (const slotIndex of slotIndices) {
    const slotCount = staging.slotNodeCounts[slotIndex] ?? 0;
    const firstNode = getNodeSlotOffset(slotIndex);
    positions.set(
      staging.positions.subarray(
        firstNode * COMPONENTS_PER_VALUE,
        (firstNode + slotCount) * COMPONENTS_PER_VALUE,
      ),
      written * COMPONENTS_PER_VALUE,
    );
    weights.set(
      staging.weights.subarray(firstNode, firstNode + slotCount),
      written,
    );
    classIndices.set(
      staging.classIndices.subarray(firstNode, firstNode + slotCount),
      written,
    );
    written += slotCount;
  }

  return { positions, weights, classIndices, nodeCount };
}

function publishTopologyResult(
  state: MyceliumState,
  styles: readonly (WebSourceStyle | undefined)[],
  result: ConnectionTopologyResult,
): void {
  const stream = state.currentStream;
  if (!stream) return;
  // A reassigned slot means the visitor walked away from that ground before
  // its cords were ready; its own newer request will arrive.
  const assignment = stream.buildAssignments[result.buildSlotIndex];
  if (!assignment || assignment.revision !== result.revision) return;

  if (result.droppedEdgeCount > 0) {
    console.warn(
      `Connections web dropped ${result.droppedEdgeCount} edges beyond one chunk's capacity`,
    );
  }
  writeSlotEdges(stream.web, result, styles, state.clockSeconds);
}

function createNodeStaging(slotCount: number): NodeStaging {
  const nodeCapacity = slotCount * MYCELIUM_SETTINGS.nodeSlotCapacity;
  return {
    positions: new Float32Array(nodeCapacity * COMPONENTS_PER_VALUE),
    weights: new Float32Array(nodeCapacity),
    classIndices: new Uint8Array(nodeCapacity),
    slotNodeCounts: new Int32Array(slotCount),
    gatheredChunkX: new Int32Array(slotCount),
    gatheredChunkZ: new Int32Array(slotCount),
    isGathered: new Uint8Array(slotCount),
  };
}

function setWebVisible(state: MyceliumState, visible: boolean): void {
  const stream = state.currentStream;
  if (!stream) return;
  stream.web.edges.visible = visible;
  stream.web.nodes.visible = visible;
}

function unloadWeb(state: MyceliumState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.currentStream = undefined;
  scene.remove(stream.web.edges);
  scene.remove(stream.web.nodes);
  disposeConnectionWeb(stream.web);
  stream.topologyPort.terminate();
}

/** Resolve preset styles into the fixed class order used by packed indices. */
function createSourceStyles(
  parameters: ConnectionsParameters,
): readonly (WebSourceStyle | undefined)[] {
  return SOURCE_CLASS_ORDER.map((sourceClass) => {
    const style = parameters.sources[sourceClass];
    return style
      ? { color: new Color(style.nodeColor), weight: style.weight }
      : undefined;
  });
}

function validateConnectionsParameters(
  parameters: ConnectionsParameters,
): void {
  if (!isNormalized(parameters.intensity)) {
    throw new RangeError("Connections intensity must be between zero and one");
  }
  if (!isPositiveFinite(parameters.webRadiusMeters)) {
    throw new RangeError("Connections web radius must be positive and finite");
  }
  const coverageMeters =
    MYCELIUM_SETTINGS.buildChunkRadius *
    getChunkSize(MYCELIUM_SETTINGS.chunkLevel);
  if (parameters.webRadiusMeters > coverageMeters) {
    throw new RangeError(
      `Connections web radius must stay within the ${coverageMeters}-metre topology window coverage`,
    );
  }
  if (
    !Number.isFinite(parameters.pulseSpeedMetersPerSecond) ||
    parameters.pulseSpeedMetersPerSecond < 0
  ) {
    throw new RangeError(
      "Connections pulse speed must be finite and non-negative",
    );
  }
  const styles = Object.values(parameters.sources).filter(
    (style): style is NonNullable<typeof style> => style !== undefined,
  );
  if (styles.length === 0) {
    throw new RangeError("Connections require at least one source class");
  }
  if (!styles.every((style) => isNormalized(style.weight))) {
    throw new RangeError(
      "Connections source weights must be between zero and one",
    );
  }
}
