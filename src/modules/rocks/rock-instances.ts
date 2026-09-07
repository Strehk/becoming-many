/**
 * Purpose: Generate compact, fixed-capacity Rock instances by world zone.
 * Context: Endless rocks must recycle chunks without drawing rejected candidates.
 * Responsibility: Own model sources, material policy, and concrete instance transforms.
 * Boundary: Static population writing publishes slots; the module owns streaming and lifecycle.
 */

import { Vector3 } from "three";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import { writeModelInstance } from "../../utils/asset-loader/instanced-model-pool";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
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
import type { RockColors } from "./rocks";

const FULL_ROTATION_RADIANS = Math.PI * 2;
const UP_AXIS = new Vector3(0, 1, 0);

interface RockInstancesOptions {
  readonly parameters: StaticPopulationParameters;
  readonly colors: RockColors;
  readonly assets: GltfAssets;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

export function createRockInstances({
  parameters,
  colors,
  assets,
  chunkSize,
  chunkSlotCount,
  worldSurface,
  effects,
}: RockInstancesOptions): StaticPopulationInstances {
  validateStaticPopulation(parameters, chunkSize, "Rock");
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
          (material) => getRockColor(colors, material.name, assetIndex),
        ),
      });
    }
    if (effects) {
      for (const { model } of sources) {
        for (const part of model.parts) {
          applyMaterialEffects(effects, part.material);
        }
      }
    }
    return createStaticPopulationInstances({
      name: "Rocks",
      parameters,
      worldSurface,
      candidateGrid,
      sources,
      chunkSlotCount,
      writeTransform: writeRockTransform,
    });
  } catch (error) {
    for (const { model } of sources) disposeStaticModelAsset(model);
    throw error;
  }
}

function getRockColor(
  colors: RockColors,
  materialName: string,
  assetIndex: number,
): number {
  if (materialName === "light") return colors.lightColor;
  if (materialName === "dark") return colors.darkColor;
  return assetIndex % 2 === 0 ? colors.darkColor : colors.lightColor;
}

function writeRockTransform(
  instances: StaticPopulationInstances,
  assignment: ChunkAssignment,
  settings: StaticModelDefinition,
  candidate: ChunkCandidate,
): void {
  const variant = instances.modelPool.variants.get(settings.id);
  if (!variant) return;
  const height = getStaticPlacementHeight(
    instances.parameters.seed,
    settings,
    candidate,
  );
  const scale = height / variant.model.height;
  const worldY =
    instances.worldSurface.groundYAt(candidate.worldX, candidate.worldZ) -
    variant.model.minimumY * scale;

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
  instances.scale.setScalar(scale);
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

function getLoadedAsset(assets: GltfAssets, assetId: string) {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Rock asset not loaded: ${assetId}`);
  return asset;
}
