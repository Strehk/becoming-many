/**
 * Purpose: Verify the per-chunk Connections topology and the module that streams it.
 * Context: Chunks are built once from deterministic data so resident cords never move.
 * Responsibility: Cover the topology contract, seam ownership, and the streaming lifecycle.
 * Boundary: Soil placement has its own test; worker messaging is exercised through a fake port.
 */

import { expect, test } from "bun:test";
import {
  InstancedBufferGeometry,
  Mesh,
  Points,
  Scene,
  type ShaderMaterial,
  Vector3,
} from "three";
import type {
  ConnectionActorSource,
  ConnectionNodeSource,
} from "../../src/modules/connection-nodes";
import {
  type ConnectionsParameters,
  createConnectionsModule,
} from "../../src/modules/mycelium/mycelium";
import { MYCELIUM_SETTINGS } from "../../src/modules/mycelium/mycelium-settings";
import {
  buildChunkTopology,
  type ChunkTopology,
  type TopologyNodes,
} from "../../src/modules/mycelium/network-topology";
import type {
  ConnectionTopologyRequest,
  ConnectionTopologyResult,
  TopologyPort,
} from "../../src/modules/mycelium/topology-messages";
import { StreamQueue } from "../../src/world/stream-queue";
import type { Viewpoint } from "../../src/world/viewer-rig";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const OPTIONS = { neighborsPerNode: 2, edgeCapacity: 1792 };
// These modules never read the view distance; the value only completes the
// contract. It matches the Three.js default far plane.
const DEFAULT_VIEW_DISTANCE_METERS = 2_000;

const NO_NODES: TopologyNodes = {
  positions: new Float32Array(0),
  weights: new Float32Array(0),
  classIndices: new Uint8Array(0),
  nodeCount: 0,
};

function createNodes(
  positions: readonly number[],
  weights?: readonly number[],
  classIndices?: readonly number[],
): TopologyNodes {
  const nodeCount = positions.length / 3;
  return {
    positions: Float32Array.from(positions),
    weights: Float32Array.from(weights ?? new Array(nodeCount).fill(1)),
    classIndices: Uint8Array.from(classIndices ?? new Array(nodeCount).fill(0)),
    nodeCount,
  };
}

/** A deterministic scatter, so every test works on the same non-trivial web. */
function createScatter(nodeCount: number, offsetX = 0): TopologyNodes {
  const positions: number[] = [];
  for (let node = 0; node < nodeCount; node += 1) {
    positions.push(
      offsetX + ((node * 7) % 11),
      ((node * 3) % 5) * 0.25,
      (node * 5) % 13,
    );
  }
  return createNodes(positions);
}

function collectEdgeKeys(topology: ChunkTopology): Set<string> {
  const keys = new Set<string>();
  for (let edge = 0; edge < topology.edgeCount; edge += 1) {
    const offset = edge * 3;
    const start = [0, 1, 2]
      .map((component) => topology.edgeStarts[offset + component])
      .join(",");
    const end = [0, 1, 2]
      .map((component) => topology.edgeEnds[offset + component])
      .join(",");
    keys.add(start < end ? `${start}|${end}` : `${end}|${start}`);
  }
  return keys;
}

test("Chunk topology is deterministic for identical inputs", () => {
  const own = createScatter(24);
  const halo = createScatter(16, 20);
  const first = buildChunkTopology(own, halo, OPTIONS);
  const second = buildChunkTopology(own, halo, OPTIONS);

  expect(Array.from(second.edgeStarts)).toEqual(Array.from(first.edgeStarts));
  expect(Array.from(second.edgeEnds)).toEqual(Array.from(first.edgeEnds));
  expect(second.edgeCount).toBe(first.edgeCount);
});

test("Chunk topology leaves none of its own nodes isolated", () => {
  const own = createScatter(24);
  const topology = buildChunkTopology(own, NO_NODES, OPTIONS);

  const connected = new Set<string>();
  for (let edge = 0; edge < topology.edgeCount; edge += 1) {
    const offset = edge * 3;
    connected.add(
      [0, 1, 2].map((c) => topology.edgeStarts[offset + c]).join(","),
    );
    connected.add(
      [0, 1, 2].map((c) => topology.edgeEnds[offset + c]).join(","),
    );
  }
  for (let node = 0; node < own.nodeCount; node += 1) {
    const offset = node * 3;
    expect(
      connected.has([0, 1, 2].map((c) => own.positions[offset + c]).join(",")),
    ).toBe(true);
  }
});

test("Chunk topology never duplicates an undirected edge", () => {
  const topology = buildChunkTopology(
    createScatter(24),
    createScatter(16, 20),
    OPTIONS,
  );

  expect(collectEdgeKeys(topology).size).toBe(topology.edgeCount);
});

test("Chunk topology reports edge weights as mean endpoint weight", () => {
  const own = createNodes([0, 0, 0, 3, 0, 0, 6, 0, 0], [1, 0.5, 0.25]);
  const topology = buildChunkTopology(own, NO_NODES, {
    neighborsPerNode: 1,
    edgeCapacity: 16,
  });

  for (let edge = 0; edge < topology.edgeCount; edge += 1) {
    const weight = topology.edgeWeights[edge] ?? 0;
    expect([0.75, 0.625, 0.375]).toContain(weight);
  }
});

test("Chunk topology capacity keeps the spanning web and reports drops", () => {
  const own = createScatter(20);
  const capacity = 12;
  const topology = buildChunkTopology(own, createScatter(12, 20), {
    neighborsPerNode: 3,
    edgeCapacity: capacity,
  });

  expect(topology.edgeCount).toBeLessThanOrEqual(capacity);
  expect(topology.droppedEdgeCount).toBeGreaterThan(0);
  // The spanning backbone is 19 edges for 20 nodes, so a 12-edge budget keeps
  // spanning edges only and every extra is dropped.
  expect(topology.edgeCount).toBe(capacity);
});

test("Chunk topology pulls extra links toward heavy hubs", () => {
  const own = createNodes(
    [0, 0, 0, 4, 0, 0, 8, 0, 0, 4, 0, 6],
    [1, 1, 1, 0.05],
  );
  const topology = buildChunkTopology(own, NO_NODES, {
    neighborsPerNode: 1,
    edgeCapacity: 16,
  });

  // The light node sits off the line; the heavy row still attracts links, so
  // the heavy pair (0,0,0)-(4,0,0) is connected.
  expect(collectEdgeKeys(topology).has("0,0,0|4,0,0")).toBe(true);
});

test("Chunk topology returns an empty web without own nodes", () => {
  const topology = buildChunkTopology(NO_NODES, createScatter(8), OPTIONS);

  expect(topology.edgeCount).toBe(0);
  expect(topology.edgeStarts).toHaveLength(0);
});

test("A seam between two chunks is claimed by exactly one of them", () => {
  // The same two node sets, each once as the owner and once as the halo: the
  // pair must be drawn by one side only, or seams double in brightness.
  const west = createNodes([0, 0, 0, 1, 0, 0]);
  const east = createNodes([2, 0, 0, 3, 0, 0]);
  const options = { neighborsPerNode: 2, edgeCapacity: 64 };

  const fromWest = collectEdgeKeys(buildChunkTopology(west, east, options));
  const fromEast = collectEdgeKeys(buildChunkTopology(east, west, options));

  const seam = "1,0,0|2,0,0";
  expect(fromWest.has(seam) !== fromEast.has(seam)).toBe(true);
  for (const key of fromWest) expect(fromEast.has(key)).toBe(false);
});

const WORLD_SURFACE = createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);

const PARAMETERS: ConnectionsParameters = {
  intensity: 1,
  webRadiusMeters: 30,
  pulseSpeedMetersPerSecond: 1.5,
  sources: {
    vegetation: { nodeColor: 0xa5bdc3, weight: 1 },
    animals: { nodeColor: 0xe39e54, weight: 0.5 },
  },
  colors: {
    depthColor: 0x292e55,
    pulseColor: 0xf2e3d3,
  },
};

interface FakeTopologyPort {
  readonly port: TopologyPort;
  readonly requests: ConnectionTopologyRequest[];
  readonly respond: (result: ConnectionTopologyResult) => void;
  readonly isTerminated: () => boolean;
}

function createFakeTopologyPort(): FakeTopologyPort {
  const requests: ConnectionTopologyRequest[] = [];
  let handler: ((result: ConnectionTopologyResult) => void) | undefined;
  let terminated = false;

  return {
    port: {
      postRequest: (request) => requests.push(request),
      setResultHandler: (onResult) => {
        handler = onResult;
      },
      terminate: () => {
        terminated = true;
      },
    },
    requests,
    respond: (result) => handler?.(result),
    isTerminated: () => terminated,
  };
}

/** One deterministic anchor per chunk, at that chunk's centre. */
function createFakeVegetationSource(): ConnectionNodeSource {
  return {
    sourceClass: "vegetation",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) =>
      pushAnchor(
        chunkX * chunkSizeMeters + chunkSizeMeters / 2,
        5,
        chunkZ * chunkSizeMeters + chunkSizeMeters / 2,
      ),
  };
}

function createFakeAnimalSource(positions: number[]): ConnectionActorSource {
  return {
    sourceClass: "animals",
    getWorldPositions: () => Float32Array.from(positions),
  };
}

function createEdgeResult(
  buildSlotIndex: number,
  revision: number,
  start: readonly number[],
  end: readonly number[],
): ConnectionTopologyResult {
  return {
    buildSlotIndex,
    revision,
    edgeCount: 1,
    droppedEdgeCount: 0,
    edgeStarts: Float32Array.from(start),
    edgeEnds: Float32Array.from(end),
    edgeWeights: Float32Array.from([1]),
    edgeHubClasses: Uint8Array.from([0]),
  };
}

function createWebHarness(animalSource?: ConnectionActorSource) {
  const scene = new Scene();
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const streamQueue = new StreamQueue(
    { budgetMilliseconds: 1000, capacity: 64 },
    () => 0,
  );
  const fakePort = createFakeTopologyPort();
  const { module, setIntensity, terrain } = createConnectionsModule(
    PARAMETERS,
    {
      scene,
      viewpoint,
      streamQueue,
      worldSurface: WORLD_SURFACE,
      staticSources: [createFakeVegetationSource()],
      animalSource,
      groundCoverAt: () => 0,
      createTopologyPort: () => fakePort.port,
    },
  );

  const findEdges = () => {
    const edges = scene.children.find(
      (child) =>
        child instanceof Mesh &&
        child.geometry instanceof InstancedBufferGeometry,
    );
    if (!(edges instanceof Mesh)) throw new Error("Expected the edge ribbons");
    return edges as Mesh<InstancedBufferGeometry, ShaderMaterial>;
  };
  const findNodes = () => {
    const nodes = scene.children.find((child) => child instanceof Points);
    if (!(nodes instanceof Points)) throw new Error("Expected the node glows");
    return nodes;
  };

  return {
    scene,
    viewerPosition,
    streamQueue,
    fakePort,
    module,
    setIntensity,
    terrain,
    findEdges,
    findNodes,
  };
}

const BUILD_SLOT_COUNT = (MYCELIUM_SETTINGS.buildChunkRadius * 2 + 1) ** 2;
const GATHER_SLOT_COUNT = (MYCELIUM_SETTINGS.gatherChunkRadius * 2 + 1) ** 2;

test("Connections reject an invalid preset", () => {
  expect(createWebHarness().module).toBeDefined(); // Valid baseline.

  const failing: readonly [Partial<ConnectionsParameters>, string][] = [
    [{ intensity: 1.5 }, "Connections intensity"],
    [{ webRadiusMeters: 0 }, "positive and finite"],
    [{ webRadiusMeters: 40 }, "window coverage"],
    [{ pulseSpeedMetersPerSecond: -1 }, "pulse speed"],
    [{ sources: {} }, "at least one source"],
    [
      { sources: { vegetation: { nodeColor: 0xa5bdc3, weight: 2 } } },
      "source weights",
    ],
  ];
  for (const [override, message] of failing) {
    expect(() =>
      createConnectionsModule(
        { ...PARAMETERS, ...override },
        {
          scene: new Scene(),
          viewpoint: {
            worldPosition: new Vector3(),
            viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
          },
          streamQueue: new StreamQueue(
            { budgetMilliseconds: 1, capacity: 1 },
            () => 0,
          ),
          worldSurface: WORLD_SURFACE,
          staticSources: [],
          groundCoverAt: () => 0,
        },
      ),
    ).toThrow(message);
  }
});

test("Connections build every resident chunk on its own request", () => {
  const harness = createWebHarness();
  const { module, scene, fakePort } = harness;

  module.load();
  expect(scene.children).toHaveLength(2);
  const edges = harness.findEdges();
  const nodes = harness.findNodes();
  expect(edges.visible).toBe(false);
  expect(edges.material.depthWrite).toBe(false);
  expect(edges.material.transparent).toBe(true);
  expect(edges.frustumCulled).toBe(false);

  // One request per built chunk, each carrying its own single fake anchor and
  // the eight neighbouring anchors it draws its seams against.
  expect(fakePort.requests).toHaveLength(BUILD_SLOT_COUNT);
  expect(fakePort.requests[0]?.own.nodeCount).toBe(1);
  expect(fakePort.requests[0]?.halo.nodeCount).toBe(8);
  expect(fakePort.requests[0]?.own.weights[0]).toBe(1);
  expect(nodes.geometry.drawRange.count).toBe(
    GATHER_SLOT_COUNT * MYCELIUM_SETTINGS.nodeSlotCapacity,
  );

  module.activate();
  expect(edges.visible).toBe(true);
  expect(nodes.visible).toBe(true);

  const request = fakePort.requests[0];
  if (!request) throw new Error("Expected a topology request");
  fakePort.respond(
    createEdgeResult(
      request.buildSlotIndex,
      request.revision,
      [1, 2, 3],
      [4, 5, 6],
    ),
  );
  const firstRow =
    MYCELIUM_SETTINGS.animalLinkCapacity +
    request.buildSlotIndex * MYCELIUM_SETTINGS.edgeSlotCapacity;
  const startArray = edges.geometry.getAttribute("edgeStart")
    .array as Float32Array;
  expect(startArray[firstRow * 3] ?? 0).toBeCloseTo(1, 5);

  module.deactivate();
  expect(edges.visible).toBe(false);
  module.unload();
  expect(scene.children).toHaveLength(0);
  expect(fakePort.isTerminated()).toBe(true);
});

test("Connections hang world anchors just under their own object", () => {
  const harness = createWebHarness();
  harness.module.load();

  const request = harness.fakePort.requests[0];
  expect(request?.own.positions[1] ?? 0).toBeCloseTo(
    5 - MYCELIUM_SETTINGS.surfaceRootDepthMeters,
    5,
  );
});

test("Connections draw the web ahead of the ground that opens over it", () => {
  const harness = createWebHarness();
  harness.module.load();
  const edges = harness.findEdges();

  // Load-bearing for the whole look: the ground joins the transparent pass at
  // the default order, so a web drawn after it would be blended away by the
  // soil instead of showing through from underneath. Depth testing stays on,
  // which is what lets trees, rocks, and grass blades occlude the mat.
  expect(edges.material.depthTest).toBe(true);
  expect(edges.material.depthWrite).toBe(false);
  expect(edges.renderOrder).toBeLessThan(0);
  expect(harness.findNodes().renderOrder).toBeLessThan(0);
});

test("Connections open bare ground far more than ground under grass", () => {
  const harness = createWebHarness();
  const { terrain } = harness;

  // The sampler is what Terrain streams per vertex; declaring it is what makes
  // the opening able to tell a lawn from open soil at all.
  expect(terrain.coverAt).toBeDefined();
  expect(MYCELIUM_SETTINGS.soilBareOpacity).toBeLessThan(
    MYCELIUM_SETTINGS.soilCoveredOpacity,
  );
});

test("Connections rebuild only the chunks that entered the window", () => {
  const harness = createWebHarness();
  const { module, viewerPosition, streamQueue, fakePort } = harness;

  module.load();
  module.activate();
  expect(fakePort.requests).toHaveLength(BUILD_SLOT_COUNT);
  fakePort.requests.length = 0;

  // One 16-metre boundary crossing. This is the whole point of building per
  // chunk: the mat the visitor is standing on is not recomputed, so cords
  // already on screen cannot reroute.
  const chunkSize = 16;
  viewerPosition.set(chunkSize + 1, 0, 0);
  module.update?.(0.016);
  for (let step = 0; step < GATHER_SLOT_COUNT + 4; step += 1) {
    streamQueue.update();
  }
  module.update?.(0.016);

  const chunksPerSide = MYCELIUM_SETTINGS.buildChunkRadius * 2 + 1;
  expect(fakePort.requests).toHaveLength(chunksPerSide);
  module.unload();
});

test("Connections discard a reply for ground the visitor already left", () => {
  const harness = createWebHarness();
  const { module, fakePort } = harness;

  module.load();
  const edges = harness.findEdges();
  const request = fakePort.requests[0];
  if (!request) throw new Error("Expected a topology request");

  // A slot reassigned while its topology was in flight must not publish the
  // ground it no longer represents.
  fakePort.respond(
    createEdgeResult(
      request.buildSlotIndex,
      request.revision + 1,
      [9, 9, 9],
      [8, 8, 8],
    ),
  );
  const firstRow =
    MYCELIUM_SETTINGS.animalLinkCapacity +
    request.buildSlotIndex * MYCELIUM_SETTINGS.edgeSlotCapacity;
  const startArray = edges.geometry.getAttribute("edgeStart")
    .array as Float32Array;
  expect(startArray[firstRow * 3] ?? 0).toBe(0);
  module.unload();
});

test("Connections link visible animals to their nearest web node", () => {
  const actorX = 9;
  const actorZ = 7;
  const harness = createWebHarness(createFakeAnimalSource([actorX, 5, actorZ]));
  const { module } = harness;

  module.load();
  module.activate();
  module.update?.(0.016);
  const edges = harness.findEdges();
  const startArray = edges.geometry.getAttribute("edgeStart")
    .array as Float32Array;
  const endArray = edges.geometry.getAttribute("edgeEnd").array as Float32Array;
  const colorArray = edges.geometry.getAttribute("edgeColor")
    .array as Float32Array;

  // The nearest fake anchor to the actor is the chunk (0,0) node at (8,·,8).
  expect(startArray[0] ?? 0).toBeCloseTo(8, 5);
  expect(startArray[2] ?? 0).toBeCloseTo(8, 5);
  expect(endArray[0] ?? 0).toBeCloseTo(actorX, 5);
  expect(endArray[2] ?? 0).toBeCloseTo(actorZ, 5);
  expect(colorArray[0] ?? 0).toBeGreaterThan(0);

  // Unused animal rows collapse to degenerate cords.
  for (let row = 1; row < MYCELIUM_SETTINGS.animalLinkCapacity; row += 1) {
    expect(startArray[row * 3] ?? -1).toBe(0);
    expect(endArray[row * 3] ?? -1).toBe(0);
  }
  module.unload();
});
