/**
 * Purpose: Share the small data contract used by zone-driven static populations.
 * Context: Vegetation and Rocks use the same density and weighted-variant math.
 * Responsibility: Resolve level density, select accepted candidates, and validate definitions.
 * Boundary: Chunk ownership, transforms, Three.js resources, and lifecycle stay in each module.
 */

import {
  type ChunkCandidate,
  type ChunkCandidateGrid,
  createChunkCandidateGrid,
  getCellRandom,
  getChunkCandidate,
} from "../world/chunk-candidates";
import type { ChunkAssignment } from "../world/chunk-system";
import type { WorldSurface } from "../world-surface/world-surface";
import type { ZoneId } from "../world-surface/zone-settings";

const HECTARE_SQUARE_METERS = 10_000;

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
  const zone = worldSurface.zoneAt(candidate.worldX, candidate.worldZ);
  if (zone === "water") return undefined;

  const density = parameters.instancesPerHectareByZone[zone];
  const variants = parameters.variantsByZone[zone];
  if (density === undefined || !variants) return undefined;

  const densityRandom = getCellRandom(
    parameters.seed,
    candidate.cellX,
    candidate.cellZ,
    2,
  );
  if (
    !isCandidateAccepted(density, candidateGrid.spacingMeters, densityRandom)
  ) {
    return undefined;
  }

  const variantRandom = getCellRandom(
    parameters.seed,
    candidate.cellX,
    candidate.cellZ,
    3,
  );
  const model = selectModel(parameters.assets, variants, variantRandom);
  return model ? { candidate, model } : undefined;
}

function isCandidateAccepted(
  instancesPerHectare: number,
  candidateSpacingMeters: number,
  randomValue: number,
): boolean {
  return (
    randomValue <
    (instancesPerHectare * candidateSpacingMeters ** 2) / HECTARE_SQUARE_METERS
  );
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
