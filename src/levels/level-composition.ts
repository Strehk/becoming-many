/**
 * Purpose: Construct the concrete module graph for one authored world.
 * Context: Level Runtime needs configured resources without knowing content-module details.
 * Responsibility: Load composition assets, create World Surface, construct modules, and wire providers and effects.
 * Boundary: Startup presentation, lifecycle activation, controls, show following, and frame coordination live elsewhere.
 */

import type { Matrix4 } from "three";
import { FLIGHT_SETTINGS } from "../control/flight-settings";
import { END_CREDITS } from "../dramaturgy/end-credits";
import type { ShowSense } from "../dramaturgy/show-levels";
import { createAirParticlesModule } from "../modules/air-particles/air-particles";
import {
  type AnimalBodiesObserver,
  type AnimalsModuleHandle,
  createAnimalsModule,
} from "../modules/animals/animals";
import { ANIMALS_DEFINITION } from "../modules/animals/animals-definition";
import type { ConnectionNodeSource } from "../modules/connection-nodes";
import {
  createEchoDepth,
  type EchoDepthEffect,
} from "../modules/echo-depth/echo-depth";
import {
  createEndCreditsPanel,
  type EndCreditsPanelHandle,
} from "../modules/end-credits/end-credits-panel";
import { createGrassModule } from "../modules/grass/grass";
import { createGrassClipmapModule } from "../modules/grass-clipmap/grass-clipmap";
import { getGrassZoneCoverage } from "../modules/grass-clipmap/grass-height-field";
import {
  createMagneticSense,
  type MagneticSenseModuleHandle,
} from "../modules/magnetic-sense/magnetic-sense";
import {
  createMotionSenseModule,
  type MotionSenseModuleHandle,
} from "../modules/motion-sense/motion-sense";
import {
  type ConnectionsModuleHandle,
  createConnectionsModule,
} from "../modules/mycelium/mycelium";
import { createRockConnectionSource } from "../modules/rocks/rock-nodes";
import { createRocksModule } from "../modules/rocks/rocks";
import { ROCKS_DEFINITION } from "../modules/rocks/rocks-definition";
import { createScentConnectionSource } from "../modules/scent-particles/scent-emitter-anchors";
import {
  createScentParticlesModule,
  type ScentParticlesModuleHandle,
  type ScentParticlesParameters,
} from "../modules/scent-particles/scent-particles";
import { createGroundOccluder } from "../modules/terrain/ground-occluder";
import { createTerrainModule } from "../modules/terrain/terrain";
import { createTerrainColors } from "../modules/terrain/terrain-colors";
import type {
  TerrainMaterialEffect,
  TerrainPresentation,
} from "../modules/terrain/terrain-geometry";
import {
  createThermalPerception,
  type ThermalPerceptionEffects,
} from "../modules/thermal-perception/thermal-perception";
import { createVegetationModule } from "../modules/vegetation/vegetation";
import { VEGETATION_DEFINITION } from "../modules/vegetation/vegetation-definition";
import { createVegetationConnectionSource } from "../modules/vegetation/vegetation-nodes";
import { createVegetationScentSource } from "../modules/vegetation/vegetation-scent";
import {
  createWorldFade,
  type WorldFadeEffect,
} from "../modules/world-fade/world-fade";
import { createZoneVisualizer } from "../modules/zone-visualizer/zone-visualizer";
import {
  type GltfAssetRequest,
  type GltfAssets,
  loadGltfAssets,
} from "../utils/asset-loader/gltf-assets";
import type { UnlitMaterialEffect } from "../utils/asset-loader/material-effect";
import type { WorldModule } from "../world/module-runtime";
import type { WorldContext } from "../world/world-runtime";
import { WORLD_SURFACE_SETTINGS } from "../world-surface/surface-settings";
import {
  createWorldSurface,
  type WorldSurface,
} from "../world-surface/world-surface";
import { ZONE_SETTINGS } from "../world-surface/zone-settings";
import type { TerrainPreset, WorldComposition } from "./level-preset";
import type { ShowWorldReach } from "./show-runtime";

export interface LoadedLevelAssets {
  readonly vegetation: GltfAssets;
  readonly rocks: GltfAssets;
  readonly animals: GltfAssets;
}

interface LevelSetup {
  readonly world: WorldContext;
  readonly level: WorldComposition;
  readonly worldSurface: WorldSurface;
  readonly assets: LoadedLevelAssets;
  readonly materialHazeColor: number;
  /** Only a show composes world fades; a static run keeps its materials bare. */
  readonly forShow: boolean;
}

interface LevelCompositionOptions {
  readonly world: WorldContext;
  readonly level: WorldComposition;
  readonly assets: LoadedLevelAssets;
  readonly materialHazeColor: number;
  readonly forShow: boolean;
}

export interface ComposedLevel {
  readonly worldSurface: WorldSurface;
  readonly modules: readonly WorldModule[];
  readonly reach: ShowWorldReach;
  readonly hasGround: boolean;
}

export function composeLevel(options: LevelCompositionOptions): ComposedLevel {
  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const setup: LevelSetup = { ...options, worldSurface };
  const configured = createConfiguredModules(setup);

  return {
    worldSurface,
    modules: configured.modules,
    reach: configured.reach,
    hasGround:
      options.level.invisibleGround === true ||
      hasVisibleSurface(options.level),
  };
}

interface ComposedWorld {
  readonly modules: readonly WorldModule[];
  readonly reach: ShowWorldReach;
}

function createConfiguredModules(setup: LevelSetup): ComposedWorld {
  const modules: WorldModule[] = [];
  const gates = new Map<ShowSense, WorldModule[]>();
  const add = (
    gate: ShowSense | undefined,
    module: WorldModule | undefined,
  ): void => {
    if (!module) return;
    modules.push(module);
    if (!gate) return;

    const gatedModules = gates.get(gate);
    if (gatedModules) gatedModules.push(module);
    else gates.set(gate, [module]);
  };

  // World fades exist only for a show: a static run never fades, so its
  // materials skip the extra fragment mix entirely.
  const structureFade = setup.forShow ? createWorldFade() : undefined;
  const animalsFade = setup.forShow ? createWorldFade() : undefined;
  // The credits close a show. A development preset and the benchmark route
  // never reach an ending, so neither builds the panel or its texture.
  const endCredits = setup.forShow
    ? createEndCreditsPanel({
        scene: setup.world.scene,
        viewpoint: setup.world.viewpoint,
        viewerRig: setup.world.viewerRig,
        viewPitchDegrees: FLIGHT_SETTINGS.viewPitchAssistDegrees,
        definition: END_CREDITS,
      })
    : undefined;

  const echoDepth = createEchoDepthEffect(setup.level);
  const thermal = createThermalEffects(setup);
  const magnetic = createMagneticSky(setup);
  // Scent is created before Animals so the actors can report their bodies
  // into its trail ring, and it is added before them so it updates first and
  // the clock their prints are stamped with is already the current one.
  const scent = createScentParticles(setup);
  const animals = createAnimals(
    setup,
    thermal,
    animalsFade,
    scent?.observeActorBodies,
  );
  const connections = createConnectionsWeb(setup, animals);
  const motion = createMotionSense(setup);

  add(
    "echo",
    createTerrain(
      setup,
      echoDepth,
      thermal,
      structureFade,
      connections?.terrain,
    ),
  );
  add(undefined, createAirParticles(setup));
  add("scent", scent?.module);
  add(undefined, createGrass(setup, echoDepth, thermal, structureFade));
  add(undefined, createGrassClipmap(setup, echoDepth, thermal, structureFade));
  add("echo", createVegetation(setup, echoDepth, thermal, structureFade));
  add("echo", createRocks(setup, echoDepth, thermal, structureFade));
  add("thermal", animals?.module);
  add("motion", motion?.module);
  add("magnetic", magnetic?.module);
  add("connections", connections?.module);
  add(undefined, endCredits?.module);

  return {
    modules,
    reach: composeShowReach(gates, {
      scent,
      motion,
      thermal,
      magnetic,
      connections,
      structureFade,
      animalsFade,
      endCredits,
    }),
  };
}

/**
 * Everything with a runtime driver, as composed — present when created. Echo
 * is absent by design: its ramp needs no fade because the surfaces it
 * decorates already dissolve through the World Fade, which rides the echo
 * strength itself.
 */
interface ComposedSenseHandles {
  readonly scent: ScentParticlesModuleHandle | undefined;
  readonly motion: MotionSenseModuleHandle | undefined;
  readonly thermal: ThermalPerceptionEffects | undefined;
  readonly magnetic: MagneticSenseModuleHandle | undefined;
  readonly connections: ConnectionsModuleHandle | undefined;
  readonly structureFade: WorldFadeEffect | undefined;
  readonly animalsFade: WorldFadeEffect | undefined;
  readonly endCredits: EndCreditsPanelHandle | undefined;
}

function composeShowReach(
  gates: ReadonlyMap<ShowSense, readonly WorldModule[]>,
  handles: ComposedSenseHandles,
): ShowWorldReach {
  return {
    gates,
    senses: {
      scent: handles.scent?.setIntensity,
      motion: handles.motion?.setIntensity,
      thermal: handles.thermal?.setIntensity,
      magnetic: handles.magnetic?.setIntensity,
      connections: handles.connections?.setIntensity,
    },
    worldFades: {
      structure: handles.structureFade,
      animals: handles.animalsFade,
    },
    setSkyBackground: handles.magnetic?.setSkyBackground,
    setEndCreditsPresence: handles.endCredits?.setPresence,
  };
}

/**
 * Skip the sense entirely at intensity zero so its GPU work never runs. A
 * source class joins the web only when both its preset module block and its
 * connections source entry exist.
 */
function createConnectionsWeb(
  setup: LevelSetup,
  animals: AnimalsModuleHandle | undefined,
): ConnectionsModuleHandle | undefined {
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
      createScentConnectionSource(worldSurface.groundYAt, worldSurface.zoneAt),
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

  // What already covers this level's ground, straight from the module that
  // grows it: bare surface everywhere the level authors no grass at all.
  const groundCoverAt = setup.level.grassClipmap
    ? (worldX: number, worldZ: number) =>
        getGrassZoneCoverage(worldSurface, worldX, worldZ)
    : () => 0;

  return createConnectionsModule(parameters, {
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    streamQueue: setup.world.streamQueue,
    worldSurface,
    staticSources,
    animalSource,
    groundCoverAt,
  });
}

/** Skip the sense entirely at intensity zero so its GPU work never runs. */
function createMagneticSky(
  setup: LevelSetup,
): MagneticSenseModuleHandle | undefined {
  const parameters = setup.level.magnetic;
  if (!parameters || parameters.intensity === 0) return undefined;

  return createMagneticSense(parameters, {
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    skyHazeColor: setup.materialHazeColor,
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
function createMotionSense(
  setup: LevelSetup,
): MotionSenseModuleHandle | undefined {
  const parameters = setup.level.motion;
  if (!parameters || parameters.intensity === 0) return undefined;

  return createMotionSenseModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    parameters,
    groundYAt: setup.worldSurface.groundYAt,
    zoneAt: setup.worldSurface.zoneAt,
  });
}

/** Skip the sense entirely at intensity zero so its GPU work never runs. */
function createEchoDepthEffect(
  level: WorldComposition,
): EchoDepthEffect | undefined {
  const parameters = level.echoDepth;
  if (!parameters || parameters.intensity === 0) return undefined;
  return createEchoDepth(parameters);
}

function createTerrain(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
  worldFade: WorldFadeEffect | undefined,
  soilOpening: TerrainMaterialEffect | undefined,
): WorldModule | undefined {
  const preset = setup.level.terrain;
  // A level that keeps its surface invisible still needs it to hide what
  // stands behind a hill. The occluder writes depth and no color, carries no
  // effects because it is never seen, and is coarse because it only has to
  // hold ridges and valley edges.
  if (!preset) {
    return setup.level.invisibleGround
      ? createTerrainModule({
          scene: setup.world.scene,
          viewpoint: setup.world.viewpoint,
          worldSurface: setup.worldSurface,
          streamQueue: setup.world.streamQueue,
          parameters: { opacity: 1 },
          presentation: createGroundOccluder(),
        })
      : undefined;
  }

  const presentation = createTerrainPresentation(preset, setup.worldSurface);
  // The first-applied effect executes last and wins the final color (see
  // material-shader-patch): the world fade dissolves the finished surface
  // into the background, thermal covers everything inside its radius, and
  // the echo ramp carries the ground outside it. The magnetic sense never
  // touches the terrain; it lives on the sky dome.
  const effects: TerrainMaterialEffect[] = [];
  if (worldFade) effects.push(worldFade);
  if (thermal) effects.push(thermal.terrain);
  if (echoDepth) effects.push(echoDepth);
  // Pushed last so it executes first: it only scales the alpha the carried
  // ramps then paint into, and it wins nothing by running after them.
  if (soilOpening) effects.push(soilOpening);

  return createTerrainModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
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
    viewpoint: setup.world.viewpoint,
    parameters,
    streamQueue: setup.world.streamQueue,
    surfaceYAt,
  });
}

/**
 * Scent has no positions of its own: it radiates from the plants the level
 * grows, rendered or not, and from the animals it carries.
 */
function createScentParticles(
  setup: LevelSetup,
): ScentParticlesModuleHandle | undefined {
  const parameters = setup.level.scentParticles;
  if (!parameters) return undefined;

  const { level, worldSurface } = setup;
  const plantPreset = level.vegetation ?? level.invisibleVegetation;
  const hasAnimals = Boolean(level.animals && parameters.animals);
  if (hasAnimals) validateAnimalScentSignatures(parameters);

  return createScentParticlesModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    parameters,
    streamQueue: setup.world.streamQueue,
    plantSource: plantPreset
      ? createVegetationScentSource(plantPreset, worldSurface)
      : undefined,
    maxActorCount: hasAnimals ? ANIMALS_DEFINITION.maxVisible : 0,
  });
}

/** A species without a signature would walk through the world unscented. */
function validateAnimalScentSignatures(
  parameters: ScentParticlesParameters,
): void {
  const signatures = parameters.animals?.signatures ?? {};

  for (const { id } of ANIMALS_DEFINITION.species) {
    if (signatures[id]) continue;
    throw new Error(`Animal species has no scent signature: ${id}`);
  }
}

/** Skip the field entirely when a level authors no clipmap grass. */
function createGrassClipmap(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
  worldFade: WorldFadeEffect | undefined,
): WorldModule | undefined {
  const preset = setup.level.grassClipmap;
  if (!preset) return undefined;

  return createGrassClipmapModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    frustumCamera: setup.world.camera,
    preset,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
    surfaceSettings: WORLD_SURFACE_SETTINGS,
    // The field fades into the level haze wherever no sense covers it.
    fogColor: setup.materialHazeColor,
    // Grass takes its own heat response, not vegetation's. It grows out of
    // the ground and holds the ground's temperature; carrying the bushes'
    // values made a whole meadow read as one flat hot surface.
    effects: buildSurfaceEffects(worldFade, thermal?.grass, echoDepth),
  });
}

function createGrass(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
  worldFade: WorldFadeEffect | undefined,
): WorldModule | undefined {
  const preset = setup.level.grass;
  if (!preset) return undefined;

  return createGrassModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    preset,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
    // Grass takes the vegetation heat response: it is the same living plant
    // matter, growing between the bushes that carry those values, and a
    // meadow that ran cooler than the shrubs standing in it would read as a
    // different substance.
    effects: buildSurfaceEffects(worldFade, thermal?.vegetation, echoDepth),
  });
}

function createVegetation(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
  worldFade: WorldFadeEffect | undefined,
): WorldModule | undefined {
  const preset = setup.level.vegetation;
  if (!preset) return undefined;

  return createVegetationModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    preset,
    assets: setup.assets.vegetation,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
    // Asked per stature: heat reads a bush as its own substance, nearer the
    // meadow it stands in than the wood above it, because a plant sheds its
    // warmth over its own metres and a bush has too few to shed any. Every
    // other sense answers the same for both.
    effectsFor: (stature) =>
      buildSurfaceEffects(
        worldFade,
        stature === "undergrowth" ? thermal?.undergrowth : thermal?.vegetation,
        echoDepth,
      ),
  });
}

function createRocks(
  setup: LevelSetup,
  echoDepth: EchoDepthEffect | undefined,
  thermal: ThermalPerceptionEffects | undefined,
  worldFade: WorldFadeEffect | undefined,
): WorldModule | undefined {
  const preset = setup.level.rocks;
  if (!preset) return undefined;

  return createRocksModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    preset,
    assets: setup.assets.rocks,
    streamQueue: setup.world.streamQueue,
    worldSurface: setup.worldSurface,
    effects: buildSurfaceEffects(worldFade, thermal?.rocks, echoDepth),
  });
}

/** Order thermal before echo so it wins the color (first-applied wins). */
function buildSurfaceEffects(
  worldFade: WorldFadeEffect | undefined,
  thermal: UnlitMaterialEffect | undefined,
  echoDepth: EchoDepthEffect | undefined,
): readonly UnlitMaterialEffect[] | undefined {
  // First applied wins the final color: the world fade covers every sense.
  const effects = [worldFade, thermal, echoDepth].filter(
    (effect): effect is UnlitMaterialEffect => effect !== undefined,
  );
  return effects.length > 0 ? effects : undefined;
}

function createAnimals(
  setup: LevelSetup,
  thermal: ThermalPerceptionEffects | undefined,
  worldFade: WorldFadeEffect | undefined,
  scentActors: AnimalBodiesObserver | undefined,
): AnimalsModuleHandle | undefined {
  if (!setup.level.animals) return undefined;

  // One effect per animated mesh: the body matrix lets the heat view fall
  // off from each actor's own core instead of coloring it uniformly. The
  // world fade goes first so it wins the final color over the heat view.
  const effectsFor =
    thermal || worldFade
      ? (bodyMatrix: Matrix4): readonly UnlitMaterialEffect[] =>
          [worldFade, thermal?.animals(bodyMatrix)].filter(
            (effect): effect is UnlitMaterialEffect => effect !== undefined,
          )
      : undefined;

  return createAnimalsModule({
    scene: setup.world.scene,
    viewpoint: setup.world.viewpoint,
    definition: ANIMALS_DEFINITION,
    preset: setup.level.animals,
    assets: setup.assets.animals,
    worldSurface: setup.worldSurface,
    effectsFor,
    // Warm bodies radiate onto the ground, plants, and rocks around them, and
    // they leave scent where they walk, so both senses need to know where
    // the actors stand each frame.
    onBodiesUpdated: composeBodyObservers(thermal?.setHeatSources, scentActors),
  });
}

/** Report one reused body array to every sense that asked for it. */
function composeBodyObservers(
  ...observers: readonly (AnimalBodiesObserver | undefined)[]
): AnimalBodiesObserver | undefined {
  const configured = observers.filter(
    (observer): observer is AnimalBodiesObserver => observer !== undefined,
  );
  if (configured.length === 0) return undefined;

  return (bodies) => {
    for (const observe of configured) observe(bodies);
  };
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

function hasVisibleSurface(level: WorldComposition): boolean {
  return Boolean(
    level.terrain ||
      level.grass ||
      level.vegetation ||
      level.rocks ||
      level.animals,
  );
}

export async function loadLevelAssets(
  level: WorldComposition,
): Promise<LoadedLevelAssets> {
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
