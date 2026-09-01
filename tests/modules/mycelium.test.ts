/**
 * Purpose: Verify the Connections web topology math behind the Mycelium module.
 * Context: The worker only relays this pure function; correctness is provable in Bun.
 * Responsibility: Cover determinism, connectivity, dedup, the capacity cap, and weight bias.
 * Boundary: Worker messaging, GPU pools, and lifecycle are covered by their own tests.
 */

import { expect, test } from "bun:test";
import {
  InstancedBufferGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  type ShaderMaterial,
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
  buildConnectionTopology,
  type ConnectionTopology,
} from "../../src/modules/mycelium/network-topology";
import type {
  ConnectionTopologyRequest,
  ConnectionTopologyResult,
  TopologyPort,
} from "../../src/modules/mycelium/topology-messages";
import { StreamQueue } from "../../src/world/stream-queue";

const OPTIONS = { neighborsPerNode: 2, edgeCapacity: 1792 };

function createScatteredNodes(count: number): {
  positions: Float32Array;
  weights: Float32Array;
} {
  const positions = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  let state = 1_337;
  const next = () => {
    state = (state * 48_271) % 2_147_483_647;
    return state / 2_147_483_647;
  };
  for (let node = 0; node < count; node += 1) {
    positions[node * 3] = next() * 96 - 48;
    positions[node * 3 + 1] = next() * 4;
    positions[node * 3 + 2] = next() * 96 - 48;
    weights[node] = 0.25 + next() * 0.75;
  }
  return { positions, weights };
}

function countComponents(nodeCount: number, edgePairs: Uint32Array): number {
  const parents = Array.from({ length: nodeCount }, (_, node) => node);
  const find = (node: number): number => {
    let root = node;
    while (parents[root] !== root) root = parents[root] ?? root;
    return root;
  };
  for (let edge = 0; edge < edgePairs.length / 2; edge += 1) {
    const first = find(edgePairs[edge * 2] ?? 0);
    const second = find(edgePairs[edge * 2 + 1] ?? 0);
    parents[first] = second;
  }
  return new Set(Array.from({ length: nodeCount }, (_, node) => find(node)))
    .size;
}

function edgeKeys(topology: ConnectionTopology): string[] {
  const keys: string[] = [];
  for (let edge = 0; edge < topology.edgeCount; edge += 1) {
    const first = topology.edgePairs[edge * 2] ?? 0;
    const second = topology.edgePairs[edge * 2 + 1] ?? 0;
    keys.push(first < second ? `${first}:${second}` : `${second}:${first}`);
  }
  return keys;
}

test("Connection topology is deterministic for identical inputs", () => {
  const { positions, weights } = createScatteredNodes(120);
  const first = buildConnectionTopology(positions, weights, OPTIONS);
  const second = buildConnectionTopology(positions, weights, OPTIONS);

  expect(second.edgeCount).toBe(first.edgeCount);
  expect(Array.from(second.edgePairs)).toEqual(Array.from(first.edgePairs));
  expect(Array.from(second.edgeWeights)).toEqual(Array.from(first.edgeWeights));
});

test("Connection topology forms one connected web with no isolated node", () => {
  const { positions, weights } = createScatteredNodes(120);
  const topology = buildConnectionTopology(positions, weights, OPTIONS);

  expect(countComponents(120, topology.edgePairs)).toBe(1);
  const degrees = new Uint32Array(120);
  for (const node of topology.edgePairs) {
    degrees[node] = (degrees[node] ?? 0) + 1;
  }
  for (const degree of degrees) expect(degree).toBeGreaterThanOrEqual(1);
});

test("Connection topology never duplicates an undirected edge", () => {
  const { positions, weights } = createScatteredNodes(80);
  const topology = buildConnectionTopology(positions, weights, OPTIONS);
  const keys = edgeKeys(topology);

  expect(new Set(keys).size).toBe(keys.length);
});

test("Connection topology reports edge weights as mean endpoint weight", () => {
  const { positions, weights } = createScatteredNodes(40);
  const topology = buildConnectionTopology(positions, weights, OPTIONS);

  for (let edge = 0; edge < topology.edgeCount; edge += 1) {
    const first = topology.edgePairs[edge * 2] ?? 0;
    const second = topology.edgePairs[edge * 2 + 1] ?? 0;
    const expected = ((weights[first] ?? 0) + (weights[second] ?? 0)) / 2;
    expect(topology.edgeWeights[edge] ?? 0).toBeCloseTo(expected, 5);
  }
});

test("Connection topology capacity keeps the spanning web and reports drops", () => {
  const { positions, weights } = createScatteredNodes(120);
  const unbounded = buildConnectionTopology(positions, weights, OPTIONS);
  const capacity = 140; // Above the 119 spanning edges, below the full web.
  const capped = buildConnectionTopology(positions, weights, {
    ...OPTIONS,
    edgeCapacity: capacity,
  });

  expect(capped.edgeCount).toBe(capacity);
  expect(capped.droppedEdgeCount).toBe(unbounded.edgeCount - capacity);
  expect(countComponents(120, capped.edgePairs)).toBe(1);

  // The capped extras are the heaviest ones: every surviving non-spanning
  // edge must weigh at least as much as every dropped edge.
  const cappedKeys = new Set(edgeKeys(capped));
  let lightestKept = Number.POSITIVE_INFINITY;
  for (let edge = 119; edge < capped.edgeCount; edge += 1) {
    lightestKept = Math.min(lightestKept, capped.edgeWeights[edge] ?? 0);
  }
  const unboundedKeys = edgeKeys(unbounded);
  for (let edge = 0; edge < unbounded.edgeCount; edge += 1) {
    if (cappedKeys.has(unboundedKeys[edge] ?? "")) continue;
    expect(unbounded.edgeWeights[edge] ?? 0).toBeLessThanOrEqual(
      lightestKept + 1e-6,
    );
  }
});

test("Connection topology pulls extra links toward heavy hubs", () => {
  const { positions } = createScatteredNodes(120);
  const uniform = new Float32Array(120).fill(0.5);
  const biased = Float32Array.from(uniform);
  biased[7] = 1;

  const uniformTopology = buildConnectionTopology(positions, uniform, OPTIONS);
  const biasedTopology = buildConnectionTopology(positions, biased, OPTIONS);
  const degreeOf = (topology: ConnectionTopology): number => {
    let degree = 0;
    for (const node of topology.edgePairs) {
      if (node === 7) degree += 1;
    }
    return degree;
  };

  expect(degreeOf(biasedTopology)).toBeGreaterThanOrEqual(
    degreeOf(uniformTopology),
  );
});

test("Connection topology returns an empty web below two nodes", () => {
  const single = buildConnectionTopology(
    new Float32Array([1, 2, 3]),
    new Float32Array([1]),
    OPTIONS,
  );

  expect(single.edgeCount).toBe(0);
  expect(single.droppedEdgeCount).toBe(0);
  expect(single.edgePairs).toHaveLength(0);
});

const PARAMETERS: ConnectionsParameters = {
  intensity: 1,
  webRadiusMeters: 88,
  pulseSpeedMetersPerSecond: 4,
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

/** One deterministic anchor per chunk at a stable in-chunk offset. */
function createFakeVegetationSource(): ConnectionNodeSource {
  return {
    sourceClass: "vegetation",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) =>
      pushAnchor(
        chunkX * chunkSizeMeters + 16,
        5,
        chunkZ * chunkSizeMeters + 16,
      ),
  };
}

function createFakeAnimalSource(positions: number[]): ConnectionActorSource {
  return {
    sourceClass: "animals",
    getWorldPositions: () => Float32Array.from(positions),
  };
}

function createWebHarness(animalSource?: ConnectionActorSource) {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const streamQueue = new StreamQueue(
    { budgetMilliseconds: 1000, capacity: 8 },
    () => 0,
  );
  const fakePort = createFakeTopologyPort();
  const { module, setIntensity } = createConnectionsModule(PARAMETERS, {
    scene,
    camera,
    streamQueue,
    staticSources: [createFakeVegetationSource()],
    animalSource,
    createTopologyPort: () => fakePort.port,
  });

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
    camera,
    streamQueue,
    fakePort,
    module,
    setIntensity,
    findEdges,
    findNodes,
  };
}

test("Connections reject an invalid preset", () => {
  expect(createWebHarness().module).toBeDefined(); // Valid baseline.

  const failing: readonly [Partial<ConnectionsParameters>, string][] = [
    [{ intensity: 1.5 }, "Connections intensity"],
    [{ webRadiusMeters: 0 }, "positive and finite"],
    [{ webRadiusMeters: 120 }, "window coverage"],
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
          camera: new PerspectiveCamera(),
          streamQueue: new StreamQueue(
            { budgetMilliseconds: 1, capacity: 1 },
            () => 0,
          ),
          staticSources: [],
        },
      ),
    ).toThrow(message);
  }
});

test("Connections web follows the lifecycle and publishes one topology", () => {
  const harness = createWebHarness();
  const { module, scene, fakePort } = harness;

  module.load();
  expect(scene.children).toHaveLength(2);
  const edges = harness.findEdges();
  const nodes = harness.findNodes();
  expect(edges.visible).toBe(false);
  expect(nodes.visible).toBe(false);
  expect(edges.material.depthWrite).toBe(false);
  expect(edges.material.transparent).toBe(true);
  expect(edges.frustumCulled).toBe(false);

  // The synchronous startup gather covers the whole resident window with
  // one fake anchor per chunk.
  const windowChunkCount = (MYCELIUM_SETTINGS.windowChunkRadius * 2 + 1) ** 2;
  expect(fakePort.requests).toHaveLength(1);
  const request = fakePort.requests[0];
  expect(request?.generation).toBe(0);
  expect(request?.nodeCount).toBe(windowChunkCount);
  expect(request?.weights[0]).toBe(1);

  module.activate();
  expect(edges.visible).toBe(true);
  expect(nodes.visible).toBe(true);

  fakePort.respond({
    generation: 0,
    edgeCount: 1,
    droppedEdgeCount: 0,
    edgePairs: Uint32Array.from([0, 1]),
    edgeWeights: Float32Array.from([1]),
  });
  expect(edges.geometry.instanceCount).toBe(
    MYCELIUM_SETTINGS.animalLinkCapacity + 1,
  );
  expect(nodes.geometry.drawRange.count).toBe(windowChunkCount);
  const staticRow = MYCELIUM_SETTINGS.animalLinkCapacity;
  const startArray = edges.geometry.getAttribute("edgeStart")
    .array as Float32Array;
  expect(startArray[staticRow * 3 + 1] ?? 0).toBeCloseTo(
    5 + MYCELIUM_SETTINGS.edgeLiftMeters,
    5,
  );

  module.deactivate();
  expect(edges.visible).toBe(false);
  module.unload();
  expect(scene.children).toHaveLength(0);
  expect(fakePort.isTerminated()).toBe(true);
});

test("Connections regather on window changes and ignore stale results", () => {
  const harness = createWebHarness();
  const { module, camera, streamQueue, fakePort } = harness;

  module.load();
  module.activate();
  const edges = harness.findEdges();
  expect(fakePort.requests).toHaveLength(1);

  // Crossing one 32-metre boundary advances the generation and enqueues one
  // replacing gather job.
  camera.position.set(40, 0, 0);
  module.update?.(0.016);
  module.update?.(0.016);
  const gatherSteps = (MYCELIUM_SETTINGS.windowChunkRadius * 2 + 1) ** 2 + 4;
  for (let step = 0; step < gatherSteps; step += 1) streamQueue.update();

  expect(fakePort.requests).toHaveLength(2);
  expect(fakePort.requests[1]?.generation).toBe(1);

  // The stale generation-zero reply must not publish anything.
  fakePort.respond({
    generation: 0,
    edgeCount: 3,
    droppedEdgeCount: 0,
    edgePairs: Uint32Array.from([0, 1, 1, 2, 2, 3]),
    edgeWeights: Float32Array.from([1, 1, 1]),
  });
  expect(edges.geometry.instanceCount).toBe(
    MYCELIUM_SETTINGS.animalLinkCapacity,
  );

  fakePort.respond({
    generation: 1,
    edgeCount: 2,
    droppedEdgeCount: 0,
    edgePairs: Uint32Array.from([0, 1, 1, 2]),
    edgeWeights: Float32Array.from([1, 1]),
  });
  expect(edges.geometry.instanceCount).toBe(
    MYCELIUM_SETTINGS.animalLinkCapacity + 2,
  );
  module.unload();
});

test("Connections link visible animals to their nearest web node", () => {
  const actorX = 18;
  const actorZ = 14;
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

  // The nearest fake anchor to the actor is the chunk (0,0) node at (16,5,16).
  expect(startArray[0] ?? 0).toBeCloseTo(16, 5);
  expect(startArray[2] ?? 0).toBeCloseTo(16, 5);
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
