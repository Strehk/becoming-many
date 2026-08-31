/**
 * Purpose: Build one bounded, connected mycelium web from gathered anchor points.
 * Context: The wurzeln experiment proved MST + nearest-neighbor topology; the worker runs this math.
 * Responsibility: Produce weighted edge pairs deterministically within a fixed edge capacity.
 * Boundary: No Three.js, no worker globals, no chunk knowledge — numeric arrays in and out.
 */

/** Nodes with (near-)zero weight still attract links at this residual pull. */
const MINIMUM_ATTRACTION_WEIGHT = 0.05;

export interface ConnectionTopologyOptions {
  /** Nearest-neighbor edges added per node on top of the spanning backbone. */
  readonly neighborsPerNode: number;
  /** Hard edge budget; spanning edges always survive, extras drop lowest weight first. */
  readonly edgeCapacity: number;
}

export interface ConnectionTopology {
  /** Node index pairs [a, b] per edge, packed. */
  readonly edgePairs: Uint32Array;
  /** Mean endpoint weight per edge; drives cord width and brightness. */
  readonly edgeWeights: Float32Array;
  readonly edgeCount: number;
  /** Edges removed by the capacity cap, lowest combined weight first. */
  readonly droppedEdgeCount: number;
}

/**
 * Connect every node through a minimum spanning backbone plus per-node nearest
 * neighbors. Distances shrink with endpoint weight, so heavier hubs attract
 * links. Deterministic for identical inputs.
 */
export function buildConnectionTopology(
  positions: Float32Array,
  weights: Float32Array,
  options: ConnectionTopologyOptions,
): ConnectionTopology {
  const nodeCount = Math.floor(positions.length / 3);
  if (nodeCount < 2) {
    return {
      edgePairs: new Uint32Array(0),
      edgeWeights: new Float32Array(0),
      edgeCount: 0,
      droppedEdgeCount: 0,
    };
  }

  const spanningEdges = createMinimumSpanningEdges(
    positions,
    weights,
    nodeCount,
  );
  const spanningKeys = createEdgeKeySet(spanningEdges);
  const extraEdges = collectNearestNeighborEdges(
    positions,
    weights,
    nodeCount,
    options.neighborsPerNode,
    spanningKeys,
  );
  return capEdges(spanningEdges, extraEdges, weights, options.edgeCapacity);
}

interface CandidateEdge {
  readonly firstNode: number;
  readonly secondNode: number;
}

function createMinimumSpanningEdges(
  positions: Float32Array,
  weights: Float32Array,
  nodeCount: number,
): CandidateEdge[] {
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
    if (parent >= 0) edges.push({ firstNode: parent, secondNode: current });
    relaxUnvisited(positions, weights, current, distances, parents, visited);
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
  positions: Float32Array,
  weights: Float32Array,
  current: number,
  distances: Float64Array,
  parents: Int32Array,
  visited: Uint8Array,
): void {
  for (let candidate = 0; candidate < distances.length; candidate += 1) {
    if (visited[candidate] === 1) continue;
    const distance = attractedDistance(positions, weights, current, candidate);
    if (distance >= (distances[candidate] ?? Number.POSITIVE_INFINITY)) {
      continue;
    }
    distances[candidate] = distance;
    parents[candidate] = current;
  }
}

function collectNearestNeighborEdges(
  positions: Float32Array,
  weights: Float32Array,
  nodeCount: number,
  neighborsPerNode: number,
  existingKeys: Set<number>,
): CandidateEdge[] {
  const edges: CandidateEdge[] = [];
  const nearestNodes = new Int32Array(neighborsPerNode);
  const nearestDistances = new Float64Array(neighborsPerNode);

  for (let node = 0; node < nodeCount; node += 1) {
    nearestNodes.fill(-1);
    nearestDistances.fill(Number.POSITIVE_INFINITY);
    for (let candidate = 0; candidate < nodeCount; candidate += 1) {
      if (candidate === node) continue;
      insertNeighbor(
        candidate,
        attractedDistance(positions, weights, node, candidate),
        nearestNodes,
        nearestDistances,
      );
    }
    for (const neighbor of nearestNodes) {
      if (neighbor < 0) continue;
      const key = edgeKey(node, neighbor);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      edges.push({ firstNode: node, secondNode: neighbor });
    }
  }
  return edges;
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
  extraEdges: CandidateEdge[],
  weights: Float32Array,
  edgeCapacity: number,
): ConnectionTopology {
  const spanningKept = Math.min(spanningEdges.length, edgeCapacity);
  const extraBudget = Math.max(0, edgeCapacity - spanningEdges.length);
  if (extraEdges.length > extraBudget) {
    extraEdges.sort(
      (first, second) =>
        meanEdgeWeight(second, weights) - meanEdgeWeight(first, weights),
    );
  }
  const extraKept = Math.min(extraEdges.length, extraBudget);
  const droppedEdgeCount =
    spanningEdges.length - spanningKept + (extraEdges.length - extraKept);

  const edgeCount = spanningKept + extraKept;
  const edgePairs = new Uint32Array(edgeCount * 2);
  const edgeWeights = new Float32Array(edgeCount);
  for (let index = 0; index < edgeCount; index += 1) {
    const edge =
      index < spanningKept
        ? spanningEdges[index]
        : extraEdges[index - spanningKept];
    if (!edge) continue;
    edgePairs[index * 2] = edge.firstNode;
    edgePairs[index * 2 + 1] = edge.secondNode;
    edgeWeights[index] = meanEdgeWeight(edge, weights);
  }
  return { edgePairs, edgeWeights, edgeCount, droppedEdgeCount };
}

function meanEdgeWeight(edge: CandidateEdge, weights: Float32Array): number {
  return ((weights[edge.firstNode] ?? 0) + (weights[edge.secondNode] ?? 0)) / 2;
}

/** Squared distance shrunk by endpoint weight, so heavier hubs attract links. */
function attractedDistance(
  positions: Float32Array,
  weights: Float32Array,
  first: number,
  second: number,
): number {
  const firstOffset = first * 3;
  const secondOffset = second * 3;
  const x = (positions[firstOffset] ?? 0) - (positions[secondOffset] ?? 0);
  const y =
    (positions[firstOffset + 1] ?? 0) - (positions[secondOffset + 1] ?? 0);
  const z =
    (positions[firstOffset + 2] ?? 0) - (positions[secondOffset + 2] ?? 0);
  const attraction = Math.max(
    MINIMUM_ATTRACTION_WEIGHT,
    ((weights[first] ?? 0) + (weights[second] ?? 0)) / 2,
  );
  return (x * x + y * y + z * z) / attraction;
}

function createEdgeKeySet(edges: readonly CandidateEdge[]): Set<number> {
  const keys = new Set<number>();
  for (const edge of edges) keys.add(edgeKey(edge.firstNode, edge.secondNode));
  return keys;
}

/** Numeric undirected key; node indices stay far below the 2^26 packing bound. */
function edgeKey(first: number, second: number): number {
  return first < second
    ? first * 67_108_864 + second
    : second * 67_108_864 + first;
}
