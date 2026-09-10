/**
 * Purpose: Share placement and fixed-slot writing for Rocks and Vegetation.
 * Context: Vegetation and Rocks use the same density and weighted-variant math.
 * Responsibility: Stream fixed instance slots and select their accepted candidates.
 * Boundary: Rocks and Vegetation own model construction, colors, effects, and transforms.
 */

import { Matrix4, Quaternion, type Scene, Vector3 } from "three";
import {
  clearModelSlot,
  commitModelSlot,
  createInstancedModelPool,
  discardCommittedModelSlot,
  disposeInstancedModelPool,
  type InstancedModelPool,
  uploadCommittedModels,
} from "../utils/asset-loader/instanced-model-pool";
import type { StaticModelAsset } from "../utils/asset-loader/static-model";
import {
  type ChunkCandidate,
  type ChunkCandidateGrid,
  createChunkCandidateGrid,
  getCellRandom,
  getChunkCandidate,
} from "../world/chunk-candidates";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../world/chunk-system";
import type { WorldModule } from "../world/module-runtime";
import type { StreamQueue } from "../world/stream-queue";
import type { Viewpoint } from "../world/viewpoint";
import type { WorldSurface } from "../world-surface/world-surface";
import type { ZoneId } from "../world-surface/zone-settings";

const HECTARE_SQUARE_METERS = 10_000;
const STATIC_POPULATION_CHUNK_LEVEL = 2;
const GROUND_ZONES: readonly GroundZoneId[] = [
  "meadow",
  "coniferForest",
  "deciduousForest",
  "shrubSlope",
];

/** The cell random component that draws a placement's height from its model. */
const HEIGHT_RANDOM_INDEX = 5;

export type GroundZoneId = Exclude<ZoneId, "water">;

/** The only static-population value authored by a level. */
export interface StaticPopulationPreset {
  readonly instancesPerHectareByZone: Partial<Record<GroundZoneId, number>>;
}

export interface StaticModelDefinition {
  readonly id: string;
  readonly url: string;
  readonly objectName: string;
  readonly minimumHeightMeters: number;
  readonly maximumHeightMeters: number;
}

export interface WeightedStaticModel {
  readonly assetId: string;
  readonly weight: number;
}

/** Fixed content and capacity owned by one concrete module. */
export interface StaticPopulationDefinition {
  readonly seed: number;
  readonly candidateSpacingMeters: number;
  readonly assets: readonly StaticModelDefinition[];
  readonly variantsByZone: Partial<
    Record<GroundZoneId, readonly WeightedStaticModel[]>
  >;
}

/** Complete data consumed by placement after level and module data are combined. */
export interface StaticPopulationParameters
  extends StaticPopulationDefinition,
    StaticPopulationPreset {}

/** One accepted world position and the module-owned model chosen for it. */
export interface StaticPlacement {
  readonly candidate: ChunkCandidate;
  readonly model: StaticModelDefinition;
}

/** Fixed instance buffers and the concrete population's transform policy. */
export interface StaticPopulationInstances {
  readonly parameters: StaticPopulationParameters;
  readonly worldSurface: WorldSurface;
  readonly candidateGrid: ChunkCandidateGrid;
  readonly modelPool: InstancedModelPool;
  readonly matrix: Matrix4;
  readonly position: Vector3;
  readonly rotation: Quaternion;
  readonly scale: Vector3;
  readonly writeTransform: (
    instances: StaticPopulationInstances,
    assignment: ChunkAssignment,
    model: StaticModelDefinition,
    candidate: ChunkCandidate,
  ) => void;
}

/** Allocate the shared pool and scratch transforms after concrete material setup. */
export function createStaticPopulationInstances(options: {
  readonly name: string;
  readonly parameters: StaticPopulationParameters;
  readonly worldSurface: WorldSurface;
  readonly candidateGrid: ChunkCandidateGrid;
  readonly sources: readonly {
    readonly id: string;
    readonly model: StaticModelAsset;
  }[];
  readonly chunkSlotCount: number;
  readonly writeTransform: StaticPopulationInstances["writeTransform"];
}): StaticPopulationInstances {
  return {
    parameters: options.parameters,
    worldSurface: options.worldSurface,
    candidateGrid: options.candidateGrid,
    modelPool: createInstancedModelPool({
      name: options.name,
      sources: options.sources,
      slotCount: options.chunkSlotCount,
      maxInstancesPerSlot: options.candidateGrid.candidateCount,
    }),
    matrix: new Matrix4(),
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(),
    writeTransform: options.writeTransform,
  };
}

export interface StaticPopulationChunkWriter {
  readonly assignment: ChunkAssignment;
  nextRow: number;
}

/** The same fixed-slot lifetime serves Rocks and Vegetation; content stays local. */
export function createStaticPopulationModule(
  options: {
    readonly scene: Scene;
    readonly viewpoint: Viewpoint;
    readonly streamQueue: StreamQueue;
  },
  createInstances: (
    chunkSize: number,
    chunkSlotCount: number,
  ) => StaticPopulationInstances,
): WorldModule {
  let currentStream:
    | {
        readonly chunkWindow: ChunkWindow;
        readonly instances: StaticPopulationInstances;
        readonly slotJobKeys: readonly object[];
      }
    | undefined;

  return {
    load: () => {
      const chunkSize = getChunkSize(STATIC_POPULATION_CHUNK_LEVEL);
      const radius = Math.max(
        1,
        Math.ceil(options.viewpoint.viewDistanceMeters / chunkSize),
      );
      const chunkWindow = new ChunkWindow({
        level: STATIC_POPULATION_CHUNK_LEVEL,
        radius,
      });
      const instances = createInstances(chunkSize, chunkWindow.slotCount);
      currentStream = {
        chunkWindow,
        instances,
        slotJobKeys: Array.from({ length: chunkWindow.slotCount }, () => ({})),
      };
      const { x, z } = options.viewpoint.worldPosition;
      initializeStaticPopulationChunks(instances, chunkWindow.update(x, z));
      options.scene.add(instances.modelPool.group);
    },
    activate: () => {
      if (currentStream) currentStream.instances.modelPool.group.visible = true;
    },
    update: () => {
      const stream = currentStream;
      if (!stream) return;
      uploadCommittedModels(stream.instances.modelPool);
      const { x, z } = options.viewpoint.worldPosition;
      const assignments = stream.chunkWindow.update(x, z);
      discardStaticPopulationChunks(stream.instances, assignments);
      uploadCommittedModels(stream.instances.modelPool);
      for (const assignment of assignments) {
        const key = stream.slotJobKeys[assignment.slotIndex];
        if (!key) continue;
        const writer = { assignment, nextRow: 0 };
        options.streamQueue.enqueue({
          key,
          isCurrent: () =>
            currentStream === stream &&
            stream.chunkWindow.isCurrent(assignment),
          runStep: () => writeNextStaticPopulationRow(stream.instances, writer),
        });
      }
    },
    deactivate: () => {
      if (currentStream)
        currentStream.instances.modelPool.group.visible = false;
    },
    unload: () => {
      const stream = currentStream;
      if (!stream) return;
      currentStream = undefined;
      options.scene.remove(stream.instances.modelPool.group);
      disposeInstancedModelPool(stream.instances.modelPool);
    },
  };
}

/** Fill initial slots synchronously; recycled slots advance through the queue. */
export function initializeStaticPopulationChunks(
  instances: StaticPopulationInstances,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    const writer = { assignment, nextRow: 0 };
    while (!writeNextStaticPopulationRow(instances, writer)) {
      // Complete the slot before the first frame.
    }
  }
  uploadCommittedModels(instances.modelPool);
}

/** Publish a slot only after its last candidate row is complete. */
export function writeNextStaticPopulationRow(
  instances: StaticPopulationInstances,
  writer: StaticPopulationChunkWriter,
): boolean {
  const { assignment } = writer;
  if (writer.nextRow === 0)
    clearModelSlot(instances.modelPool, assignment.slotIndex);
  const firstCandidate = writer.nextRow * instances.candidateGrid.cellsPerSide;
  for (
    let column = 0;
    column < instances.candidateGrid.cellsPerSide;
    column++
  ) {
    const placement = selectStaticPlacement(
      instances.parameters,
      instances.candidateGrid,
      instances.worldSurface,
      assignment,
      firstCandidate + column,
    );
    if (placement) {
      instances.writeTransform(
        instances,
        assignment,
        placement.model,
        placement.candidate,
      );
    }
  }
  writer.nextRow++;
  if (writer.nextRow < instances.candidateGrid.cellsPerSide) return false;
  commitModelSlot(instances.modelPool, assignment.slotIndex);
  return true;
}

/** Hide outgoing slots before Terrain can recycle their ground. */
export function discardStaticPopulationChunks(
  instances: StaticPopulationInstances,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    discardCommittedModelSlot(instances.modelPool, assignment.slotIndex);
  }
}

/**
 * Draw the world height of one placement from its model's authored range.
 * Rendering scales the loaded model to this height, and senses that decorate
 * a population without loading it read the same value, so both agree.
 */
export function getStaticPlacementHeight(
  seed: number,
  model: StaticModelDefinition,
  candidate: ChunkCandidate,
): number {
  const heightRandom = getCellRandom(
    seed,
    candidate.cellX,
    candidate.cellZ,
    HEIGHT_RANDOM_INDEX,
  );
  return (
    model.minimumHeightMeters +
    (model.maximumHeightMeters - model.minimumHeightMeters) * heightRandom
  );
}

export function resolveStaticPopulation(
  definition: StaticPopulationDefinition,
  preset: StaticPopulationPreset,
): StaticPopulationParameters {
  return {
    ...definition,
    instancesPerHectareByZone: preset.instancesPerHectareByZone,
  };
}

/** Apply the shared zone-density and weighted-variant rules to one candidate. */
export function selectStaticPlacement(
  parameters: StaticPopulationParameters,
  candidateGrid: ChunkCandidateGrid,
  worldSurface: WorldSurface,
  assignment: ChunkAssignment,
  candidateIndex: number,
): StaticPlacement | undefined {
  const candidate = getChunkCandidate(
    assignment,
    candidateGrid,
    parameters.seed,
    candidateIndex,
  );
  const influences = worldSurface.zoneInfluencesAt(
    candidate.worldX,
    candidate.worldZ,
  );
  let densityRandom = getCellRandom(
    parameters.seed,
    candidate.cellX,
    candidate.cellZ,
    2,
  );

  // Partition the existing density draw: each zone gets its weighted density.
  // A pure zone keeps the exact old acceptance and independent variant draw.
  for (const zone of GROUND_ZONES) {
    const density = parameters.instancesPerHectareByZone[zone] ?? 0;
    const probability =
      influences[zone] *
      ((density * candidateGrid.spacingMeters ** 2) / HECTARE_SQUARE_METERS);
    if (densityRandom >= probability) {
      densityRandom -= probability;
      continue;
    }
    const variants = parameters.variantsByZone[zone];
    if (!variants) return undefined;
    const variantRandom = getCellRandom(
      parameters.seed,
      candidate.cellX,
      candidate.cellZ,
      3,
    );
    const model = selectModel(parameters.assets, variants, variantRandom);
    return model ? { candidate, model } : undefined;
  }
  return undefined;
}

function selectModel(
  assets: readonly StaticModelDefinition[],
  variants: readonly WeightedStaticModel[],
  randomValue: number,
): StaticModelDefinition | undefined {
  const totalWeight = variants.reduce((sum, { weight }) => sum + weight, 0);
  let remainingWeight = randomValue * totalWeight;

  for (const variant of variants) {
    remainingWeight -= variant.weight;
    if (remainingWeight <= 0) {
      return assets.find(({ id }) => id === variant.assetId);
    }
  }

  return undefined;
}

/** One requested aligned sub-chunk of a module's larger placement chunk. */
export interface StaticAnchorRequest {
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly chunkSizeMeters: number;
}

/** Receive one replayed placement together with its sampled ground height. */
export type PushStaticPlacement = (
  placement: StaticPlacement,
  groundY: number,
) => void;

/**
 * Replay the accepted candidates of one requested chunk and push their world
 * anchors. The request may cover a whole placement chunk or an aligned
 * fraction of one; candidate jitter never leaves its cell, so iterating only
 * the covering cells is exact. Shared by Vegetation and Rocks because the
 * identical replay mechanism is proven twice; extra per-module rejection
 * stays with each provider.
 */
export function appendStaticPlacementAnchors(
  parameters: StaticPopulationParameters,
  candidateGrid: ChunkCandidateGrid,
  worldSurface: WorldSurface,
  moduleChunkSizeMeters: number,
  request: StaticAnchorRequest,
  acceptCandidate: (candidate: ChunkCandidate) => boolean,
  pushAnchor: (worldX: number, worldY: number, worldZ: number) => void,
): void {
  appendStaticPlacements(
    parameters,
    candidateGrid,
    worldSurface,
    moduleChunkSizeMeters,
    request,
    acceptCandidate,
    ({ candidate }, groundY) =>
      pushAnchor(candidate.worldX, groundY, candidate.worldZ),
  );
}

/**
 * Replay the accepted candidates of one requested chunk and push the complete
 * placement, so a consumer can also read which model stands there and how
 * tall it is. `appendStaticPlacementAnchors` is the position-only form of
 * this walk.
 */
export function appendStaticPlacements(
  parameters: StaticPopulationParameters,
  candidateGrid: ChunkCandidateGrid,
  worldSurface: WorldSurface,
  moduleChunkSizeMeters: number,
  request: StaticAnchorRequest,
  acceptCandidate: (candidate: ChunkCandidate) => boolean,
  pushPlacement: PushStaticPlacement,
): void {
  const chunkRatio = moduleChunkSizeMeters / request.chunkSizeMeters;
  const cellsPerRequest = candidateGrid.cellsPerSide / chunkRatio;
  if (!Number.isInteger(chunkRatio) || !Number.isInteger(cellsPerRequest)) {
    throw new RangeError(
      "Anchor requests must align with the placement chunk and candidate grid",
    );
  }

  const moduleChunkX = Math.floor(request.chunkX / chunkRatio);
  const moduleChunkZ = Math.floor(request.chunkZ / chunkRatio);
  const assignment: ChunkAssignment = {
    slotIndex: 0,
    revision: 0,
    chunkX: moduleChunkX,
    chunkZ: moduleChunkZ,
    originX: moduleChunkX * moduleChunkSizeMeters,
    originZ: moduleChunkZ * moduleChunkSizeMeters,
  };
  const firstColumn =
    (request.chunkX - moduleChunkX * chunkRatio) * cellsPerRequest;
  const firstRow =
    (request.chunkZ - moduleChunkZ * chunkRatio) * cellsPerRequest;

  for (let row = firstRow; row < firstRow + cellsPerRequest; row += 1) {
    for (
      let column = firstColumn;
      column < firstColumn + cellsPerRequest;
      column += 1
    ) {
      const placement = selectStaticPlacement(
        parameters,
        candidateGrid,
        worldSurface,
        assignment,
        row * candidateGrid.cellsPerSide + column,
      );
      if (!placement || !acceptCandidate(placement.candidate)) continue;
      pushPlacement(
        placement,
        worldSurface.groundYAt(
          placement.candidate.worldX,
          placement.candidate.worldZ,
        ),
      );
    }
  }
}

export function validateStaticPopulation(
  parameters: StaticPopulationParameters,
  chunkSize: number,
  moduleName: string,
): void {
  const assetIds = new Set(parameters.assets.map(({ id }) => id));
  if (assetIds.size !== parameters.assets.length) {
    throw new Error(`${moduleName} asset ids must be unique`);
  }

  for (const asset of parameters.assets) {
    validateAssetHeight(asset, moduleName);
  }

  createChunkCandidateGrid(chunkSize, parameters.candidateSpacingMeters);
  validateConfiguredZones(parameters, assetIds, moduleName);
}

function validateConfiguredZones(
  parameters: StaticPopulationParameters,
  assetIds: ReadonlySet<string>,
  moduleName: string,
): void {
  const configuredZones = Object.entries(
    parameters.instancesPerHectareByZone,
  ) as Array<[GroundZoneId, number]>;

  for (const [zoneId, density] of configuredZones) {
    validateDensity(density, parameters.candidateSpacingMeters, moduleName);

    const variants = parameters.variantsByZone[zoneId];
    if (!variants || variants.length === 0) {
      throw new Error(`${moduleName} zone ${zoneId} requires asset variants`);
    }

    for (const variant of variants) {
      validateVariant(variant, assetIds, moduleName);
    }
  }
}

function validateAssetHeight(
  asset: StaticModelDefinition,
  moduleName: string,
): void {
  if (
    asset.minimumHeightMeters > 0 &&
    asset.maximumHeightMeters >= asset.minimumHeightMeters
  ) {
    return;
  }

  throw new RangeError(`${moduleName} heights must be positive and ordered`);
}

function validateDensity(
  instancesPerHectare: number,
  candidateSpacingMeters: number,
  moduleName: string,
): void {
  const probability =
    (instancesPerHectare * candidateSpacingMeters ** 2) / HECTARE_SQUARE_METERS;
  if (Number.isFinite(probability) && probability >= 0 && probability <= 1) {
    return;
  }

  throw new RangeError(`${moduleName} density exceeds candidate-grid capacity`);
}

function validateVariant(
  variant: WeightedStaticModel,
  assetIds: ReadonlySet<string>,
  moduleName: string,
): void {
  if (!assetIds.has(variant.assetId)) {
    throw new Error(`Unknown ${moduleName} asset: ${variant.assetId}`);
  }
  if (Number.isFinite(variant.weight) && variant.weight > 0) return;

  throw new RangeError(`${moduleName} variant weights must be positive`);
}
