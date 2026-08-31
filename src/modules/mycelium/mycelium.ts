/**
 * Purpose: Create the Connections sense: the pulsing web over the carried world.
 * Context: The final level reveals relationships between the already perceived world elements.
 * Responsibility: Validate parameters, share uniforms, stream anchor gathering, own the worker.
 * Boundary: Anchor providers stay in their modules; topology math stays worker-side and pure.
 */

import { Color, type PerspectiveCamera, type Scene } from "three";
import { isNormalized, isPositiveFinite } from "../../utils/number-ranges";
import { ChunkWindow, getChunkSize } from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type {
  ConnectionActorSource,
  ConnectionNodeSource,
  ConnectionSourceClass,
} from "../connection-nodes";
import {
  type ConnectionsParameters,
  MYCELIUM_SETTINGS,
} from "./mycelium-settings";
import {
  type ConnectionWeb,
  createConnectionWeb,
  disposeConnectionWeb,
  setWebTopology,
  updateAnimalLinks,
  type WebSourceStyle,
} from "./network-web";
import {
  type ConnectionTopologyResult,
  createTopologyWorkerPort,
  type TopologyPort,
} from "./topology-messages";

export type { ConnectionsParameters } from "./mycelium-settings";

const ANIMAL_CLASS_INDEX = 2;

/** Fixed class order mapping packed class indices to preset styles. */
const SOURCE_CLASS_ORDER: readonly ConnectionSourceClass[] = [
  "vegetation",
  "scentEmitters",
  "animals",
  "rocks",
];

export interface ConnectionsOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly streamQueue: StreamQueue;
  /** Wired by the composition root for every enabled static source class. */
  readonly staticSources: readonly ConnectionNodeSource[];
  /** Live animal positions; present only when animals participate. */
  readonly animalSource?: ConnectionActorSource;
  /** Test seam; defaults to the real module-owned worker. */
  readonly createTopologyPort?: () => TopologyPort;
}

interface WebStream {
  readonly chunkWindow: ChunkWindow;
  readonly web: ConnectionWeb;
  readonly topologyPort: TopologyPort;
  readonly gatherJobKey: object;
}

interface MyceliumState {
  currentStream: WebStream | undefined;
  /** Aggregate window-state revision; one topology spans every slot. */
  generation: number;
  /** Node count of the last completely gathered window. */
  nodeCount: number;
}

/** Retained per-sense staging; the posted buffers are fresh copies. */
interface NodeStaging {
  readonly positions: Float32Array;
  readonly classIndices: Uint8Array;
  readonly weights: Float32Array;
}

/** One in-progress window gather advancing one chunk per stream step. */
interface GatherWriter {
  readonly centerChunkX: number;
  readonly centerChunkZ: number;
  nextChunkIndex: number;
  nodeCount: number;
  droppedAnchorCount: number;
}

/** Create the Connections web world module. */
export function createConnectionsModule(
  parameters: ConnectionsParameters,
  options: ConnectionsOptions,
): WorldModule {
  validateConnectionsParameters(parameters);
  const timeUniform = { value: 0 };
  const uniforms = {
    connectionsTime: timeUniform,
    connectionsIntensity: { value: parameters.intensity },
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
    connectionsNodeBaseSize: { value: MYCELIUM_SETTINGS.nodeBaseSizeMeters },
    connectionsNodePixelScale: { value: MYCELIUM_SETTINGS.nodePixelScale },
    connectionsDepthColor: { value: new Color(parameters.colors.depthColor) },
    connectionsPulseColor: { value: new Color(parameters.colors.pulseColor) },
  };
  const styles = createSourceStyles(parameters);
  const staging: NodeStaging = {
    positions: new Float32Array(MYCELIUM_SETTINGS.nodeCapacity * 3),
    classIndices: new Uint8Array(MYCELIUM_SETTINGS.nodeCapacity),
    weights: new Float32Array(MYCELIUM_SETTINGS.nodeCapacity),
  };
  const state: MyceliumState = {
    currentStream: undefined,
    generation: 0,
    nodeCount: 0,
  };

  return {
    load: () => loadWeb(state, staging, styles, uniforms, options),
    activate: () => setWebVisible(state, true),
    update: (deltaSeconds) => {
      timeUniform.value =
        (timeUniform.value + deltaSeconds) %
        MYCELIUM_SETTINGS.animationLoopSeconds;
      updateWeb(state, staging, styles, options);
    },
    deactivate: () => setWebVisible(state, false),
    unload: () => unloadWeb(state, options.scene),
  };
}

function loadWeb(
  state: MyceliumState,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  uniforms: Record<string, { value: unknown }>,
  options: ConnectionsOptions,
): void {
  const web = createConnectionWeb(uniforms);
  web.edges.frustumCulled = false;
  web.nodes.frustumCulled = false;
  web.edges.visible = false;
  web.nodes.visible = false;
  options.scene.add(web.edges);
  options.scene.add(web.nodes);

  const topologyPort = options.createTopologyPort
    ? options.createTopologyPort()
    : createTopologyWorkerPort();
  const stream: WebStream = {
    chunkWindow: new ChunkWindow({
      level: MYCELIUM_SETTINGS.chunkLevel,
      radius: MYCELIUM_SETTINGS.windowChunkRadius,
    }),
    web,
    topologyPort,
    gatherJobKey: {},
  };
  topologyPort.setResultHandler((result) =>
    publishTopologyResult(state, staging, styles, result),
  );
  state.currentStream = stream;

  // The initial window fills synchronously like the other streamed modules;
  // the first topology appears when the worker replies a few frames later.
  stream.chunkWindow.update(
    options.camera.position.x,
    options.camera.position.z,
  );
  const writer = createGatherWriter(options.camera);
  while (!gatherNextChunk(writer, staging, styles, options)) {
    // Startup gathers all resident chunks in one pass.
  }
  finishGather(state, staging, stream, writer);
}

function updateWeb(
  state: MyceliumState,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  options: ConnectionsOptions,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  const changedAssignments = stream.chunkWindow.update(
    options.camera.position.x,
    options.camera.position.z,
  );
  if (changedAssignments.length > 0) {
    state.generation += 1;
    // One stable key per stream: re-enqueueing replaces the pending gather,
    // so rapid boundary crossings collapse into the latest window state.
    options.streamQueue.enqueue(
      createGatherJob(state, staging, styles, options, stream),
    );
  }

  const animalStyle = styles[ANIMAL_CLASS_INDEX];
  if (options.animalSource && animalStyle) {
    updateAnimalLinks(
      stream.web,
      options.animalSource.getWorldPositions(),
      staging.positions,
      state.nodeCount,
      animalStyle,
    );
  }
}

function createGatherJob(
  state: MyceliumState,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  options: ConnectionsOptions,
  stream: WebStream,
): StreamJob {
  const jobGeneration = state.generation;
  const writer = createGatherWriter(options.camera);

  return {
    key: stream.gatherJobKey,
    isCurrent: () =>
      state.currentStream === stream && jobGeneration === state.generation,
    runStep: () => {
      if (!gatherNextChunk(writer, staging, styles, options)) return false;
      finishGather(state, staging, stream, writer);
      return true;
    },
  };
}

function createGatherWriter(camera: PerspectiveCamera): GatherWriter {
  const chunkSize = getChunkSize(MYCELIUM_SETTINGS.chunkLevel);
  return {
    centerChunkX: Math.floor(camera.position.x / chunkSize),
    centerChunkZ: Math.floor(camera.position.z / chunkSize),
    nextChunkIndex: 0,
    nodeCount: 0,
    droppedAnchorCount: 0,
  };
}

/** Gather every source's anchors of one resident chunk; true when complete. */
function gatherNextChunk(
  writer: GatherWriter,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  options: ConnectionsOptions,
): boolean {
  const chunkSize = getChunkSize(MYCELIUM_SETTINGS.chunkLevel);
  const { windowChunkRadius, nodeCapacity } = MYCELIUM_SETTINGS;
  const chunksPerSide = windowChunkRadius * 2 + 1;
  const column = writer.nextChunkIndex % chunksPerSide;
  const row = Math.floor(writer.nextChunkIndex / chunksPerSide);
  const chunkX = writer.centerChunkX + column - windowChunkRadius;
  const chunkZ = writer.centerChunkZ + row - windowChunkRadius;

  for (const source of options.staticSources) {
    const classIndex = SOURCE_CLASS_ORDER.indexOf(source.sourceClass);
    const style = classIndex >= 0 ? styles[classIndex] : undefined;
    if (classIndex < 0 || !style) continue;
    source.appendChunkAnchors(chunkX, chunkZ, chunkSize, (x, y, z) => {
      if (writer.nodeCount >= nodeCapacity) {
        writer.droppedAnchorCount += 1;
        return;
      }
      const valueOffset = writer.nodeCount * 3;
      staging.positions[valueOffset] = x;
      staging.positions[valueOffset + 1] = y;
      staging.positions[valueOffset + 2] = z;
      staging.classIndices[writer.nodeCount] = classIndex;
      staging.weights[writer.nodeCount] = style.weight;
      writer.nodeCount += 1;
    });
  }

  writer.nextChunkIndex += 1;
  return writer.nextChunkIndex >= chunksPerSide ** 2;
}

/** Commit the finished gather and post fresh transfer buffers to the worker. */
function finishGather(
  state: MyceliumState,
  staging: NodeStaging,
  stream: WebStream,
  writer: GatherWriter,
): void {
  state.nodeCount = writer.nodeCount;
  if (writer.droppedAnchorCount > 0) {
    console.warn(
      `Connections web dropped ${writer.droppedAnchorCount} anchors beyond its node capacity`,
    );
  }
  stream.topologyPort.postRequest({
    generation: state.generation,
    nodeCount: writer.nodeCount,
    positions: staging.positions.slice(0, writer.nodeCount * 3),
    weights: staging.weights.slice(0, writer.nodeCount),
    neighborsPerNode: MYCELIUM_SETTINGS.neighborsPerNode,
    edgeCapacity:
      MYCELIUM_SETTINGS.edgeCapacity - MYCELIUM_SETTINGS.animalLinkCapacity,
  });
}

function publishTopologyResult(
  state: MyceliumState,
  staging: NodeStaging,
  styles: readonly (WebSourceStyle | undefined)[],
  result: ConnectionTopologyResult,
): void {
  const stream = state.currentStream;
  // A stale generation means a newer gather is already pending; its own
  // result will arrive, mirroring the chunk-window currentness rule.
  if (!stream || result.generation !== state.generation) return;

  if (result.droppedEdgeCount > 0) {
    console.warn(
      `Connections web dropped ${result.droppedEdgeCount} edges beyond its capacity`,
    );
  }
  setWebTopology(
    stream.web,
    staging.positions,
    staging.classIndices,
    state.nodeCount,
    styles,
    result,
  );
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
    MYCELIUM_SETTINGS.windowChunkRadius *
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
