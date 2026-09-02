/**
 * Purpose: Build one chunk's share of the mycelium web from its own and its neighbours' nodes.
 * Context: The wurzeln experiment proved MST + nearest-neighbor topology; the worker runs this math.
 * Responsibility: Produce deterministic, position-carrying edges a chunk owns, within a fixed budget.
 * Boundary: No Three.js, no worker globals, no window knowledge — numeric arrays in and out.
 *
 * A chunk's result is a pure function of its own nodes and its eight
 * neighbours', and both of those are pure functions of world coordinates. So a
 * chunk built once is built the same way forever: recentring the window can
 * never reroute a cord that is already on screen, which is what keeps the mat
 * from flickering as the visitor walks. Cross-chunk cords are claimed by the
 * chunk holding their lexicographically first endpoint, so exactly one side of
 * a seam draws each of them.
 */

/** Nodes with (near-)zero weight still attract links at this residual pull. */
const MINIMUM_ATTRACTION_WEIGHT = 0.05;

const COMPONENTS_PER_POSITION = 3;

/** One chunk's nodes, or the pooled nodes of its eight neighbours. */
export interface TopologyNodes {
  /** Packed xyz triples. */
  readonly positions: Float32Array;
  /** Per-node class weight from the preset. */
  readonly weights: Float32Array;
  /** Per-node packed source-class index, carried onto the edges. */
  readonly classIndices: Uint8Array;
  readonly nodeCount: number;
}

export interface ChunkTopologyOptions {
  /** Nearest-neighbor edges sought per node on top of the spanning backbone. */
  readonly neighborsPerNode: number;
  /** Hard edge budget for this chunk; spanning edges always survive. */
  readonly edgeCapacity: number;
}

export interface ChunkTopology {
  /** Packed xyz per edge start; the buffer is transferred to the main thread. */
  readonly edgeStarts: Float32Array;
  readonly edgeEnds: Float32Array;
  /** Mean endpoint weight per edge; drives cord width and brightness. */
  readonly edgeWeights: Float32Array;
  /** Class index of the heavier endpoint; the cord takes its color. */
  readonly edgeHubClasses: Uint8Array;
  readonly edgeCount: number;
  /** Edges removed by the capacity cap, lowest combined weight first. */
  readonly droppedEdgeCount: number;
}

interface CandidateEdge {
  /** Index into the own node set. */
  readonly ownNode: number;
  /** Index into the own set when below its count, else into the halo set. */
  readonly otherNode: number;
  readonly isOtherOwn: boolean;
}

/**
 * Connect one chunk's nodes through a spanning backbone over its own nodes
 * plus nearest neighbors reaching into the halo. Distances shrink with
 * endpoint weight, so heavier hubs attract links.
 */
export function buildChunkTopology(
  own: TopologyNodes,
  halo: TopologyNodes,
  options: ChunkTopologyOptions,
): ChunkTopology {
  if (own.nodeCount === 0) return createEmptyTopology();

  const spanningEdges = createSpanningEdges(own);
  const claimedKeys = createEdgeKeySet(spanningEdges);
  const neighborEdges = collectNeighborEdges(
    own,
    halo,
    options.neighborsPerNode,
    claimedKeys,
  );
  return capEdges(
    spanningEdges,
    neighborEdges,
    own,
    halo,
    options.edgeCapacity,
  );
}

/**
 * A spanning tree over the chunk's own nodes only. It guarantees no node of
 * this chunk is left isolated; the seams to the neighbouring chunks are the
 * nearest-neighbor edges' job.
 */
function createSpanningEdges(own: TopologyNodes): CandidateEdge[] {
  const { nodeCount } = own;
  if (nodeCount < 2) return [];

  const visited = new Uint8Array(nodeCount);
  const distances = new Float64Array(nodeCount);
  const parents = new Int32Array(nodeCount);
  distances.fill(Number.POSITIVE_INFINITY);
  parents.fill(-1);
  distances[0] = 0;

  const edges: CandidateEdge[] = [];
  for (let step = 0; step < nodeCount; step += 1) {
    const current = findNearestUnvisited(distances, visited);
    if (current < 0) break;
    visited[current] = 1;
    const parent = parents[current] ?? -1;
    if (parent >= 0) {
      edges.push({ ownNode: parent, otherNode: current, isOtherOwn: true });
    }
    relaxUnvisited(own, current, distances, parents, visited);
  }
  return edges;
}

function findNearestUnvisited(
  distances: Float64Array,
  visited: Uint8Array,
): number {
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let node = 0; node < distances.length; node += 1) {
    const distance = distances[node] ?? Number.POSITIVE_INFINITY;
    if (visited[node] === 1 || distance >= nearestDistance) continue;
    nearest = node;
    nearestDistance = distance;
  }
  return nearest;
}

function relaxUnvisited(
  own: TopologyNodes,
  current: number,
  distances: Float64Array,
  parents: Int32Array,
  visited: Uint8Array,
): void {
  for (let candidate = 0; candidate < own.nodeCount; candidate += 1) {
    if (visited[candidate] === 1) continue;
    const distance = attractedDistance(own, current, own, candidate);
    if (distance >= (distances[candidate] ?? Number.POSITIVE_INFINITY)) {
      continue;
    }
    distances[candidate] = distance;
    parents[candidate] = current;
  }
}

/**
 * Nearest neighbors of every own node across its own chunk and the halo. A
 * link into the halo is claimed only when this chunk holds the first endpoint,
 * so the neighbour chunk deriving the same pair leaves it to us.
 */
function collectNeighborEdges(
  own: TopologyNodes,
  halo: TopologyNodes,
  neighborsPerNode: number,
  claimedKeys: Set<number>,
): CandidateEdge[] {
  const edges: CandidateEdge[] = [];
  const nearestNodes = new Int32Array(neighborsPerNode);
  const nearestDistances = new Float64Array(neighborsPerNode);
  const totalCount = own.nodeCount + halo.nodeCount;

  for (let node = 0; node < own.nodeCount; node += 1) {
    nearestNodes.fill(-1);
    nearestDistances.fill(Number.POSITIVE_INFINITY);
    for (let candidate = 0; candidate < totalCount; candidate += 1) {
      if (candidate === node) continue;
      const isCandidateOwn = candidate < own.nodeCount;
      const candidateSet = isCandidateOwn ? own : halo;
      const candidateIndex = isCandidateOwn
        ? candidate
        : candidate - own.nodeCount;
      insertNeighbor(
        candidate,
        attractedDistance(own, node, candidateSet, candidateIndex),
        nearestNodes,
        nearestDistances,
      );
    }

    for (const neighbor of nearestNodes) {
      if (neighbor < 0) continue;
      if (neighbor < own.nodeCount) {
        const key = edgeKey(node, neighbor);
        if (claimedKeys.has(key)) continue;
        claimedKeys.add(key);
        edges.push({ ownNode: node, otherNode: neighbor, isOtherOwn: true });
        continue;
      }
      const haloIndex = neighbor - own.nodeCount;
      if (!claimsSeam(own, node, halo, haloIndex)) continue;
      edges.push({ ownNode: node, otherNode: haloIndex, isOtherOwn: false });
    }
  }
  return edges;
}

/**
 * Lexicographic order on the endpoint positions decides which side of a seam
 * draws the cord. Both chunks see the same two nodes and reach the same
 * verdict, so a seam is never drawn twice and never doubled in brightness.
 */
function claimsSeam(
  own: TopologyNodes,
  ownNode: number,
  halo: TopologyNodes,
  haloNode: number,
): boolean {
  const ownOffset = ownNode * COMPONENTS_PER_POSITION;
  const haloOffset = haloNode * COMPONENTS_PER_POSITION;
  for (let component = 0; component < COMPONENTS_PER_POSITION; component += 1) {
    const ownValue = own.positions[ownOffset + component] ?? 0;
    const haloValue = halo.positions[haloOffset + component] ?? 0;
    if (ownValue !== haloValue) return ownValue < haloValue;
  }
  return false;
}

function insertNeighbor(
  node: number,
  distance: number,
  nearestNodes: Int32Array,
  nearestDistances: Float64Array,
): void {
  for (let rank = 0; rank < nearestDistances.length; rank += 1) {
    if (distance >= (nearestDistances[rank] ?? Number.POSITIVE_INFINITY)) {
      continue;
    }
    for (let shift = nearestNodes.length - 1; shift > rank; shift -= 1) {
      nearestNodes[shift] = nearestNodes[shift - 1] ?? -1;
      nearestDistances[shift] =
        nearestDistances[shift - 1] ?? Number.POSITIVE_INFINITY;
    }
    nearestNodes[rank] = node;
    nearestDistances[rank] = distance;
    return;
  }
}

function capEdges(
  spanningEdges: readonly CandidateEdge[],
  neighborEdges: CandidateEdge[],
  own: TopologyNodes,
  halo: TopologyNodes,
  edgeCapacity: number,
): ChunkTopology {
  const spanningKept = Math.min(spanningEdges.length, edgeCapacity);
  const extraBudget = Math.max(0, edgeCapacity - spanningEdges.length);
  if (neighborEdges.length > extraBudget) {
    neighborEdges.sort(
      (first, second) =>
        meanEdgeWeight(second, own, halo) - meanEdgeWeight(first, own, halo),
    );
  }
  const extraKept = Math.min(neighborEdges.length, extraBudget);
  const droppedEdgeCount =
    spanningEdges.length - spanningKept + (neighborEdges.length - extraKept);

  const edgeCount = spanningKept + extraKept;
  const topology = createEmptyTopology(edgeCount, droppedEdgeCount);
  for (let index = 0; index < edgeCount; index += 1) {
    const edge =
      index < spanningKept
        ? spanningEdges[index]
        : neighborEdges[index - spanningKept];
    if (!edge) continue;
    writeEdge(topology, index, edge, own, halo);
  }
  return topology;
}

function writeEdge(
  topology: ChunkTopology,
  index: number,
  edge: CandidateEdge,
  own: TopologyNodes,
  halo: TopologyNodes,
): void {
  const otherSet = edge.isOtherOwn ? own : halo;
  const startOffset = edge.ownNode * COMPONENTS_PER_POSITION;
  const endOffset = edge.otherNode * COMPONENTS_PER_POSITION;
  for (let component = 0; component < COMPONENTS_PER_POSITION; component += 1) {
    topology.edgeStarts[index * COMPONENTS_PER_POSITION + component] =
      own.positions[startOffset + component] ?? 0;
    topology.edgeEnds[index * COMPONENTS_PER_POSITION + component] =
      otherSet.positions[endOffset + component] ?? 0;
  }

  const ownWeight = own.weights[edge.ownNode] ?? 0;
  const otherWeight = otherSet.weights[edge.otherNode] ?? 0;
  topology.edgeWeights[index] = (ownWeight + otherWeight) / 2;
  topology.edgeHubClasses[index] =
    ownWeight >= otherWeight
      ? (own.classIndices[edge.ownNode] ?? 0)
      : (otherSet.classIndices[edge.otherNode] ?? 0);
}

function createEmptyTopology(
  edgeCount = 0,
  droppedEdgeCount = 0,
): ChunkTopology {
  return {
    edgeStarts: new Float32Array(edgeCount * COMPONENTS_PER_POSITION),
    edgeEnds: new Float32Array(edgeCount * COMPONENTS_PER_POSITION),
    edgeWeights: new Float32Array(edgeCount),
    edgeHubClasses: new Uint8Array(edgeCount),
    edgeCount,
    droppedEdgeCount,
  };
}

function meanEdgeWeight(
  edge: CandidateEdge,
  own: TopologyNodes,
  halo: TopologyNodes,
): number {
  const otherSet = edge.isOtherOwn ? own : halo;
  return (
    ((own.weights[edge.ownNode] ?? 0) +
      (otherSet.weights[edge.otherNode] ?? 0)) /
    2
  );
}

/** Squared distance shrunk by endpoint weight, so heavier hubs attract links. */
function attractedDistance(
  firstSet: TopologyNodes,
  first: number,
  secondSet: TopologyNodes,
  second: number,
): number {
  const firstOffset = first * COMPONENTS_PER_POSITION;
  const secondOffset = second * COMPONENTS_PER_POSITION;
  const x =
    (firstSet.positions[firstOffset] ?? 0) -
    (secondSet.positions[secondOffset] ?? 0);
  const y =
    (firstSet.positions[firstOffset + 1] ?? 0) -
    (secondSet.positions[secondOffset + 1] ?? 0);
  const z =
    (firstSet.positions[firstOffset + 2] ?? 0) -
    (secondSet.positions[secondOffset + 2] ?? 0);
  const attraction = Math.max(
    MINIMUM_ATTRACTION_WEIGHT,
    ((firstSet.weights[first] ?? 0) + (secondSet.weights[second] ?? 0)) / 2,
  );
  return (x * x + y * y + z * z) / attraction;
}

function createEdgeKeySet(edges: readonly CandidateEdge[]): Set<number> {
  const keys = new Set<number>();
  for (const edge of edges) keys.add(edgeKey(edge.ownNode, edge.otherNode));
  return keys;
}

/** Numeric undirected key; node indices stay far below the 2^26 packing bound. */
function edgeKey(first: number, second: number): number {
  return first < second
    ? first * 67_108_864 + second
    : second * 67_108_864 + first;
}
