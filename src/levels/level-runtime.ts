/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Create shared level resources, compose configured modules, and connect controls.
 * Boundary: Level files contain authored data; modules own content definitions and resources.
 */

import { createDesktopControls } from "../control/desktop-controls";
import { keepFlightAboveGround } from "../control/flight-ground-clearance";
import {
  type AirParticlesParameters,
  createAirParticlesModule,
} from "../modules/air-particles/air-particles";
import {
  type AnimalsPreset,
  createAnimalsModule,
} from "../modules/animals/animals";
import { ANIMALS_DEFINITION } from "../modules/animals/animals-definition";
import { createGrassModule, type GrassPreset } from "../modules/grass/grass";
import {
  createMagneticSense,
  type MagneticSenseParameters,
} from "../modules/magnetic-sense/magnetic-sense";
import { createRocksModule, type RocksPreset } from "../modules/rocks/rocks";
import { ROCKS_DEFINITION } from "../modules/rocks/rocks-definition";
import { createTerrainModule } from "../modules/terrain/terrain";
import {
  createTerrainColors,
  type TerrainColors,
} from "../modules/terrain/terrain-colors";
import type {
  TerrainMaterialEffect,
  TerrainPresentation,
} from "../modules/terrain/terrain-geometry";
import {
  createVegetationModule,
  type VegetationPreset,
} from "../modules/vegetation/vegetation";
import { VEGETATION_DEFINITION } from "../modules/vegetation/vegetation-definition";
import { createZoneVisualizer } from "../modules/zone-visualizer/zone-visualizer";
import { createTestOverlay } from "../test-ui/test-overlay";
import {
  type GltfAssetRequest,
  type GltfAssets,
  loadGltfAssets,
} from "../utils/asset-loader/gltf-assets";
import type { WorldModule } from "../world/module-runtime";
import {
  startWorld,
  type WorldContext,
  type WorldUpdate,
} from "../world/world-runtime";
import { WORLD_SURFACE_SETTINGS } from "../world-surface/surface-settings";
import {
  createWorldSurface,
  type WorldSurface,
} from "../world-surface/world-surface";
import { ZONE_SETTINGS } from "../world-surface/zone-settings";

interface TerrainPreset {
  readonly opacity: number;
  readonly presentation?: "zones";
  readonly colors?: TerrainColors;
  readonly magneticSense?: MagneticSenseParameters;
}

/** Sparse authored values accepted by the Level Runtime. */
export interface LevelPreset {
  readonly backgroundColor?: number;
  readonly viewDistance?: number;
  readonly testUi?: true;
  readonly airParticles?: AirParticlesParameters;
  readonly terrain?: TerrainPreset;
  readonly grass?: GrassPreset;
  readonly vegetation?: VegetationPreset;
  readonly rocks?: RocksPreset;
  readonly animals?: AnimalsPreset;
}

interface LoadedLevelAssets {
  readonly vegetation: GltfAssets;
  readonly rocks: GltfAssets;
  readonly animals: GltfAssets;
}

interface LevelSetup {
  readonly world: WorldContext;
  readonly level: LevelPreset;
  readonly worldSurface: WorldSurface;
  readonly assets: LoadedLevelAssets;
}

export async function startLevel(
  container: Element | null,
  level: LevelPreset,
): Promise<void> {
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing application root: .app");
  }

  const assets = await loadLevelAssets(level);
  startWorld(container, (world) => setupLevel(container, world, level, assets));
}

function setupLevel(
  container: HTMLElement,
  world: WorldContext,
  level: LevelPreset,
  assets: LoadedLevelAssets,
): WorldUpdate {
  applyLevelPresentation(world, level);

  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const modules = createConfiguredModules({
    world,
    level,
    worldSurface,
    assets,
  });
  activateModules(world, modules);

  const desktopControls = createDesktopControls(
    world.camera,
    world.renderer.domElement,
  );
  const hasGround = hasVisibleSurface(level);
  const testOverlay = level.testUi
    ? createTestOverlay(container, world.renderer)
    : undefined;

  return (deltaSeconds): void => {
    desktopControls.update(deltaSeconds);
    if (hasGround) {
      keepFlightAboveGround(world.camera.position, worldSurface.groundYAt);
    }
    testOverlay?.update(deltaSeconds);
  };
}

function applyLevelPresentation(
  { camera, renderer }: WorldContext,
  level: LevelPreset,
): void {
  if (level.backgroundColor !== undefined) {
    renderer.setClearColor(level.backgroundColor);
  }
  if (level.viewDistance === undefined) return;

  camera.far = level.viewDistance;
  camera.updateProjectionMatrix();
}

function createConfiguredModules(setup: LevelSetup): WorldModule[] {
  const modules: WorldModule[] = [];

  addModule(modules, createTerrain(setup));
  addModule(modules, createAirParticles(setup));
  addModule(modules, createGrass(setup));
  addModule(modules, createVegetation(setup));
  addModule(modules, createRocks(setup));
  addModule(modules, createAnimals(setup));

  return modules;
}

function createTerrain(setup: LevelSetup): WorldModule | undefined {
  const preset = setup.level.terrain;
  if (!preset) return undefined;

  const presentation = createTerrainPresentation(preset, setup.worldSurface);
  const effects: TerrainMaterialEffect[] = [];
  if (preset.magneticSense) {
    effects.push(createMagneticSense(preset.magneticSense));
  }

  return createTerrainModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    worldSurface: setup.worldSurface,
    streamQueue: setup.world.streamQueue,
    parameters: { opacity: preset.opacity },
    presentation,
    effects,
  });
}

function createAirParticles(setup: LevelSetup): WorldModule | undefined {
  const parameters = setup.level.airParticles;
  if (!parameters) return undefined;

  const surfaceYAt = hasVisibleSurface(setup.level)
    ? setup.worldSurface.surfaceYAt
    : undefined;

  return createAirParticlesModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    parameters,
    streamQueue: setup.world.streamQueue,
    surfaceYAt,
  });
}

function createGrass(setup: LevelSetup): WorldModule | undefined {
  const preset = setup.level.grass;
  if (!preset) return undefined;

  return createGrassModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    preset,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
  });
}

function createVegetation(setup: LevelSetup): WorldModule | undefined {
  const preset = setup.level.vegetation;
  if (!preset) return undefined;

  return createVegetationModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    preset,
    assets: setup.assets.vegetation,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
  });
}

function createRocks(setup: LevelSetup): WorldModule | undefined {
  const preset = setup.level.rocks;
  if (!preset) return undefined;

  return createRocksModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    preset,
    assets: setup.assets.rocks,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
  });
}

function createAnimals(setup: LevelSetup): WorldModule | undefined {
  if (!setup.level.animals) return undefined;

  return createAnimalsModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    definition: ANIMALS_DEFINITION,
    preset: setup.level.animals,
    assets: setup.assets.animals,
    worldSurface: setup.worldSurface,
  });
}

function createTerrainPresentation(
  preset: TerrainPreset,
  worldSurface: WorldSurface,
): TerrainPresentation | undefined {
  if (preset.presentation === "zones") {
    return createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  }
  if (preset.colors) {
    return createTerrainColors(
      preset.colors,
      WORLD_SURFACE_SETTINGS,
      worldSurface,
    );
  }
  return undefined;
}

function hasVisibleSurface(level: LevelPreset): boolean {
  return Boolean(
    level.terrain ||
      level.grass ||
      level.vegetation ||
      level.rocks ||
      level.animals,
  );
}

function addModule(
  modules: WorldModule[],
  module: WorldModule | undefined,
): void {
  if (module) modules.push(module);
}

function activateModules(
  world: WorldContext,
  modules: readonly WorldModule[],
): void {
  for (const module of modules) {
    world.modules.load(module);
    world.modules.activate(module);
  }
}

async function loadLevelAssets(level: LevelPreset): Promise<LoadedLevelAssets> {
  const [vegetation, rocks, animals] = await Promise.all([
    loadGltfAssets(
      level.vegetation
        ? createStaticAssetRequests(VEGETATION_DEFINITION.assets)
        : [],
    ),
    loadGltfAssets(
      level.rocks ? createStaticAssetRequests(ROCKS_DEFINITION.assets) : [],
    ),
    loadGltfAssets(
      level.animals
        ? createStaticAssetRequests(ANIMALS_DEFINITION.species)
        : [],
    ),
  ]);

  return { vegetation, rocks, animals };
}

function createStaticAssetRequests(
  assets: readonly { readonly id: string; readonly url: string }[],
): GltfAssetRequest[] {
  return assets.map(({ id, url }) => ({ id, url }));
}
