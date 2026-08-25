/**
 * Purpose: Render reusable multi-part models through compact InstancedMesh buffers.
 * Context: Zero-scaled instances still cost GPU work, so only accepted placements may be drawn.
 * Responsibility: Store matrices per chunk slot and compact active matrices before upload.
 * Boundary: Zones, density, chunk selection, and asset loading remain module-owned.
 */

import { DynamicDrawUsage, Group, InstancedMesh, Matrix4 } from "three";
import { disposeStaticModelAsset, type StaticModelAsset } from "./static-model";

const MATRIX_VALUE_COUNT = 16;

interface InstancedModelSource {
  readonly id: string;
  readonly model: StaticModelAsset;
}

interface InstancedModelVariant extends InstancedModelSource {
  readonly meshes: readonly InstancedMesh[];
  readonly committedMatrices: Float32Array[];
  readonly committedCounts: Uint16Array;
  readonly stagingMatrices: Float32Array[];
  readonly stagingCounts: Uint16Array;
}

export interface InstancedModelPool {
  readonly group: Group;
  readonly variants: ReadonlyMap<string, InstancedModelVariant>;
  readonly maxInstancesPerSlot: number;
  readonly slotCount: number;
  readonly modelMatrix: Matrix4;
  readonly partMatrix: Matrix4;
  needsUpload: boolean;
}

interface InstancedModelPoolOptions {
  readonly name: string;
  readonly sources: readonly InstancedModelSource[];
  readonly slotCount: number;
  readonly maxInstancesPerSlot: number;
}

export function createInstancedModelPool({
  name,
  sources,
  slotCount,
  maxInstancesPerSlot,
}: InstancedModelPoolOptions): InstancedModelPool {
  validatePoolOptions(sources, slotCount, maxInstancesPerSlot);
  const group = new Group();
  group.name = name;
  group.visible = false;
  const variants = new Map<string, InstancedModelVariant>();

  for (const source of sources) {
    const variant = createVariant(source, slotCount, maxInstancesPerSlot);
    for (const mesh of variant.meshes) group.add(mesh);
    variants.set(source.id, variant);
  }

  return {
    group,
    variants,
    maxInstancesPerSlot,
    slotCount,
    modelMatrix: new Matrix4(),
    partMatrix: new Matrix4(),
    needsUpload: false,
  };
}

/** Start replacing one recycled chunk slot while its old GPU data stays visible. */
export function clearModelSlot(
  pool: InstancedModelPool,
  slotIndex: number,
): void {
  validateSlotIndex(pool, slotIndex);
  for (const variant of pool.variants.values()) {
    variant.stagingCounts[slotIndex] = 0;
  }
}

/** Remove an outgoing world slot before another module recycles its support. */
export function discardCommittedModelSlot(
  pool: InstancedModelPool,
  slotIndex: number,
): void {
  validateSlotIndex(pool, slotIndex);
  for (const variant of pool.variants.values()) {
    variant.committedCounts[slotIndex] = 0;
  }
  pool.needsUpload = true;
}

/** Append one accepted model transform to its module-owned chunk slot. */
export function writeModelInstance(
  pool: InstancedModelPool,
  modelId: string,
  slotIndex: number,
  matrix: Matrix4,
): void {
  validateSlotIndex(pool, slotIndex);
  const variant = pool.variants.get(modelId);
  if (!variant) throw new Error(`Unknown instanced model: ${modelId}`);
  const currentCount = variant.stagingCounts[slotIndex] ?? 0;
  if (currentCount >= pool.maxInstancesPerSlot) return;

  const matrices = variant.stagingMatrices[slotIndex];
  if (!matrices) return;
  matrix.toArray(matrices, currentCount * MATRIX_VALUE_COUNT);
  variant.stagingCounts[slotIndex] = currentCount + 1;
}

/** Commit one complete replacement without rebuilding the resident GPU data. */
export function commitModelSlot(
  pool: InstancedModelPool,
  slotIndex: number,
): void {
  validateSlotIndex(pool, slotIndex);
  for (const variant of pool.variants.values()) commitSlot(variant, slotIndex);
  pool.needsUpload = true;
}

/** Compact all committed slots at most once after one or more jobs finish. */
export function uploadCommittedModels(pool: InstancedModelPool): void {
  if (!pool.needsUpload) return;

  for (const variant of pool.variants.values()) publishVariant(pool, variant);
  pool.needsUpload = false;
}

export function disposeInstancedModelPool(pool: InstancedModelPool): void {
  for (const variant of pool.variants.values()) {
    for (const mesh of variant.meshes) mesh.dispose();
    disposeStaticModelAsset(variant.model);
  }
  pool.group.clear();
}

function createVariant(
  source: InstancedModelSource,
  slotCount: number,
  maxInstancesPerSlot: number,
): InstancedModelVariant {
  const capacity = slotCount * maxInstancesPerSlot;
  const meshes = source.model.parts.map((part, partIndex) => {
    const mesh = new InstancedMesh(part.geometry, part.material, capacity);
    mesh.name = `${source.id}-${partIndex}`;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
  });
  const committedMatrices = createSlotMatrices(slotCount, maxInstancesPerSlot);
  const stagingMatrices = createSlotMatrices(slotCount, maxInstancesPerSlot);

  return {
    ...source,
    meshes,
    committedMatrices,
    committedCounts: new Uint16Array(slotCount),
    stagingMatrices,
    stagingCounts: new Uint16Array(slotCount),
  };
}

function createSlotMatrices(
  slotCount: number,
  maxInstancesPerSlot: number,
): Float32Array[] {
  return Array.from(
    { length: slotCount },
    () => new Float32Array(maxInstancesPerSlot * MATRIX_VALUE_COUNT),
  );
}

function commitSlot(variant: InstancedModelVariant, slotIndex: number): void {
  const previous = variant.committedMatrices[slotIndex];
  const replacement = variant.stagingMatrices[slotIndex];
  if (!previous || !replacement) return;

  variant.committedMatrices[slotIndex] = replacement;
  variant.stagingMatrices[slotIndex] = previous;
  variant.committedCounts[slotIndex] = variant.stagingCounts[slotIndex] ?? 0;
}

function publishVariant(
  pool: InstancedModelPool,
  variant: InstancedModelVariant,
): void {
  let writeIndex = 0;
  for (
    let slotIndex = 0;
    slotIndex < variant.committedCounts.length;
    slotIndex += 1
  ) {
    writeIndex = copySlot(pool, variant, slotIndex, writeIndex);
  }

  for (const mesh of variant.meshes) {
    mesh.count = writeIndex;
    mesh.instanceMatrix.clearUpdateRanges();
    if (writeIndex > 0) {
      mesh.instanceMatrix.addUpdateRange(0, writeIndex * MATRIX_VALUE_COUNT);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

function copySlot(
  pool: InstancedModelPool,
  variant: InstancedModelVariant,
  slotIndex: number,
  firstWriteIndex: number,
): number {
  const matrices = variant.committedMatrices[slotIndex];
  const instanceCount = variant.committedCounts[slotIndex] ?? 0;
  if (!matrices) return firstWriteIndex;

  let writeIndex = firstWriteIndex;
  for (
    let instanceIndex = 0;
    instanceIndex < instanceCount;
    instanceIndex += 1
  ) {
    pool.modelMatrix.fromArray(matrices, instanceIndex * MATRIX_VALUE_COUNT);
    writeModelParts(pool, variant, writeIndex);
    writeIndex += 1;
  }
  return writeIndex;
}

function writeModelParts(
  pool: InstancedModelPool,
  variant: InstancedModelVariant,
  writeIndex: number,
): void {
  for (const [partIndex, part] of variant.model.parts.entries()) {
    const mesh = variant.meshes[partIndex];
    if (!mesh) continue;
    pool.partMatrix.multiplyMatrices(pool.modelMatrix, part.sourceMatrix);
    mesh.setMatrixAt(writeIndex, pool.partMatrix);
  }
}

function validatePoolOptions(
  sources: readonly InstancedModelSource[],
  slotCount: number,
  maxInstancesPerSlot: number,
): void {
  const sourceIds = new Set(sources.map(({ id }) => id));
  if (sourceIds.size !== sources.length) {
    throw new Error("Instanced model ids must be unique");
  }
  if (!Number.isInteger(slotCount) || slotCount <= 0) {
    throw new RangeError(
      "Instanced model slotCount must be a positive integer",
    );
  }
  if (
    !Number.isInteger(maxInstancesPerSlot) ||
    maxInstancesPerSlot <= 0 ||
    maxInstancesPerSlot > 65_535
  ) {
    throw new RangeError("Instanced model slot capacity is invalid");
  }
}

function validateSlotIndex(pool: InstancedModelPool, slotIndex: number): void {
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= pool.slotCount
  ) {
    throw new RangeError(`Instanced model slot is out of range: ${slotIndex}`);
  }
}
