/**
 * Purpose: Own the fixed GPU pools rendering the Connections web.
 * Context: The whole web costs two draw calls: instanced cord ribbons and node glows.
 * Responsibility: Allocate bounded buffers and let one chunk rewrite its own range alone.
 * Boundary: Topology, streaming, worker messages, and lifecycle stay in the module.
 *
 * Every chunk owns one contiguous node range and one contiguous edge range, the
 * grass field's discipline. Writing an entering chunk therefore cannot disturb a
 * resident one, which is what keeps cords already on screen from moving when the
 * window recentres. Rows a chunk does not fill collapse: degenerate cords and
 * negatively weighted nodes are rejected in the vertex stage.
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

/** Weight marking a node row as unfilled; the vertex stage collapses it. */
const EMPTY_NODE_WEIGHT = -1;

/** One resolved per-class appearance in working color space. */
export interface WebSourceStyle {
  readonly color: Color;
  readonly weight: number;
}

/** Slot counts of the two windows the pools are cut into. */
export interface WebPoolLayout {
  readonly gatherSlotCount: number;
  readonly buildSlotCount: number;
}

export interface ConnectionWeb {
  readonly edges: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly nodes: Points<BufferGeometry, ShaderMaterial>;
  readonly edgeStartAttribute: InstancedBufferAttribute;
  readonly edgeEndAttribute: InstancedBufferAttribute;
  readonly edgeColorAttribute: InstancedBufferAttribute;
  readonly edgeWeightAttribute: InstancedBufferAttribute;
  readonly edgePhaseAttribute: InstancedBufferAttribute;
  /** Seconds on the module clock when the row was written; drives the fade-in. */
  readonly edgeUploadAttribute: InstancedBufferAttribute;
  readonly nodePositionAttribute: BufferAttribute;
  readonly nodeColorAttribute: BufferAttribute;
  readonly nodeWeightAttribute: BufferAttribute;
  /** Nearest-node hysteresis memory, one slot per animal link row. */
  readonly animalTargetNodes: Int32Array;
}

/** Allocate both fixed-capacity render objects for the loaded lifetime. */
export function createConnectionWeb(
  uniforms: Record<string, { value: unknown }>,
  layout: WebPoolLayout,
): ConnectionWeb {
  const { animalLinkCapacity, nodeSlotCapacity, edgeSlotCapacity } =
    MYCELIUM_SETTINGS;
  const nodeCapacity = layout.gatherSlotCount * nodeSlotCapacity;
  const edgeCapacity =
    animalLinkCapacity + layout.buildSlotCount * edgeSlotCapacity;

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
  const edgeUploadAttribute = createInstancedAttribute(edgeCapacity, 1);
  edgeGeometry.setAttribute("edgeStart", edgeStartAttribute);
  edgeGeometry.setAttribute("edgeEnd", edgeEndAttribute);
  edgeGeometry.setAttribute("edgeColor", edgeColorAttribute);
  edgeGeometry.setAttribute("edgeWeight", edgeWeightAttribute);
  edgeGeometry.setAttribute("edgePhase", edgePhaseAttribute);
  edgeGeometry.setAttribute("edgeUpload", edgeUploadAttribute);
  // Every row is drawn every frame; unfilled and out-of-reach rows collapse in
  // the vertex stage, which is cheaper than tracking a moving instance count
  // across slots that fill in any order.
  edgeGeometry.instanceCount = edgeCapacity;

  const edges = new Mesh(
    edgeGeometry,
    createWebMaterial(edgesVertexShader, edgesFragmentShader, uniforms),
  );

  const nodeGeometry = new BufferGeometry();
  const nodePositionAttribute = createDynamicAttribute(nodeCapacity, 3);
  const nodeColorAttribute = createDynamicAttribute(nodeCapacity, 3);
  const nodeWeightAttribute = createDynamicAttribute(nodeCapacity, 1);
  (nodeWeightAttribute.array as Float32Array).fill(EMPTY_NODE_WEIGHT);
  nodeGeometry.setAttribute("position", nodePositionAttribute);
  nodeGeometry.setAttribute("nodeColor", nodeColorAttribute);
  nodeGeometry.setAttribute("nodeWeight", nodeWeightAttribute);
  nodeGeometry.setDrawRange(0, nodeCapacity);

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
    edgeUploadAttribute,
    nodePositionAttribute,
    nodeColorAttribute,
    nodeWeightAttribute,
    animalTargetNodes: new Int32Array(
      MYCELIUM_SETTINGS.animalLinkCapacity,
    ).fill(-1),
  };
}

/** First node row of one gather slot; the module reads anchors back from here. */
export function getNodeSlotOffset(slotIndex: number): number {
  return slotIndex * MYCELIUM_SETTINGS.nodeSlotCapacity;
}

/** Publish one gathered chunk into its own node range. */
export function writeSlotNodes(
  web: ConnectionWeb,
  slotIndex: number,
  positions: Float32Array,
  classIndices: Uint8Array,
  nodeCount: number,
  styles: readonly (WebSourceStyle | undefined)[],
): void {
  const { nodeSlotCapacity } = MYCELIUM_SETTINGS;
  const firstRow = getNodeSlotOffset(slotIndex);
  const positionArray = web.nodePositionAttribute.array as Float32Array;
  const colorArray = web.nodeColorAttribute.array as Float32Array;
  const weightArray = web.nodeWeightAttribute.array as Float32Array;

  for (let row = 0; row < nodeSlotCapacity; row += 1) {
    const target = (firstRow + row) * COMPONENTS_PER_VALUE;
    if (row >= nodeCount) {
      weightArray[firstRow + row] = EMPTY_NODE_WEIGHT;
      continue;
    }
    const source = row * COMPONENTS_PER_VALUE;
    const style = styles[classIndices[row] ?? 0];
    positionArray[target] = positions[source] ?? 0;
    positionArray[target + 1] = positions[source + 1] ?? 0;
    positionArray[target + 2] = positions[source + 2] ?? 0;
    writeStyleColor(colorArray, target, style);
    weightArray[firstRow + row] = style?.weight ?? 0;
  }

  markNodeRangeChanged(web, firstRow, nodeSlotCapacity);
}

/**
 * Publish one chunk's finished topology into its own edge range. The upload
 * stamp is what the fade-in reads, so ground entering the window grows in over
 * a moment instead of appearing between two frames.
 */
export function writeSlotEdges(
  web: ConnectionWeb,
  result: ConnectionTopologyResult,
  styles: readonly (WebSourceStyle | undefined)[],
  uploadSeconds: number,
): void {
  const { animalLinkCapacity, edgeSlotCapacity } = MYCELIUM_SETTINGS;
  const firstRow =
    animalLinkCapacity + result.buildSlotIndex * edgeSlotCapacity;
  const startArray = web.edgeStartAttribute.array as Float32Array;
  const endArray = web.edgeEndAttribute.array as Float32Array;
  const colorArray = web.edgeColorAttribute.array as Float32Array;
  const weightArray = web.edgeWeightAttribute.array as Float32Array;
  const phaseArray = web.edgePhaseAttribute.array as Float32Array;
  const uploadArray = web.edgeUploadAttribute.array as Float32Array;
  const edgeCount = Math.min(result.edgeCount, edgeSlotCapacity);

  for (let row = 0; row < edgeSlotCapacity; row += 1) {
    const target = (firstRow + row) * COMPONENTS_PER_VALUE;
    if (row >= edgeCount) {
      for (
        let component = 0;
        component < COMPONENTS_PER_VALUE;
        component += 1
      ) {
        startArray[target + component] = 0;
        endArray[target + component] = 0;
      }
      continue;
    }
    const source = row * COMPONENTS_PER_VALUE;
    for (let component = 0; component < COMPONENTS_PER_VALUE; component += 1) {
      startArray[target + component] =
        result.edgeStarts[source + component] ?? 0;
      endArray[target + component] = result.edgeEnds[source + component] ?? 0;
    }
    writeStyleColor(
      colorArray,
      target,
      styles[result.edgeHubClasses[row] ?? 0],
    );
    weightArray[firstRow + row] = result.edgeWeights[row] ?? 0;
    phaseArray[firstRow + row] = getEdgePhase(
      result.edgeStarts,
      result.edgeEnds,
      row,
    );
    uploadArray[firstRow + row] = uploadSeconds;
  }

  markEdgeRangeChanged(web, firstRow, edgeSlotCapacity);
}

/**
 * Retarget the bounded animal links to the currently visible actors. Nearest
 * nodes keep their previous target within the hysteresis factor so links do
 * not flicker; unused rows collapse to degenerate cords.
 */
export function updateAnimalLinks(
  web: ConnectionWeb,
  actorPositions: Float32Array,
  animalStyle: WebSourceStyle,
  uploadSeconds: number,
): void {
  const { animalLinkCapacity, animalLinkHysteresis } = MYCELIUM_SETTINGS;
  const nodePositions = web.nodePositionAttribute.array as Float32Array;
  const nodeWeights = web.nodeWeightAttribute.array as Float32Array;
  const actorCount = Math.min(
    Math.floor(actorPositions.length / 3),
    animalLinkCapacity,
  );

  for (let row = 0; row < animalLinkCapacity; row += 1) {
    const actorX = actorPositions[row * 3] ?? 0;
    const actorY = actorPositions[row * 3 + 1] ?? 0;
    const actorZ = actorPositions[row * 3 + 2] ?? 0;
    const nearestNode =
      row >= actorCount
        ? -1
        : findNearestNode(nodePositions, nodeWeights, actorX, actorY, actorZ);
    if (nearestNode < 0) {
      web.animalTargetNodes[row] = -1;
      collapseEdgeRow(web, row);
      continue;
    }

    const previousNode = web.animalTargetNodes[row] ?? -1;
    const targetNode =
      previousNode >= 0 &&
      (nodeWeights[previousNode] ?? EMPTY_NODE_WEIGHT) >= 0 &&
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
    endArray[row * 3 + 1] = actorY;
    endArray[row * 3 + 2] = actorZ;
    const colorArray = web.edgeColorAttribute.array as Float32Array;
    colorArray[row * 3] = animalStyle.color.r;
    colorArray[row * 3 + 1] = animalStyle.color.g;
    colorArray[row * 3 + 2] = animalStyle.color.b;
    (web.edgeWeightAttribute.array as Float32Array)[row] = animalStyle.weight;
    (web.edgePhaseAttribute.array as Float32Array)[row] =
      row / animalLinkCapacity;
    // A live link follows its animal, so it is never new: stamping it in the
    // past keeps it out of the fade the streamed cords use.
    (web.edgeUploadAttribute.array as Float32Array)[row] =
      uploadSeconds - MYCELIUM_SETTINGS.edgeFadeSeconds;
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
 * (motion-trail precedent): thin geometry keeps the transparent overdraw small,
 * and depth testing lets the world's opaque content occlude the web. The mat
 * is buried, so what it is read through is the ground's own opened alpha — far
 * enough on bare earth to show the cords, nearly solid under a lawn, where the
 * grass blades' own depth weakens them further.
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

/** An unstyled class writes black, which the alpha test then drops anyway. */
function writeStyleColor(
  colorArray: Float32Array,
  offset: number,
  style: WebSourceStyle | undefined,
): void {
  colorArray[offset] = style?.color.r ?? 0;
  colorArray[offset + 1] = style?.color.g ?? 0;
  colorArray[offset + 2] = style?.color.b ?? 0;
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
  array[row * 3 + 1] = nodePositions[nodeOffset + 1] ?? 0;
  array[row * 3 + 2] = nodePositions[nodeOffset + 2] ?? 0;
}

function collapseEdgeRow(web: ConnectionWeb, row: number): void {
  const startArray = web.edgeStartAttribute.array as Float32Array;
  const endArray = web.edgeEndAttribute.array as Float32Array;
  for (let component = 0; component < 3; component += 1) {
    startArray[row * 3 + component] = 0;
    endArray[row * 3 + component] = 0;
  }
}

/** Nearest filled node row across the whole pool; unfilled rows are skipped. */
function findNearestNode(
  nodePositions: Float32Array,
  nodeWeights: Float32Array,
  x: number,
  y: number,
  z: number,
): number {
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let node = 0; node < nodeWeights.length; node += 1) {
    if ((nodeWeights[node] ?? EMPTY_NODE_WEIGHT) < 0) continue;
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

/** Deterministic pulse phase from quantized world endpoints, stable across rebuilds. */
function getEdgePhase(
  edgeStarts: Float32Array,
  edgeEnds: Float32Array,
  edge: number,
): number {
  const offset = edge * COMPONENTS_PER_VALUE;
  let hash = Math.imul(Math.round(edgeStarts[offset] ?? 0), 73_856_093);
  hash ^= Math.imul(Math.round(edgeStarts[offset + 2] ?? 0), 19_349_663);
  hash ^= Math.imul(Math.round(edgeEnds[offset] ?? 0), 83_492_791);
  hash ^= Math.imul(Math.round(edgeEnds[offset + 2] ?? 0), 2_971_215_073);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}

function markNodeRangeChanged(
  web: ConnectionWeb,
  firstRow: number,
  rowCount: number,
): void {
  web.nodePositionAttribute.addUpdateRange(
    firstRow * COMPONENTS_PER_VALUE,
    rowCount * COMPONENTS_PER_VALUE,
  );
  web.nodePositionAttribute.needsUpdate = true;
  web.nodeColorAttribute.addUpdateRange(
    firstRow * COMPONENTS_PER_VALUE,
    rowCount * COMPONENTS_PER_VALUE,
  );
  web.nodeColorAttribute.needsUpdate = true;
  web.nodeWeightAttribute.addUpdateRange(firstRow, rowCount);
  web.nodeWeightAttribute.needsUpdate = true;
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
  for (const attribute of [
    web.edgeWeightAttribute,
    web.edgePhaseAttribute,
    web.edgeUploadAttribute,
  ]) {
    attribute.addUpdateRange(firstRow, rowCount);
    attribute.needsUpdate = true;
  }
}
