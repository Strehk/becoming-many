/**
 * Purpose: Connect zone-driven Rocks to the shared world lifecycle.
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
import { createRockInstances } from "./rock-instances";
import { ROCKS_DEFINITION } from "./rocks-definition";

export interface RockColors {
  readonly darkColor: number;
  readonly lightColor: number;
}

export interface RocksPreset extends StaticPopulationPreset {
  readonly colors: RockColors;
}

export interface RocksModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: RocksPreset;
  readonly assets: GltfAssets;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

export function createRocksModule(options: RocksModuleOptions): WorldModule {
  const parameters = resolveStaticPopulation(ROCKS_DEFINITION, options.preset);
  return createStaticPopulationModule(options, (chunkSize, chunkSlotCount) =>
    createRockInstances({
      parameters,
      colors: options.preset.colors,
      assets: options.assets,
      chunkSize,
      chunkSlotCount,
      worldSurface: options.worldSurface,
      effects: options.effects,
    }),
  );
}
