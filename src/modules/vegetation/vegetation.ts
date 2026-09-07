/**
 * Purpose: Connect zone-driven Vegetation to the shared world lifecycle.
 * Context: Fixed instancing must follow the player through an endless landscape.
 * Responsibility: Bind authored content, model assets, and material effects.
 * Boundary: Static population owns the shared slot lifetime; instance transforms stay local.
 */

import type { Scene } from "three";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamQueue } from "../../world/stream-queue";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  createStaticPopulationModule,
  resolveStaticPopulation,
  type StaticPopulationPreset,
} from "../static-population";
import {
  VEGETATION_DEFINITION,
  type VegetationStature,
} from "./vegetation-definition";
import { createVegetationInstances } from "./vegetation-instances";

export interface VegetationColors {
  readonly trunkColor: number;
  readonly leafColor: number;
  readonly leafAccentColor: number;
  readonly flowerColor: number;
}

export interface VegetationPreset extends StaticPopulationPreset {
  readonly colors: VegetationColors;
}

/**
 * Supply the effects one stature of plant is drawn with. It is asked once per
 * model at load, so a sense that reads a bush and a pine as different
 * substances answers differently for each without knowing the asset list.
 */
export type VegetationEffectsFor = (
  stature: VegetationStature,
) => readonly UnlitMaterialEffect[] | undefined;

export interface VegetationModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: VegetationPreset;
  readonly assets: GltfAssets;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
  readonly effectsFor?: VegetationEffectsFor;
}

export function createVegetationModule(
  options: VegetationModuleOptions,
): WorldModule {
  const parameters = resolveStaticPopulation(
    VEGETATION_DEFINITION,
    options.preset,
  );
  return createStaticPopulationModule(options, (chunkSize, chunkSlotCount) =>
    createVegetationInstances({
      parameters,
      colors: options.preset.colors,
      assets: options.assets,
      chunkSize,
      chunkSlotCount,
      worldSurface: options.worldSurface,
      effectsFor: options.effectsFor,
    }),
  );
}
