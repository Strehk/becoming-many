/**
 * Purpose: Own the fixed GPU pools rendering the Connections web.
 * Context: The whole web costs two draw calls: instanced cord ribbons and node glows.
 * Responsibility: Allocate bounded buffers, expand topology results, drive animal links.
 * Boundary: Topology, streaming, worker messages, and lifecycle stay in the module.
 */

import {
  BufferAttribute,
  BufferGeometry,
  type Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Points,
  ShaderMaterial,
} from "three";
import { MYCELIUM_SETTINGS } from "./mycelium-settings";
import edgesFragmentShader from "./network-edges.frag.glsl?raw";
import edgesVertexShader from "./network-edges.vert.glsl?raw";
import nodesFragmentShader from "./network-nodes.frag.glsl?raw";
import nodesVertexShader from "./network-nodes.vert.glsl?raw";
import type { ConnectionTopologyResult } from "./topology-messages";

const COMPONENTS_PER_VALUE = 3;
const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/** One resolved per-class appearance in working color space. */
export interface WebSourceStyle {
  readonly color: Color;
  readonly weight: number;
}

export interface ConnectionWeb {
  readonly edges: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly nodes: Points<BufferGeometry, ShaderMaterial>;
  readonly edgeStartAttribute: InstancedBufferAttribute;
  readonly edgeEndAttribute: InstancedBufferAttribute;
  readonly edgeColorAttribute: InstancedBufferAttribute;
  readonly edgeWeightAttribute: InstancedBufferAttribute;
  readonly edgePhaseAttribute: InstancedBufferAttribute;
  readonly nodePositionAttribute: BufferAttribute;
  readonly nodeColorAttribute: BufferAttribute;
  readonly nodeWeightAttribute: BufferAttribute;
  /** Nearest-node hysteresis memory, one slot per animal link row. */
  readonly animalTargetNodes: Int32Array;
  staticEdgeCount: number;
}

/** Allocate both fixed-capacity render objects for the loaded lifetime. */
export function createConnectionWeb(
  uniforms: Record<string, { value: unknown }>,
): ConnectionWeb {
  const { edgeCapacity, nodeCapacity, animalLinkCapacity } = MYCELIUM_SETTINGS;

  const edgeGeometry = new InstancedBufferGeometry();
  // position.x carries the along-cord progress, position.y the ribbon side.
  // The strip is subdivided along its length so the vertex shader can bend
  // the centerline; all cords still share this one base geometry.
  const { positions, indices } = createRibbonStrip(
    MYCELIUM_SETTINGS.edgeSegments,
  );
  edgeGeometry.setAttribute(
    "position",
    new BufferAttribute(positions, COMPONENTS_PER_VALUE),
  );
  edgeGeometry.setIndex(indices);
  const edgeStartAttribute = createInstancedAttribute(edgeCapacity, 3);
  const edgeEndAttribute = createInstancedAttribute(edgeCapacity, 3);
  const edgeColorAttribute = createInstancedAttribute(edgeCapacity, 3);
  const edgeWeightAttribute = createInstancedAttribute(edgeCapacity, 1);
  const edgePhaseAttribute = createInstancedAttribute(edgeCapacity, 1);
  edgeGeometry.setAttribute("edgeStart", edgeStartAttribute);
  edgeGeometry.setAttribute("edgeEnd", edgeEndAttribute);
  edgeGeometry.setAttribute("edgeColor", edgeColorAttribute);
  edgeGeometry.setAttribute("edgeWeight", edgeWeightAttribute);
  edgeGeometry.setAttribute("edgePhase", edgePhaseAttribute);
  edgeGeometry.instanceCount = animalLinkCapacity;

  const edges = new Mesh(
    edgeGeometry,
    createWebMaterial(edgesVertexShader, edgesFragmentShader, uniforms),
  );

  const nodeGeometry = new BufferGeometry();
  const nodePositionAttribute = createDynamicAttribute(nodeCapacity, 3);
  const nodeColorAttribute = createDynamicAttribute(nodeCapacity, 3);
  const nodeWeightAttribute = createDynamicAttribute(nodeCapacity, 1);
  nodeGeometry.setAttribute("position", nodePositionAttribute);
  nodeGeometry.setAttribute("nodeColor", nodeColorAttribute);
  nodeGeometry.setAttribute("nodeWeight", nodeWeightAttribute);
  nodeGeometry.setDrawRange(0, 0);

  const nodes = new Points(
    nodeGeometry,
    createWebMaterial(nodesVertexShader, nodesFragmentShader, uniforms),
  );

  return {
    edges,
    nodes,
    edgeStartAttribute,
    edgeEndAttribute,
    edgeColorAttribute,
    edgeWeightAttribute,
    edgePhaseAttribute,
    nodePositionAttribute,
    nodeColorAttribute,
    nodeWeightAttribute,
    animalTargetNodes: new Int32Array(animalLinkCapacity).fill(-1),
    staticEdgeCount: 0,
  };
}

/** Publish gathered nodes and one worker topology into the fixed pools. */
export function setWebTopology(
  web: ConnectionWeb,
  nodePositions: Float32Array,
  nodeClassIndices: Uint8Array,
  nodeCount: number,
  styles: readonly (WebSourceStyle | undefined)[],
  topology: ConnectionTopologyResult,
): void {
  const { animalLinkCapacity, edgeLiftMeters } = MYCELIUM_SETTINGS;

  for (let node = 0; node < nodeCount; node += 1) {
    const style = styles[nodeClassIndices[node] ?? 0];
    const valueOffset = node * COMPONENTS_PER_VALUE;
    const positionArray = web.nodePositionAttribute.array as Float32Array;
    const colorArray = web.nodeColorAttribute.array as Float32Array;
    positionArray[valueOffset] = nodePositions[valueOffset] ?? 0;
    positionArray[valueOffset + 1] =
      (nodePositions[valueOffset + 1] ?? 0) + edgeLiftMeters;
    positionArray[valueOffset + 2] = nodePositions[valueOffset + 2] ?? 0;
    colorArray[valueOffset] = style?.color.r ?? 0;
    colorArray[valueOffset + 1] = style?.color.g ?? 0;
    colorArray[valueOffset + 2] = style?.color.b ?? 0;
    (web.nodeWeightAttribute.array as Float32Array)[node] = style?.weight ?? 0;
  }
  web.nodes.geometry.setDrawRange(0, nodeCount);
  markNodeRangeChanged(web, nodeCount);

  for (let edge = 0; edge < topology.edgeCount; edge += 1) {
    const firstNode = topology.edgePairs[edge * 2] ?? 0;
    const secondNode = topology.edgePairs[edge * 2 + 1] ?? 0;
    const firstWeight =
      (web.nodeWeightAttribute.array as Float32Array)[firstNode] ?? 0;
    const secondWeight =
      (web.nodeWeightAttribute.array as Float32Array)[secondNode] ?? 0;
    const hubNode = firstWeight >= secondWeight ? firstNode : secondNode;
    const row = animalLinkCapacity + edge;

    writeEdgeEndpoint(web.edgeStartAttribute, row, nodePositions, firstNode);
    writeEdgeEndpoint(web.edgeEndAttribute, row, nodePositions, secondNode);
    copyNodeColor(web, row, hubNode);
    (web.edgeWeightAttribute.array as Float32Array)[row] =
      topology.edgeWeights[edge] ?? 0;
    (web.edgePhaseAttribute.array as Float32Array)[row] = getEdgePhase(
      nodePositions,
      firstNode,
      secondNode,
    );
  }

  web.staticEdgeCount = topology.edgeCount;
  web.edges.geometry.instanceCount = animalLinkCapacity + topology.edgeCount;
  markEdgeRangeChanged(web, 0, animalLinkCapacity + topology.edgeCount);
}

/**
 * Retarget the bounded animal links to the currently visible actors. Nearest
 * nodes keep their previous target within the hysteresis factor so links do
 * not flicker; unused rows collapse to degenerate cords.
 */
export function updateAnimalLinks(
  web: ConnectionWeb,
  actorPositions: Float32Array,
  nodePositions: Float32Array,
  nodeCount: number,
  animalStyle: WebSourceStyle,
): void {
  const { animalLinkCapacity, edgeLiftMeters, animalLinkHysteresis } =
    MYCELIUM_SETTINGS;
  const actorCount = Math.min(
    Math.floor(actorPositions.length / 3),
    animalLinkCapacity,
  );

  for (let row = 0; row < animalLinkCapacity; row += 1) {
    if (row >= actorCount || nodeCount === 0) {
      web.animalTargetNodes[row] = -1;
      collapseEdgeRow(web, row);
      continue;
    }

    const actorX = actorPositions[row * 3] ?? 0;
    const actorY = actorPositions[row * 3 + 1] ?? 0;
    const actorZ = actorPositions[row * 3 + 2] ?? 0;
    const nearestNode = findNearestNode(
      nodePositions,
      nodeCount,
      actorX,
      actorY,
      actorZ,
    );
    const previousNode = web.animalTargetNodes[row] ?? -1;
    const targetNode =
      previousNode >= 0 &&
      previousNode < nodeCount &&
      nodeDistanceSquared(
        nodePositions,
        previousNode,
        actorX,
        actorY,
        actorZ,
      ) <=
        nodeDistanceSquared(
          nodePositions,
          nearestNode,
          actorX,
          actorY,
          actorZ,
        ) *
          animalLinkHysteresis ** 2
        ? previousNode
        : nearestNode;
    web.animalTargetNodes[row] = targetNode;

    writeEdgeEndpoint(web.edgeStartAttribute, row, nodePositions, targetNode);
    const endArray = web.edgeEndAttribute.array as Float32Array;
    endArray[row * 3] = actorX;
    endArray[row * 3 + 1] = actorY + edgeLiftMeters;
    endArray[row * 3 + 2] = actorZ;
    const colorArray = web.edgeColorAttribute.array as Float32Array;
    colorArray[row * 3] = animalStyle.color.r;
    colorArray[row * 3 + 1] = animalStyle.color.g;
    colorArray[row * 3 + 2] = animalStyle.color.b;
    (web.edgeWeightAttribute.array as Float32Array)[row] = animalStyle.weight;
    (web.edgePhaseAttribute.array as Float32Array)[row] =
      row / animalLinkCapacity;
  }

  markEdgeRangeChanged(web, 0, animalLinkCapacity);
}

export function disposeConnectionWeb(web: ConnectionWeb): void {
  web.edges.geometry.dispose();
  web.edges.material.dispose();
  web.nodes.geometry.dispose();
  web.nodes.material.dispose();
}

/** Build one subdivided two-sided strip: progress along x, side along y. */
function createRibbonStrip(segments: number): {
  positions: Float32Array;
  indices: number[];
} {
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const indices: number[] = [];
  for (let segment = 0; segment <= segments; segment += 1) {
    const progress = segment / segments;
    const valueOffset = segment * 2 * 3;
    positions[valueOffset] = progress;
    positions[valueOffset + 1] = -1;
    positions[valueOffset + 3] = progress;
    positions[valueOffset + 4] = 1;
    if (segment === 0) continue;
    const right = segment * 2;
    const left = right - 2;
    indices.push(left, right, left + 1, right, right + 1, left + 1);
  }
  return { positions, indices };
}

/**
 * The strands blend over whatever the carried world shows beneath them
 * (motion-trail precedent): thin geometry keeps the transparent overdraw
 * small, and depth testing still lets hills and rocks occlude the web.
 */
function createWebMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, { value: unknown }>,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
}

function createInstancedAttribute(
  capacity: number,
  itemSize: number,
): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(
    new Float32Array(capacity * itemSize),
    itemSize,
  );
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

function createDynamicAttribute(
  capacity: number,
  itemSize: number,
): BufferAttribute {
  const attribute = new BufferAttribute(
    new Float32Array(capacity * itemSize),
    itemSize,
  );
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

function writeEdgeEndpoint(
  attribute: InstancedBufferAttribute,
  row: number,
  nodePositions: Float32Array,
  node: number,
): void {
  const array = attribute.array as Float32Array;
  const nodeOffset = node * COMPONENTS_PER_VALUE;
  array[row * 3] = nodePositions[nodeOffset] ?? 0;
  array[row * 3 + 1] =
    (nodePositions[nodeOffset + 1] ?? 0) + MYCELIUM_SETTINGS.edgeLiftMeters;
  array[row * 3 + 2] = nodePositions[nodeOffset + 2] ?? 0;
}

function copyNodeColor(web: ConnectionWeb, row: number, node: number): void {
  const nodeColors = web.nodeColorAttribute.array as Float32Array;
  const edgeColors = web.edgeColorAttribute.array as Float32Array;
  edgeColors[row * 3] = nodeColors[node * 3] ?? 0;
  edgeColors[row * 3 + 1] = nodeColors[node * 3 + 1] ?? 0;
  edgeColors[row * 3 + 2] = nodeColors[node * 3 + 2] ?? 0;
}

function collapseEdgeRow(web: ConnectionWeb, row: number): void {
  const startArray = web.edgeStartAttribute.array as Float32Array;
  const endArray = web.edgeEndAttribute.array as Float32Array;
  for (let component = 0; component < 3; component += 1) {
    startArray[row * 3 + component] = 0;
    endArray[row * 3 + component] = 0;
  }
}

function findNearestNode(
  nodePositions: Float32Array,
  nodeCount: number,
  x: number,
  y: number,
  z: number,
): number {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let node = 0; node < nodeCount; node += 1) {
    const distance = nodeDistanceSquared(nodePositions, node, x, y, z);
    if (distance >= nearestDistance) continue;
    nearest = node;
    nearestDistance = distance;
  }
  return nearest;
}

function nodeDistanceSquared(
  nodePositions: Float32Array,
  node: number,
  x: number,
  y: number,
  z: number,
): number {
  const offset = node * COMPONENTS_PER_VALUE;
  const deltaX = (nodePositions[offset] ?? 0) - x;
  const deltaY = (nodePositions[offset + 1] ?? 0) - y;
  const deltaZ = (nodePositions[offset + 2] ?? 0) - z;
  return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
}

/** Deterministic pulse phase from quantized world endpoints, stable across regeneration. */
function getEdgePhase(
  nodePositions: Float32Array,
  firstNode: number,
  secondNode: number,
): number {
  const firstOffset = firstNode * COMPONENTS_PER_VALUE;
  const secondOffset = secondNode * COMPONENTS_PER_VALUE;
  let hash = Math.imul(Math.round(nodePositions[firstOffset] ?? 0), 73_856_093);
  hash ^= Math.imul(
    Math.round(nodePositions[firstOffset + 2] ?? 0),
    19_349_663,
  );
  hash ^= Math.imul(Math.round(nodePositions[secondOffset] ?? 0), 83_492_791);
  hash ^= Math.imul(
    Math.round(nodePositions[secondOffset + 2] ?? 0),
    2_971_215_073,
  );
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}

function markNodeRangeChanged(web: ConnectionWeb, nodeCount: number): void {
  addRange(web.nodePositionAttribute, nodeCount * COMPONENTS_PER_VALUE);
  addRange(web.nodeColorAttribute, nodeCount * COMPONENTS_PER_VALUE);
  addRange(web.nodeWeightAttribute, nodeCount);
}

function markEdgeRangeChanged(
  web: ConnectionWeb,
  firstRow: number,
  rowCount: number,
): void {
  for (const attribute of [
    web.edgeStartAttribute,
    web.edgeEndAttribute,
    web.edgeColorAttribute,
  ]) {
    attribute.addUpdateRange(firstRow * 3, rowCount * 3);
    attribute.needsUpdate = true;
  }
  for (const attribute of [web.edgeWeightAttribute, web.edgePhaseAttribute]) {
    attribute.addUpdateRange(firstRow, rowCount);
    attribute.needsUpdate = true;
  }
}

function addRange(attribute: BufferAttribute, valueCount: number): void {
  attribute.addUpdateRange(0, valueCount);
  attribute.needsUpdate = true;
}
