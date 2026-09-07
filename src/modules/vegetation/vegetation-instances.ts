/**
 * Purpose: Generate compact, fixed-capacity Vegetation instances by world zone.
 * Context: Endless vegetation must recycle chunks without drawing rejected candidates.
 * Responsibility: Own model sources, material policy, and concrete instance transforms.
 * Boundary: Static population writing publishes slots; the module owns streaming and lifecycle.
 */

import { Vector3 } from "three";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import { writeModelInstance } from "../../utils/asset-loader/instanced-model-pool";
import { applyMaterialEffects } from "../../utils/asset-loader/material-effect";
import {
  createStaticModelAsset,
  disposeStaticModelAsset,
  type StaticModelAsset,
} from "../../utils/asset-loader/static-model";
import {
  type ChunkCandidate,
  createChunkCandidateGrid,
  getCellRandom,
} from "../../world/chunk-candidates";
import type { ChunkAssignment } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";
import type {
  StaticModelDefinition,
  StaticPopulationInstances,
  StaticPopulationParameters,
} from "../static-population";
import {
  createStaticPopulationInstances,
  getStaticPlacementHeight,
  validateStaticPopulation,
} from "../static-population";
import type { VegetationColors, VegetationEffectsFor } from "./vegetation";
import {
  getVegetationStature,
  hasVegetationClearance,
} from "./vegetation-definition";

const FULL_ROTATION_RADIANS = Math.PI * 2;
const MINIMUM_HORIZONTAL_SCALE = 0.82;
const MAXIMUM_HORIZONTAL_SCALE = 1.18;
const UP_AXIS = new Vector3(0, 1, 0);

interface VegetationInstancesOptions {
  readonly parameters: StaticPopulationParameters;
  readonly colors: VegetationColors;
  readonly assets: GltfAssets;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly worldSurface: WorldSurface;
  readonly effectsFor?: VegetationEffectsFor;
}

export function createVegetationInstances({
  parameters,
  colors,
  assets,
  chunkSize,
  chunkSlotCount,
  worldSurface,
  effectsFor,
}: VegetationInstancesOptions): StaticPopulationInstances {
  validateStaticPopulation(parameters, chunkSize, "Vegetation");
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    parameters.candidateSpacingMeters,
  );
  const sources: { id: string; model: StaticModelAsset }[] = [];
  try {
    for (const [assetIndex, settings] of parameters.assets.entries()) {
      sources.push({
        id: settings.id,
        model: createStaticModelAsset(
          getLoadedAsset(assets, settings.id),
          settings.objectName,
          (material) => getVegetationColor(colors, material.name, assetIndex),
        ),
      });
    }
    if (effectsFor) {
      // Asked per model rather than once for the layer: a sense may read a bush
      // and a pine as different substances, and this is where that is decided.
      for (const { id, model } of sources) {
        const effects = effectsFor(getVegetationStature(id));
        if (!effects) continue;

        for (const part of model.parts) {
          applyMaterialEffects(effects, part.material);
        }
      }
    }
    return createStaticPopulationInstances({
      name: "Vegetation",
      parameters,
      worldSurface,
      candidateGrid,
      sources,
      chunkSlotCount,
      writeTransform: writeVegetationTransform,
    });
  } catch (error) {
    for (const { model } of sources) disposeStaticModelAsset(model);
    throw error;
  }
}

function getVegetationColor(
  colors: VegetationColors,
  materialName: string,
  assetIndex: number,
): number {
  if (materialName === "trunk") return colors.trunkColor;
  if (materialName === "flower") return colors.flowerColor;
  return assetIndex % 2 === 0 ? colors.leafColor : colors.leafAccentColor;
}

function writeVegetationTransform(
  instances: StaticPopulationInstances,
  assignment: ChunkAssignment,
  settings: StaticModelDefinition,
  candidate: ChunkCandidate,
): void {
  if (!hasVegetationClearance(instances.worldSurface, candidate)) return;
  const variant = instances.modelPool.variants.get(settings.id);
  if (!variant) return;
  const height = getStaticPlacementHeight(
    instances.parameters.seed,
    settings,
    candidate,
  );
  const heightScale = height / variant.model.height;
  const widthScale = getHorizontalScale(instances, candidate, 6);
  const depthScale = getHorizontalScale(instances, candidate, 7);

  const worldY =
    instances.worldSurface.groundYAt(candidate.worldX, candidate.worldZ) -
    variant.model.minimumY * heightScale;

  instances.position.set(candidate.worldX, worldY, candidate.worldZ);
  instances.rotation.setFromAxisAngle(
    UP_AXIS,
    getCellRandom(
      instances.parameters.seed,
      candidate.cellX,
      candidate.cellZ,
      4,
    ) * FULL_ROTATION_RADIANS,
  );
  instances.scale.set(
    heightScale * widthScale,
    heightScale,
    heightScale * depthScale,
  );
  instances.matrix.compose(
    instances.position,
    instances.rotation,
    instances.scale,
  );
  writeModelInstance(
    instances.modelPool,
    settings.id,
    assignment.slotIndex,
    instances.matrix,
  );
}

function getHorizontalScale(
  instances: StaticPopulationInstances,
  candidate: ChunkCandidate,
  randomValueIndex: number,
): number {
  return mix(
    MINIMUM_HORIZONTAL_SCALE,
    MAXIMUM_HORIZONTAL_SCALE,
    getCellRandom(
      instances.parameters.seed,
      candidate.cellX,
      candidate.cellZ,
      randomValueIndex,
    ),
  );
}

function getLoadedAsset(assets: GltfAssets, assetId: string) {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Vegetation asset not loaded: ${assetId}`);
  return asset;
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
