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
  type AnimalsModuleHandle,
  type AnimalsPreset,
  createAnimalsModule,
} from "../modules/animals/animals";
import { ANIMALS_DEFINITION } from "../modules/animals/animals-definition";
import type { ConnectionNodeSource } from "../modules/connection-nodes";
import {
  createEchoDepth,
  type EchoDepthEffect,
  type EchoDepthParameters,
} from "../modules/echo-depth/echo-depth";
import { createGrassModule, type GrassPreset } from "../modules/grass/grass";
import {
  createMagneticSense,
  type MagneticSenseEffects,
  type MagneticSenseParameters,
} from "../modules/magnetic-sense/magnetic-sense";
import {
  createMotionSenseModule,
  type MotionSenseParameters,
} from "../modules/motion-sense/motion-sense";
import {
  type ConnectionsParameters,
  createConnectionsModule,
} from "../modules/mycelium/mycelium";
import { createRockConnectionSource } from "../modules/rocks/rock-nodes";
import { createRocksModule, type RocksPreset } from "../modules/rocks/rocks";
import { ROCKS_DEFINITION } from "../modules/rocks/rocks-definition";
import { createScentConnectionSource } from "../modules/scent-particles/scent-emitter-anchors";
import {
  createScentParticlesModule,
  type ScentParticlesParameters,
} from "../modules/scent-particles/scent-particles";
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
  createThermalPerception,
  type ThermalPerceptionEffects,
  type ThermalPerceptionParameters,
} from "../modules/thermal-perception/thermal-perception";
import {
  createVegetationModule,
  type VegetationPreset,
} from "../modules/vegetation/vegetation";
import { VEGETATION_DEFINITION } from "../modules/vegetation/vegetation-definition";
import { createVegetationConnectionSource } from "../modules/vegetation/vegetation-nodes";
import { createZoneVisualizer } from "../modules/zone-visualizer/zone-visualizer";
import { createTestOverlay } from "../test-ui/test-overlay";
import {
  type GltfAssetRequest,
  type GltfAssets,
  loadGltfAssets,
} from "../utils/asset-loader/gltf-assets";
import type { UnlitMaterialEffect } from "../utils/asset-loader/material-effect";
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
}

/** Sparse authored values accepted by the Level Runtime. */
export interface LevelPreset {
  readonly backgroundColor?: number;
  readonly viewDistance?: number;
  readonly testUi?: true;

  /** Clamp flight above the shared world surface without rendering Terrain. */
  readonly invisibleGround?: true;
  readonly airParticles?: AirParticlesParameters;
  readonly scentParticles?: ScentParticlesParameters;
  readonly terrain?: TerrainPreset;
  readonly grass?: GrassPreset;
  readonly vegetation?: VegetationPreset;
  readonly rocks?: RocksPreset;
  readonly animals?: AnimalsPreset;

  /** One depth ramp shared by Terrain, Vegetation, and Rocks materials. */
  readonly echoDepth?: EchoDepthParameters;

  /** Fly swarms printing motion trails; movement becomes the visible signal. */
  readonly motion?: MotionSenseParameters;

  /**
   * One false-color heat view inside a viewer-centred radius, shared by
   * Terrain, Vegetation, Rocks, and Animals; it wins the surface color over
   * the carried echo ramp and feathers back into it at the radius edge.
   */
  readonly thermal?: ThermalPerceptionParameters;

  /**
   * Directional field lines decorating the Terrain material plus the sky
   * dome glowing toward the field direction; the stripes read outside the
   * thermal radius and the dome stays behind every other surface.
   */
  readonly magnetic?: MagneticSenseParameters;

  /**
   * The final synthesis: inside a viewer-centred radius a pulsing root web
   * blends over the carried world, connecting the same deterministic world
   * positions the earlier senses already show.
   */
  readonly connections?: ConnectionsParameters;
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
  const hasGround = level.invisibleGround === true || hasVisibleSurface(level);
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
  const echoDepth = createEchoDepthEffect(setup.level);
  const thermal = createThermalEffects(setup);
  const magnetic = createMagneticEffects(setup);
  const animals = createAnimals(setup, thermal);

  addModule(modules, createTerrain(setup, echoDepth, thermal, magnetic));
  addModule(modules, createAirParticles(setup));
  addModule(modules, createScentParticles(setup));
  addModule(modules, createGrass(setup));
  addModule(modules, createVegetation(setup, echoDepth, thermal));
  addModule(modules, createRocks(setup, echoDepth, thermal));
  addModule(modules, animals?.module);
  addModule(modules, createMotionSense(setup));
  addModule(modules, magnetic?.sky);
  addModule(modules, createConnectionsWeb(setup, animals));

  return modules;
}

/**
 * Skip the sense entirely at intensity zero so its GPU work never runs. A
 * source class joins the web only when both its preset module block and its
 * connections source entry exist.
 */
function createConnectionsWeb(
  setup: LevelSetup,
  animals: AnimalsModuleHandle | undefined,
): WorldModule | undefined {
  const parameters = setup.level.connections;
  if (!parameters || parameters.intensity === 0) return undefined;

  const { level, worldSurface } = setup;
  const staticSources: ConnectionNodeSource[] = [];
  if (level.vegetation && parameters.sources.vegetation) {
    staticSources.push(
      createVegetationConnectionSource(level.vegetation, worldSurface),
    );
  }
  if (level.scentParticles && parameters.sources.scentEmitters) {
    staticSources.push(
      createScentConnectionSource(
        level.scentParticles,
        worldSurface.groundYAt,
        worldSurface.zoneAt,
      ),
    );
  }
  if (level.rocks && parameters.sources.rocks) {
    staticSources.push(createRockConnectionSource(level.rocks, worldSurface));
  }
  const animalSource =
    animals && parameters.sources.animals
      ? {
          sourceClass: "animals" as const,
          getWorldPositions: animals.getVisibleWorldPositions,
        }
      : undefined;

  return createConnectionsModule(parameters, {
    scene: setup.world.scene,
    camera: setup.world.camera,
    streamQueue: setup.world.streamQueue,
    staticSources,
    animalSource,
  });
}

/** Skip the sense entirely at intensity zero so its GPU work never runs. */
function createMagneticEffects(
  setup: LevelSetup,
): MagneticSenseEffects | undefined {
  const parameters = setup.level.magnetic;
  if (!parameters || parameters.intensity === 0) return undefined;

  return createMagneticSense(parameters, {
    scene: setup.world.scene,
    camera: setup.world.camera,
    skyHazeColor: setup.level.backgroundColor ?? 0xffffff,
  });
}

/** Skip the sense entirely at intensity zero so its GPU work never runs. */
function createThermalEffects(
  setup: LevelSetup,
): ThermalPerceptionEffects | undefined {
  const parameters = setup.level.thermal;
  if (!parameters || parameters.intensity === 0) return undefined;

  return createThermalPerception(parameters, {
    surfaceSettings: WORLD_SURFACE_SETTINGS,
    conditionsAt: setup.worldSurface.zoneConditionsAt,
  });
}

/** Skip the sense entirely at intensity zero so its GPU work never runs. */
function createMotionSense(setup: LevelSetup): WorldModule | undefined {
  const parameters = setup.level.motion;
  if (!parameters || parameters.intensity === 0) return undefined;

  return createMotionSenseModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    parameters,
    groundYAt: setup.worldSurface.groundYAt,
    zoneAt: setup.worldSurface.zoneAt,
  });
}

/** Skip the sense entirely at intensity zero so its GPU work never runs. */
function createEchoDepthEffect(
  level: LevelPreset,
): EchoDepthEffect | undefined {
  const parameters = level.echoDepth;
  if (!parameters || parameters.intensity === 0) return undefined;
  return createEchoDepth(parameters);
}

function createTerrain(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
  magnetic: MagneticSenseEffects | undefined,
): WorldModule | undefined {
  const preset = setup.level.terrain;
  if (!preset) return undefined;

  const presentation = createTerrainPresentation(preset, setup.worldSurface);
  // The first-applied effect executes last and wins the final color (see
  // material-shader-patch): thermal covers everything inside its radius,
  // magnetic stripes print over the echo ramp outside it.
  const effects: TerrainMaterialEffect[] = [];
  if (thermal) effects.push(thermal.terrain);
  if (magnetic) effects.push(magnetic.terrain);
  if (echoDepth) effects.push(echoDepth);

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

function createScentParticles(setup: LevelSetup): WorldModule | undefined {
  const parameters = setup.level.scentParticles;
  if (!parameters) return undefined;

  return createScentParticlesModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    parameters,
    streamQueue: setup.world.streamQueue,
    groundYAt: setup.worldSurface.groundYAt,
    zoneAt: setup.worldSurface.zoneAt,
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

function createVegetation(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
): WorldModule | undefined {
  const preset = setup.level.vegetation;
  if (!preset) return undefined;

  return createVegetationModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    preset,
    assets: setup.assets.vegetation,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
    effects: buildSurfaceEffects(thermal?.vegetation, echoDepth),
  });
}

function createRocks(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
): WorldModule | undefined {
  const preset = setup.level.rocks;
  if (!preset) return undefined;

  return createRocksModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    preset,
    assets: setup.assets.rocks,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
    effects: buildSurfaceEffects(thermal?.rocks, echoDepth),
  });
}

/** Order thermal before echo so it wins the color (first-applied wins). */
function buildSurfaceEffects(
  thermal: UnlitMaterialEffect | undefined,
  echoDepth: EchoDepthEffect | undefined,
): readonly UnlitMaterialEffect[] | undefined {
  const effects = [thermal, echoDepth].filter(
    (effect): effect is UnlitMaterialEffect => effect !== undefined,
  );
  return effects.length > 0 ? effects : undefined;
}

function createAnimals(
  setup: LevelSetup,
  thermal: ThermalPerceptionEffects | undefined,
): AnimalsModuleHandle | undefined {
  if (!setup.level.animals) return undefined;

  return createAnimalsModule({
    scene: setup.world.scene,
    camera: setup.world.camera,
    definition: ANIMALS_DEFINITION,
    preset: setup.level.animals,
    assets: setup.assets.animals,
    worldSurface: setup.worldSurface,
    effects: thermal ? [thermal.animals] : undefined,
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
