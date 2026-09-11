/**
 * Purpose: Verify the per-chunk Connections topology and the module that streams it.
 * Context: Chunks are built once from deterministic data so resident cords never move.
 * Responsibility: Cover the topology contract, seam ownership, and the streaming lifecycle.
 * Boundary: Soil placement has its own test; worker messaging is exercised through a fake port.
 */

import { expect, spyOn, test } from "bun:test";
import {
  Color,
  InstancedBufferGeometry,
  Mesh,
  Points,
  Scene,
  type ShaderMaterial,
  Vector3,
} from "three";
import type { ConnectionNodeSource } from "../../src/modules/connection-nodes";
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
import {
  createConnectionWeb,
  disposeConnectionWeb,
  writeSlotEdges,
} from "../../src/modules/mycelium/network-web";
import type {
  ConnectionTopologyRequest,
  ConnectionTopologyResult,
  TopologyPort,
} from "../../src/modules/mycelium/topology-messages";
import { StreamQueue } from "../../src/world/stream-queue";
import type { Viewpoint } from "../../src/world/viewpoint";
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

function createWebHarness(
  createTopologyPort?: () => TopologyPort,
  parameters: ConnectionsParameters = PARAMETERS,
) {
  const scene = new Scene();
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(0, 0, -1),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: Math.PI / 4,
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const streamQueue = new StreamQueue(
    { budgetMilliseconds: 1000, capacity: 64 },
    () => 0,
  );
  const fakePort = createFakeTopologyPort();
  const { module, setIntensity, terrain } = createConnectionsModule(
    parameters,
    {
      scene,
      viewpoint,
      streamQueue,
      worldSurface: WORLD_SURFACE,
      staticSources: (["vegetation", "scentEmitters", "rocks"] as const)
        .filter((sourceClass) => parameters.sources[sourceClass])
        .map((sourceClass) => ({
          ...createFakeVegetationSource(),
          sourceClass,
        })),
      groundCoverAt: () => 0,
      createTopologyPort: createTopologyPort ?? (() => fakePort.port),
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

test.each([0, BUILD_SLOT_COUNT - 1])(
  "Connections edge slot %d stays inside its exact pool range",
  (buildSlotIndex) => {
    const web = createConnectionWeb(
      {},
      { gatherSlotCount: GATHER_SLOT_COUNT, buildSlotCount: BUILD_SLOT_COUNT },
    );
    const capacity = MYCELIUM_SETTINGS.edgeSlotCapacity;
    expect(web.edges.geometry.instanceCount).toBe(BUILD_SLOT_COUNT * capacity);
    writeSlotEdges(
      web,
      {
        ...createEdgeResult(buildSlotIndex, 1, [], []),
        edgeCount: capacity + 1,
        edgeStarts: new Float32Array((capacity + 1) * 3).fill(1),
        edgeEnds: new Float32Array((capacity + 1) * 3).fill(2),
      },
      [],
      1,
    );
    const first = buildSlotIndex * capacity * 3;
    const last = first + capacity * 3;
    for (const [attribute, coordinate] of [
      [web.edgeStartAttribute, 1],
      [web.edgeEndAttribute, 2],
    ] as const) {
      const positions = Array.from(attribute.array);
      expect(positions).toHaveLength(BUILD_SLOT_COUNT * capacity * 3);
      expect(
        positions.slice(first, last).every((value) => value === coordinate),
      ).toBe(true);
      expect(
        [...positions.slice(0, first), ...positions.slice(last)].every(
          (value) => value === 0,
        ),
      ).toBe(true);
    }
    disposeConnectionWeb(web);
  },
);

test("Connections retain all four fixed-source colors and weights through node and edge publication", () => {
  const sources = {
    vegetation: { nodeColor: 0xa5bdc3, weight: 1 },
    scentEmitters: { nodeColor: 0xd06780, weight: 0.75 },
    rocks: { nodeColor: 0x292e55, weight: 0.5 },
    soil: { nodeColor: 0xf2e3d3, weight: 0.25 },
  };
  const harness = createWebHarness(undefined, { ...PARAMETERS, sources });
  harness.module.load();
  const request = harness.fakePort.requests[0];
  if (!request) throw new Error("Expected a topology request");
  expect(Array.from(request.own.classIndices.slice(0, 4))).toEqual([
    0, 1, 2, 3,
  ]);
  harness.fakePort.respond({
    ...createEdgeResult(request.buildSlotIndex, request.revision, [], []),
    edgeCount: 4,
    edgeStarts: new Float32Array(12).fill(1),
    edgeEnds: new Float32Array(12).fill(2),
    edgeHubClasses: request.own.classIndices.slice(0, 4),
    edgeWeights: request.own.weights.slice(0, 4),
  });
  const nodes = harness.findNodes().geometry;
  const edges = harness.findEdges().geometry;
  const firstEdge = request.buildSlotIndex * MYCELIUM_SETTINGS.edgeSlotCapacity;
  for (const [index, style] of Object.values(sources).entries()) {
    const color = new Color(style.nodeColor).toArray();
    expect(
      Array.from(
        nodes.getAttribute("nodeColor").array.slice(index * 3, index * 3 + 3),
      ),
    ).toEqual(Array.from(Float32Array.from(color)));
    expect(nodes.getAttribute("nodeWeight").array[index]).toBe(style.weight);
    const edge = firstEdge + index;
    expect(
      Array.from(
        edges.getAttribute("edgeColor").array.slice(edge * 3, edge * 3 + 3),
      ),
    ).toEqual(Array.from(Float32Array.from(color)));
    expect(edges.getAttribute("edgeWeight").array[edge]).toBe(style.weight);
  }
  harness.module.unload();
});

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
            worldBodyDirection: new Vector3(0, 0, -1),
            worldDirection: new Vector3(0, 0, -1),
            worldUp: new Vector3(0, 1, 0),
            viewHalfAngleRadians: Math.PI / 4,
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
  const firstRow = request.buildSlotIndex * MYCELIUM_SETTINGS.edgeSlotCapacity;
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

test("Connections recover rejected gathers after the queue drains without more movement", () => {
  const { module, viewerPosition, streamQueue, fakePort } = createWebHarness();
  module.load();
  module.activate();
  expect(fakePort.requests).toHaveLength(BUILD_SLOT_COUNT);
  fakePort.requests.length = 0;

  // The harness queue holds 64 still-current foreign jobs. They complete only
  // when the shared queue runs, so no entering gather can be admitted yet.
  const queueCapacity = 64;
  for (let blocker = 0; blocker < queueCapacity; blocker += 1) {
    expect(
      streamQueue.enqueue({
        key: {},
        isCurrent: () => true,
        runStep: () => true,
      }),
    ).toBe(true);
  }
  const enqueue = spyOn(streamQueue, "enqueue");

  try {
    const chunkSize = 16;
    viewerPosition.set(chunkSize + 1, 0, 0);
    module.update?.(0.016);
    const rejectedGatherCount = enqueue.mock.results.filter(
      (result) => result.type === "return" && result.value === false,
    ).length;
    expect(rejectedGatherCount).toBeGreaterThan(0);
    expect(streamQueue.size).toBe(queueCapacity);
    expect(fakePort.requests).toHaveLength(0);

    streamQueue.update();
    expect(streamQueue.size).toBe(0);
    const recoveryFrames = GATHER_SLOT_COUNT + 4;
    for (let frame = 0; frame < recoveryFrames; frame += 1) {
      module.update?.(0.016);
      streamQueue.update();
    }

    const expectedBuilds = MYCELIUM_SETTINGS.buildChunkRadius * 2 + 1;
    console.info(
      "Rejected gather recovery:",
      JSON.stringify({
        rejectedGatherCount,
        recoveryFrames,
        stationaryX: viewerPosition.x,
        queuedJobsAfterRecovery: streamQueue.size,
        expectedBuilds,
        actualBuilds: fakePort.requests.length,
      }),
    );
    expect(fakePort.requests).toHaveLength(expectedBuilds);
    for (const request of fakePort.requests) {
      // The entering column is chunk x=3. Each request must carry its real
      // centre anchor and all eight neighbours, not an empty placeholder.
      expect(request.own.nodeCount).toBe(1);
      expect(request.own.positions[0]).toBe(3 * chunkSize + chunkSize / 2);
      expect(request.halo.nodeCount).toBe(8);
    }
  } finally {
    enqueue.mockRestore();
    module.unload();
  }
});

test("Connections recover only the latest assignments as queue capacity returns gradually", () => {
  const { module, viewerPosition, streamQueue, fakePort } = createWebHarness();
  module.load();
  fakePort.requests.length = 0;

  // Three slots become available; the remaining foreign work stays queued.
  for (let blocker = 0; blocker < 64; blocker += 1) {
    expect(
      streamQueue.enqueue({
        key: {},
        isCurrent: () => true,
        runStep: () => blocker < 3,
      }),
    ).toBe(true);
  }
  for (const x of [17, 129, 241]) {
    viewerPosition.x = x;
    module.update?.(0.016);
  }
  expect(fakePort.requests).toHaveLength(0);
  streamQueue.update();
  expect(streamQueue.size).toBe(61);
  for (let frame = 0; frame < GATHER_SLOT_COUNT; frame += 1) {
    module.update?.(0.016);
    streamQueue.update();
  }

  expect(fakePort.requests).toHaveLength(BUILD_SLOT_COUNT);
  const ownAnchors = new Set<string>();
  for (const request of fakePort.requests) {
    expect(request.own.nodeCount).toBe(1);
    const ownX = request.own.positions[0] ?? 0;
    const ownZ = request.own.positions[2] ?? 0;
    ownAnchors.add(`${ownX},${ownZ}`);
    expect(ownX).toBeGreaterThanOrEqual(216);
    expect(ownX).toBeLessThanOrEqual(280);
    expect(request.halo.nodeCount).toBe(8);
    const neighbours = new Set(
      Array.from({ length: request.halo.nodeCount }, (_, node) => {
        const deltaX = (request.halo.positions[node * 3] ?? 0) - ownX;
        const deltaZ = (request.halo.positions[node * 3 + 2] ?? 0) - ownZ;
        return `${deltaX},${deltaZ}`;
      }),
    );
    expect(neighbours).toEqual(
      new Set([
        "-16,-16",
        "0,-16",
        "16,-16",
        "-16,0",
        "16,0",
        "-16,16",
        "0,16",
        "16,16",
      ]),
    );
  }
  expect(ownAnchors.size).toBe(BUILD_SLOT_COUNT);
  expect(streamQueue.size).toBe(61);
  module.unload();
});

test("Connections clear recycled GPU rows before gathering and reject the old replies", () => {
  const harness = createWebHarness();
  const { module, viewerPosition, fakePort } = harness;
  module.load();
  const oldReplies = fakePort.requests.map((request) =>
    createEdgeResult(
      request.buildSlotIndex,
      request.revision,
      [1, 2, 3],
      [4, 5, 6],
    ),
  );
  for (const result of oldReplies) fakePort.respond(result);
  const edgeStarts = harness
    .findEdges()
    .geometry.getAttribute("edgeStart").array;
  const edgeEnds = harness.findEdges().geometry.getAttribute("edgeEnd").array;
  const nodeWeights = harness.findNodes().geometry.getAttribute("nodeWeight")
    .array as Float32Array;
  expect(Array.from(edgeStarts).some((coordinate) => coordinate !== 0)).toBe(
    true,
  );
  expect(Array.from(nodeWeights).filter((weight) => weight >= 0)).toHaveLength(
    GATHER_SLOT_COUNT,
  );

  // None of the old window remains; the queue has not gathered its replacement.
  viewerPosition.x = 241;
  module.update?.(0.016);
  expect(Array.from(nodeWeights).every((weight) => weight < 0)).toBe(true);
  expect(Array.from(edgeStarts).every((coordinate) => coordinate === 0)).toBe(
    true,
  );
  expect(Array.from(edgeEnds).every((coordinate) => coordinate === 0)).toBe(
    true,
  );
  for (const result of oldReplies) fakePort.respond(result);
  expect(Array.from(edgeStarts).every((coordinate) => coordinate === 0)).toBe(
    true,
  );
  module.unload();
});

test("Connections never gather into disposed resources after unload", () => {
  const harness = createWebHarness();
  const { module, viewerPosition, streamQueue } = harness;
  module.load();
  const weights = harness.findNodes().geometry.getAttribute("nodeWeight");
  viewerPosition.x = 17;
  module.update?.(0.016);
  expect(streamQueue.size).toBeGreaterThan(0);
  module.unload();
  const versionAtUnload = weights.version;
  const weightsAtUnload = Array.from(weights.array);
  streamQueue.update();
  expect(streamQueue.size).toBe(0);
  expect(weights.version).toBe(versionAtUnload);
  expect(Array.from(weights.array)).toEqual(weightsAtUnload);
});

test("Connections reject replies from an unloaded worker after reloading the same chunks", () => {
  const oldPort = createFakeTopologyPort();
  const newPort = createFakeTopologyPort();
  let loadCount = 0;
  const harness = createWebHarness(() =>
    loadCount++ === 0 ? oldPort.port : newPort.port,
  );
  harness.module.load();
  const oldRequest = oldPort.requests[0];
  if (!oldRequest) throw new Error("Expected the old worker request");
  harness.module.unload();
  harness.module.load();
  const newRequest = newPort.requests[0];
  expect(newRequest?.revision).toBe(oldRequest.revision);
  const starts = harness.findEdges().geometry.getAttribute("edgeStart").array;
  const firstRow =
    oldRequest.buildSlotIndex * MYCELIUM_SETTINGS.edgeSlotCapacity;
  const oldResult = createEdgeResult(
    oldRequest.buildSlotIndex,
    oldRequest.revision,
    [9, 9, 9],
    [8, 8, 8],
  );
  oldPort.respond(oldResult);
  expect(starts[firstRow * 3]).toBe(0);
  newPort.respond(
    createEdgeResult(
      oldRequest.buildSlotIndex,
      oldRequest.revision,
      [1, 2, 3],
      [4, 5, 6],
    ),
  );
  expect(starts[firstRow * 3]).toBe(1);
  harness.module.unload();
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
  const firstRow = request.buildSlotIndex * MYCELIUM_SETTINGS.edgeSlotCapacity;
  const startArray = edges.geometry.getAttribute("edgeStart")
    .array as Float32Array;
  expect(startArray[firstRow * 3] ?? 0).toBe(0);
  module.unload();
});
