/**
 * Purpose: Construct the concrete module graph for one authored world.
 * Context: Level Runtime needs configured resources without knowing content-module details.
 * Responsibility: Load composition assets, create World Surface, construct modules, and wire providers and effects.
 * Boundary: Startup presentation, lifecycle activation, controls, show following, and frame coordination live elsewhere.
 */

import { type Matrix4, Vector3 } from "three";
import type { BenchmarkRun } from "../benchmark/benchmark-run";
import type { FlightInputSource } from "../control/control-contract";
import { createDesktopController } from "../control/desktop-controller";
import { createFlightControl } from "../control/flight-control";
import type { FlightHeightLimits } from "../control/flight-pose";
import {
  keepFlightWithinHeightLimits,
  resetFlightPose,
} from "../control/flight-pose";
import { FLIGHT_SETTINGS } from "../control/flight-settings";
import { createM5Controller } from "../control/m5-controller";
import { END_CREDITS } from "../dramaturgy/end-credits";
import { ORGAN_SCORE } from "../dramaturgy/organ-score";
import { PIECE_PASSAGES } from "../dramaturgy/piece-schedule";
import type { ShowSense } from "../dramaturgy/show-levels";
import { createM5Runtime } from "../m5/runtime/m5.runtime";
import { createAirParticlesModule } from "../modules/air-particles/air-particles";
import {
  type AnimalPassagesModuleHandle,
  createAnimalPassagesModule,
  loadPassageResources,
  type PassageResources,
} from "../modules/animal-passages/animal-passages";
import { MOSQUITO_PASSAGE } from "../modules/animal-passages/passage-definitions";
import {
  type AnimalBodiesObserver,
  createAnimalsModule,
} from "../modules/animals/animals";
import { ANIMALS_DEFINITION } from "../modules/animals/animals-definition";
import type { ConnectionNodeSource } from "../modules/connection-nodes";
import {
  createEchoDepth,
  type EchoDepthEffect,
} from "../modules/echo-depth/echo-depth";
import { createEndCreditsPanel } from "../modules/end-credits/end-credits-panel";
import { createGrassClipmapModule } from "../modules/grass-clipmap/grass-clipmap";
import { getGrassZoneCoverage } from "../modules/grass-clipmap/grass-height-field";
import { createMagneticSense } from "../modules/magnetic-sense/magnetic-sense";
import { createMotionSenseModule } from "../modules/motion-sense/motion-sense";
import { createPassageSwarmModule } from "../modules/motion-sense/passage-swarm";
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
import { createStartModule } from "../modules/start/start.module";
import type { StartModuleHandle } from "../modules/start/start-contract";
import { createStartParticleEffect } from "../modules/start/start-particles.effect";
import { START_SETTINGS } from "../modules/start/start-settings";
import { createGroundOccluder } from "../modules/terrain/ground-occluder";
import { createTerrainModule } from "../modules/terrain/terrain";
import { createTerrainColors } from "../modules/terrain/terrain-colors";
import type { TerrainPresentation } from "../modules/terrain/terrain-geometry";
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
import { createAudioTimebase } from "../sound/audio-timebase";
import { createDroneOrgan } from "../sound/drone-organ/drone-organ";
import { createNarrationPlayer } from "../sound/narration-player";
import type { SpatialAudio } from "../sound/spatial-audio";
import { createSpatialAudio } from "../sound/spatial-audio.runtime";
import type { TrainingAudio } from "../sound/training-audio";
import { createTrainingAudio } from "../sound/training-audio.runtime";
import {
  disposeGltfAssets,
  type GltfAssets,
  loadGltfAssets,
} from "../utils/asset-loader/gltf-assets";
import type {
  TerrainMaterialEffect,
  UnlitMaterialEffect,
} from "../utils/asset-loader/material-effect";
import type { WorldModule } from "../world/module-runtime";
import { VIEW_PITCH_ASSIST_DEGREES } from "../world/viewer-rig";
import type {
  World,
  WorldContext,
  WorldViewport,
} from "../world/world-contract";
import { createWorld } from "../world/world-runtime";
import { WORLD_SURFACE_SETTINGS } from "../world-surface/surface-settings";
import {
  createWorldSurface,
  type WorldSurface,
} from "../world-surface/world-surface";
import { ZONE_SETTINGS } from "../world-surface/zone-settings";
import type {
  LevelPreset,
  TerrainPreset,
  WorldComposition,
} from "./level-preset";
import { createShowRuntime, validateShowRequest } from "./show.runtime";
import type {
  ShowRequest,
  ShowRuntime,
  ShowRuntimeOptions,
  ShowWorldReach,
} from "./show-contract";

export interface LoadedLevelAssets {
  readonly vegetation: GltfAssets;
  readonly rocks: GltfAssets;
  readonly animals: GltfAssets;
  /** Passage models and routes; only a show crosses animals, so only a show loads them. */
  readonly passages: PassageResources | undefined;
}

interface LevelCompositionOptions {
  readonly world: Pick<
    WorldContext,
    "scene" | "camera" | "viewerRig" | "viewpoint" | "streamQueue"
  >;
  readonly level: LevelPreset;
  readonly assets: LoadedLevelAssets;
  readonly forShow: boolean;
  readonly tutorial?: LevelPreset;
}

export interface ComposedLevel {
  readonly start: StartModuleHandle | undefined;
  readonly setTrainingRoomPresence?: (presence: number) => void;
  readonly trainingModules: readonly WorldModule[];
  readonly worldSurface: WorldSurface;
  readonly modules: readonly WorldModule[];
  readonly reach: ShowWorldReach;
  readonly hasGround: boolean;
}

export async function composeLevel({
  world,
  level,
  assets,
  forShow,
  tutorial,
}: LevelCompositionOptions): Promise<ComposedLevel> {
  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const modules: WorldModule[] = [];
  const createdModules = new Set<WorldModule>();
  const gates = new Map<ShowSense, WorldModule[]>();
  const add = (
    gate: ShowSense | undefined,
    module: WorldModule | undefined,
  ): void => {
    if (!module) return;
    modules.push(module);
    createdModules.add(module);
    if (!gate) return;

    const gatedModules = gates.get(gate);
    if (gatedModules) gatedModules.push(module);
    else gates.set(gate, [module]);
  };

  try {
    // World fades exist only for a show: a static run never fades, so its
    // materials skip the extra fragment mix entirely.
    const structureFade = forShow ? createWorldFade() : undefined;
    const animalsFade = forShow ? createWorldFade() : undefined;
    // The credits close a show. A development preset and the benchmark route
    // never reach an ending, so neither builds the panel or its texture.
    const endCredits = forShow
      ? createEndCreditsPanel({
          scene: world.scene,
          viewpoint: world.viewpoint,
          viewerRig: world.viewerRig,
          viewPitchDegrees: VIEW_PITCH_ASSIST_DEGREES,
          definition: END_CREDITS,
        })
      : undefined;

    if (endCredits) createdModules.add(endCredits.module);

    // Zero intensity omits the sense entirely, including its GPU resources.
    const echoDepth =
      level.echoDepth && level.echoDepth.intensity !== 0
        ? createEchoDepth(level.echoDepth)
        : undefined;
    const thermal =
      level.thermal && level.thermal.intensity !== 0
        ? createThermalPerception(level.thermal, {
            surfaceSettings: WORLD_SURFACE_SETTINGS,
            conditionsAt: worldSurface.zoneConditionsAt,
          })
        : undefined;
    const magnetic =
      level.magnetic && level.magnetic.intensity !== 0
        ? createMagneticSense(level.magnetic, {
            scene: world.scene,
            viewpoint: world.viewpoint,
            skyHazeColor: level.backgroundColor,
          })
        : undefined;
    if (magnetic) createdModules.add(magnetic.module);
    // Scent is created before Animals so the actors can report their bodies
    // into its trail ring, and it is added before them so it updates first and
    // the clock their prints are stamped with is already the current one.
    const scent = createScentParticles();
    if (scent) createdModules.add(scent.module);
    const animals = createAnimals(
      thermal,
      animalsFade,
      scent?.observeActorBodies,
    );
    if (animals) createdModules.add(animals);
    const connections = createConnectionsWeb();
    if (connections) createdModules.add(connections.module);
    const motion =
      level.motion && level.motion.intensity !== 0
        ? createMotionSenseModule({
            scene: world.scene,
            viewpoint: world.viewpoint,
            parameters: level.motion,
            groundYAt: worldSurface.groundYAt,
            zoneAt: worldSurface.zoneAt,
          })
        : undefined;
    if (motion) createdModules.add(motion.module);
    const passages = createAnimalPassages();
    if (passages) createdModules.add(passages.module);
    const passageSwarm = createPassageSwarm(passages);
    if (passageSwarm) createdModules.add(passageSwarm);

    add(
      "echo",
      await createTerrain(
        echoDepth,
        thermal,
        structureFade,
        connections?.terrain,
      ),
    );
    // A Start preset's Air belongs to its removable training composition.
    // Composing it here as well would give standalone Start a second particle
    // room that the integrated tutorial does not have.
    if (!level.start) add(undefined, createAirParticles());
    add("scent", scent?.module);
    add(undefined, createGrassClipmap(echoDepth, thermal, structureFade));
    add("echo", createVegetation(echoDepth, thermal, structureFade));
    add("echo", createRocks(echoDepth, thermal, structureFade));
    add("thermal", animals);
    add("motion", motion?.module);
    add("magnetic", magnetic?.module);
    add("connections", connections?.module);
    // Ungated: a passage crosses *between* senses, so no single sense strength
    // may put it away. The schedule alone decides when its animal is in the air.
    // The swarm passage is the sharpest case — it announces the very sense whose
    // gate would otherwise be holding it shut while it crosses.
    add(undefined, passages?.module);
    add(undefined, passageSwarm);
    add(undefined, endCredits?.module);
    const training = composeTraining(
      tutorial ?? level,
      world,
      worldSurface.groundYAt,
    );
    const start = training?.start;
    const trainingModules = training?.modules ?? [];
    for (const module of trainingModules) add(undefined, module);

    return {
      start,
      trainingModules,
      setTrainingRoomPresence: training?.setRoomPresence,
      worldSurface,
      modules,
      hasGround: level.invisibleGround === true || hasVisibleSurface(level),
      reach: {
        gates,
        // Echo surfaces already dissolve through their world fade.
        senses: {
          scent: scent?.setIntensity,
          motion: motion?.setIntensity,
          thermal: thermal?.setIntensity,
          magnetic: magnetic?.setIntensity,
          connections: connections?.setIntensity,
        },
        worldFades: { structure: structureFade, animals: animalsFade },
        setSkyBackground: magnetic?.setSkyBackground,
        setEndCreditsPresence: endCredits?.setPresence,
        followPassages: passages?.followShowTime,
        readMotionActorCenters: motion?.readActorCenters,
      },
    };
  } catch (error) {
    const errors: unknown[] = [error];
    for (const module of [...createdModules].reverse()) {
      try {
        module.unload();
      } catch (cleanupError) {
        errors.push(cleanupError);
      }
    }
    if (errors.length > 1)
      throw new AggregateError(
        errors,
        "Composition construction and cleanup failed",
      );
    throw error;
  }

  /**
   * Skip the sense entirely at intensity zero so its GPU work never runs. A
   * source class joins the web only when both its preset module block and its
   * connections source entry exist.
   */
  function createConnectionsWeb(): ConnectionsModuleHandle | undefined {
    const parameters = level.connections;
    if (!parameters || parameters.intensity === 0) return undefined;

    const staticSources: ConnectionNodeSource[] = [];
    if (level.vegetation && parameters.sources.vegetation) {
      staticSources.push(
        createVegetationConnectionSource(level.vegetation, worldSurface),
      );
    }
    if (level.scentParticles && parameters.sources.scentEmitters) {
      staticSources.push(
        createScentConnectionSource(
          worldSurface.groundYAt,
          worldSurface.zoneAt,
        ),
      );
    }
    if (level.rocks && parameters.sources.rocks) {
      staticSources.push(createRockConnectionSource(level.rocks, worldSurface));
    }
    // What already covers this level's ground, straight from the module that
    // grows it: bare surface everywhere the level authors no grass at all.
    const groundCoverAt = level.grassClipmap
      ? (worldX: number, worldZ: number) =>
          getGrassZoneCoverage(worldSurface, worldX, worldZ)
      : () => 0;

    return createConnectionsModule(parameters, {
      scene: world.scene,
      viewpoint: world.viewpoint,
      streamQueue: world.streamQueue,
      worldSurface,
      staticSources,
      groundCoverAt,
    });
  }

  /**
   * The authored animal crossings. Only a show has them: they are placed by the
   * schedule, and a static run has no show time to place them against.
   */
  function createAnimalPassages(): AnimalPassagesModuleHandle | undefined {
    const resources = assets.passages;
    if (!forShow || !resources) return undefined;

    const heading = new Vector3();
    return createAnimalPassagesModule({
      scene: world.scene,
      viewpoint: world.viewpoint,
      worldSurface,
      schedule: PIECE_PASSAGES,
      resources,
      // The rig's yaw is where the visitor is travelling, which is what a route
      // entering behind them is turned against. The camera under it is head
      // pose and would swing the whole route with a glance.
      readViewHeadingRadians: () => {
        world.viewerRig.updateWorldMatrix(true, false);
        heading.set(0, 0, -1).applyQuaternion(world.viewerRig.quaternion);
        // The yaw that turns −Z onto this heading. Both components are negated
        // because forward is −Z: reading the raw components instead answers a
        // half turn away, which sends a route authored to cross in front of the
        // visitor out behind them.
        return Math.atan2(-heading.x, -heading.z);
      },
    });
  }

  /**
   * The trail ring of the swarm passage. It is composed here rather than inside
   * Motion Sense because it must outlive that module's gate: the mosquitoes
   * cross six seconds before the motion cue, where the sense they announce still
   * stands at zero. Motion Sense owns how a trail is printed; the passage owns
   * where and when.
   */
  function createPassageSwarm(
    passages: AnimalPassagesModuleHandle | undefined,
  ): WorldModule | undefined {
    const parameters = level.motion;
    if (!passages || !parameters) return undefined;

    return createPassageSwarmModule({
      scene: world.scene,
      parameters,
      pointCount: MOSQUITO_PASSAGE.pointCount,
      cloudRadiusMeters: MOSQUITO_PASSAGE.cloudRadiusMeters,
      cloudHeightMeters: MOSQUITO_PASSAGE.cloudHeightMeters,
      readCrossing: passages.readSwarmCrossing,
    });
  }

  async function createTerrain(
    echoDepth: EchoDepthEffect | undefined,
    thermal: ThermalPerceptionEffects | undefined,
    worldFade: WorldFadeEffect | undefined,
    soilOpening: TerrainMaterialEffect | undefined,
  ): Promise<WorldModule | undefined> {
    const preset = level.terrain;
    // A level that keeps its surface invisible still needs it to hide what
    // stands behind a hill. The occluder writes depth and no color, carries no
    // effects because it is never seen, and is coarse because it only has to
    // hold ridges and valley edges.
    if (!preset) {
      return level.invisibleGround
        ? createTerrainModule({
            scene: world.scene,
            viewpoint: world.viewpoint,
            worldSurface,
            streamQueue: world.streamQueue,
            parameters: { opacity: 1 },
            presentation: createGroundOccluder(),
          })
        : undefined;
    }

    const presentation = await createTerrainPresentation(preset);
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
      scene: world.scene,
      viewpoint: world.viewpoint,
      worldSurface,
      streamQueue: world.streamQueue,
      parameters: { opacity: preset.opacity },
      presentation,
      effects,
    });
  }

  function createAirParticles(): WorldModule | undefined {
    const parameters = level.airParticles;
    if (!parameters || level.start) return undefined;

    const surfaceYAt = hasVisibleSurface(level)
      ? worldSurface.surfaceYAt
      : undefined;

    return createAirParticlesModule({
      scene: world.scene,
      viewpoint: world.viewpoint,
      parameters,
      streamQueue: world.streamQueue,
      surfaceYAt,
    });
  }

  /**
   * Scent has no positions of its own: it radiates from the plants the level
   * grows, rendered or not, and from the animals it carries.
   */
  function createScentParticles(): ScentParticlesModuleHandle | undefined {
    const parameters = level.scentParticles;
    if (!parameters) return undefined;

    const plantPreset = level.vegetation ?? level.invisibleVegetation;
    const hasAnimals = Boolean(level.animals && parameters.animals);
    if (hasAnimals) validateAnimalScentSignatures(parameters);

    return createScentParticlesModule({
      scene: world.scene,
      viewpoint: world.viewpoint,
      parameters,
      streamQueue: world.streamQueue,
      plantSource: plantPreset
        ? createVegetationScentSource(plantPreset, worldSurface)
        : undefined,
      maxActorCount: hasAnimals ? ANIMALS_DEFINITION.maxVisible : 0,
    });
  }

  /** Skip the field entirely when a level authors no clipmap grass. */
  function createGrassClipmap(
    echoDepth: EchoDepthEffect | undefined,
    thermal: ThermalPerceptionEffects | undefined,
    worldFade: WorldFadeEffect | undefined,
  ): WorldModule | undefined {
    const preset = level.grassClipmap;
    if (!preset) return undefined;

    return createGrassClipmapModule({
      scene: world.scene,
      viewpoint: world.viewpoint,
      frustumCamera: world.camera,
      preset,
      streamQueue: world.streamQueue,
      worldSurface,
      surfaceSettings: WORLD_SURFACE_SETTINGS,
      // The field fades into the level haze wherever no sense covers it.
      fogColor: level.backgroundColor,
      // Grass takes its own heat response, not vegetation's. It grows out of
      // the ground and holds the ground's temperature; carrying the bushes'
      // values made a whole meadow read as one flat hot surface.
      effects: buildSurfaceEffects(worldFade, thermal?.grass, echoDepth),
    });
  }

  function createVegetation(
    echoDepth: EchoDepthEffect | undefined,
    thermal: ThermalPerceptionEffects | undefined,
    worldFade: WorldFadeEffect | undefined,
  ): WorldModule | undefined {
    const preset = level.vegetation;
    if (!preset) return undefined;

    return createVegetationModule({
      scene: world.scene,
      viewpoint: world.viewpoint,
      preset,
      assets: assets.vegetation,
      streamQueue: world.streamQueue,
      worldSurface,
      // Asked per stature: heat reads a bush as its own substance, nearer the
      // meadow it stands in than the wood above it, because a plant sheds its
      // warmth over its own metres and a bush has too few to shed any. Every
      // other sense answers the same for both.
      effectsFor: (stature) =>
        buildSurfaceEffects(
          worldFade,
          stature === "undergrowth"
            ? thermal?.undergrowth
            : thermal?.vegetation,
          echoDepth,
        ),
    });
  }

  function createRocks(
    echoDepth: EchoDepthEffect | undefined,
    thermal: ThermalPerceptionEffects | undefined,
    worldFade: WorldFadeEffect | undefined,
  ): WorldModule | undefined {
    const preset = level.rocks;
    if (!preset) return undefined;

    return createRocksModule({
      scene: world.scene,
      viewpoint: world.viewpoint,
      preset,
      assets: assets.rocks,
      streamQueue: world.streamQueue,
      worldSurface,
      effects: buildSurfaceEffects(worldFade, thermal?.rocks, echoDepth),
    });
  }

  function createAnimals(
    thermal: ThermalPerceptionEffects | undefined,
    worldFade: WorldFadeEffect | undefined,
    scentActors: AnimalBodiesObserver | undefined,
  ): WorldModule | undefined {
    if (!level.animals) return undefined;

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
      scene: world.scene,
      viewpoint: world.viewpoint,
      definition: ANIMALS_DEFINITION,
      preset: level.animals,
      assets: assets.animals,
      worldSurface,
      effectsFor,
      // Warm bodies radiate onto the ground, plants, and rocks around them, and
      // they leave scent where they walk, so both senses need to know where
      // the actors stand each frame.
      onBodiesUpdated: composeBodyObservers(
        thermal?.setHeatSources,
        scentActors,
      ),
    });
  }

  async function createTerrainPresentation(
    preset: TerrainPreset,
  ): Promise<TerrainPresentation | undefined> {
    if (preset.presentation === "zones") {
      const { createZoneVisualizer: createZonePresentation } = await import(
        "../modules/zone-visualizer/zone-visualizer"
      );
      return createZonePresentation(worldSurface, ZONE_SETTINGS);
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

function hasVisibleSurface(level: WorldComposition): boolean {
  return Boolean(
    level.terrain ||
      level.grassClipmap ||
      level.vegetation ||
      level.rocks ||
      level.animals,
  );
}

export async function loadLevelAssets(
  level: WorldComposition,
  forShow: boolean,
  signal?: AbortSignal,
): Promise<LoadedLevelAssets> {
  const [vegetation, rocks, animals, passages] = await Promise.allSettled([
    loadGltfAssets(
      level.vegetation ? VEGETATION_DEFINITION.assets : [],
      signal,
    ),
    loadGltfAssets(level.rocks ? ROCKS_DEFINITION.assets : [], signal),
    loadGltfAssets(level.animals ? ANIMALS_DEFINITION.species : [], signal),
    forShow ? loadPassageResources(PIECE_PASSAGES, signal) : undefined,
  ]);

  if (
    vegetation.status === "rejected" ||
    rocks.status === "rejected" ||
    animals.status === "rejected" ||
    passages.status === "rejected" ||
    signal?.aborted
  ) {
    const errors: unknown[] = [
      ...[vegetation, rocks, animals, passages].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      ),
      ...(signal?.aborted ? [signal.reason] : []),
    ];
    const sources = [vegetation, rocks, animals].flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (passages.status === "fulfilled" && passages.value)
      sources.push(passages.value.models);
    for (const batch of sources) {
      try {
        disposeGltfAssets(batch);
      } catch (error) {
        errors.push(error);
      }
    }
    if (signal?.aborted && errors.every((error) => error === signal.reason))
      throw signal.reason;
    throw new AggregateError(errors, "Level assets failed to load");
  }
  return {
    vegetation: vegetation.value,
    rocks: rocks.value,
    animals: animals.value,
    passages: passages.value,
  };
}

/** Construct only the removable training content, including its own background. */
export function composeTraining(
  preset: LevelPreset,
  world: LevelCompositionOptions["world"],
  groundYAt: WorldSurface["groundYAt"],
):
  | {
      start: StartModuleHandle;
      modules: WorldModule[];
      setRoomPresence?: (presence: number) => void;
    }
  | undefined {
  if (!preset.start) return undefined;
  const arrowLengthMeters =
    preset.start.particles?.arrowLengthMeters ??
    START_SETTINGS.arrowLengthMeters;
  const start = createStartModule({
    arrowLengthMeters,
    motionLimits: FLIGHT_SETTINGS,
    viewpoint: world.viewpoint,
    parameters: preset.start,
    maximumGoalYAt: (x, z) =>
      groundYAt(x, z) + preset.maximumGroundClearanceMeters,
    particles: preset.start.particles
      ? createStartParticleEffect({
          arrowLengthMeters,
          scene: world.scene,
          parameters: preset.start.particles,
        })
      : undefined,
  });
  const modules: WorldModule[] = [];
  const room = preset.airParticles
    ? createAirParticlesModule({
        scene: world.scene,
        viewpoint: world.viewpoint,
        streamQueue: world.streamQueue,
        parameters: preset.airParticles,
      })
    : undefined;
  room?.setPresence(0);
  if (room) modules.push(room);
  modules.push(start.module);
  return { start, modules, setRoomPresence: room?.setPresence };
}

/** Construct the renderer with the experience's fixed parent pitch assistance. */
export function composeWorld(
  surface: WorldViewport,
  benchmark?: BenchmarkRun,
): World {
  return createWorld(surface, {
    frameControl: benchmark,
    viewPitchAssistDegrees: VIEW_PITCH_ASSIST_DEGREES,
  });
}

/** Bind input owners to the rig and release unpublished resources after failure. */
export function composeControls(
  world: World,
  benchmark: BenchmarkRun | undefined,
  surface: Pick<WorldSurface, "groundYAt">,
) {
  const m5 = benchmark ? undefined : createM5Runtime();
  let desktop: ReturnType<typeof createDesktopController> | undefined;
  try {
    desktop = benchmark
      ? undefined
      : createDesktopController(world.camera, world.renderer.domElement);
    const sources: FlightInputSource[] = [];
    if (m5) sources.push(createM5Controller(m5));
    if (desktop) sources.push(desktop);
    return {
      ...composeRigCommands(world, surface.groundYAt),
      m5,
      desktop,
      flight: createFlightControl(world.viewerRig, sources),
    };
  } catch (error) {
    void desktop?.unload();
    m5?.unload();
    throw error;
  }
}

/** Bind pure locomotion operations once; Run supplies the active numerical limits. */
function composeRigCommands(
  world: World,
  groundYAt: (x: number, z: number) => number,
) {
  return {
    resetRig: () =>
      resetFlightPose(world.viewerRig.position, world.viewerRig.quaternion),
    constrainHeight: (limits: FlightHeightLimits) =>
      keepFlightWithinHeightLimits(world.viewerRig.position, groundYAt, limits),
    minimumGroundClearanceMeters: FLIGHT_SETTINGS.minimumGroundClearanceMeters,
  };
}

/** Construct the current recipe's removable audio only after Run prepares its world. */
export async function composeTrainingAudio(
  preset: LevelPreset | undefined,
  audio: SpatialAudio | undefined,
  signal: AbortSignal,
) {
  return preset?.startAudio && audio
    ? createTrainingAudio(preset.startAudio, audio, signal)
    : undefined;
}

type PlaybackBindings = Omit<
  ShowRuntimeOptions,
  "timebase" | "createNarration" | "droneOrgan"
>;
interface PlaybackComposition extends PlaybackBindings {
  readonly world: World;
  readonly signal: AbortSignal;
  readonly preset?: LevelPreset;
}

/** Construct shared sound, releasing unpublished resources if preparation fails. */
export async function composePlayback(
  request: ShowRequest,
  options: PlaybackComposition,
) {
  validateShowRequest(request);
  const preset = options.preset;
  const audio =
    !options.standalone || preset?.startAudio || preset?.start?.windStrength
      ? await createSpatialAudio(options.world.camera, options.signal)
      : undefined;
  let trainingAudio: TrainingAudio | undefined;
  try {
    options.signal.throwIfAborted();
    trainingAudio = await composeTrainingAudio(preset, audio, options.signal);
    const playback = await composeShow(request, options, audio);
    return { audio, trainingAudio, playback };
  } catch (error) {
    return releaseUnpublishedSound([trainingAudio, audio], error);
  }
}

async function composeShow(
  request: ShowRequest,
  options: PlaybackBindings,
  audio: SpatialAudio | undefined,
): Promise<ShowRuntime> {
  const timebase = createAudioTimebase();
  let droneOrgan: ReturnType<typeof composeOrgan>;
  try {
    droneOrgan = composeOrgan(options, audio);
  } catch (error) {
    return releaseUnpublishedSound([timebase], error);
  }
  return createShowRuntime(request, {
    ...options,
    timebase,
    createNarration: () => createNarrationPlayer({ recordings: [] }),
    droneOrgan,
  });
}

function composeOrgan(
  options: PlaybackBindings,
  audio: SpatialAudio | undefined,
) {
  if (
    !audio ||
    (options.standalone && !options.tutorial?.parameters.windStrength)
  )
    return undefined;
  return createDroneOrgan(
    {
      pulseSeconds: ORGAN_SCORE.pulseSeconds,
      voices: options.standalone ? ["wind"] : undefined,
    },
    audio,
  );
}

/** End unpublished followers before their context and preserve the construction failure. */
async function releaseUnpublishedSound(
  owners: readonly (
    | { readonly unload: () => void | Promise<void> }
    | undefined
  )[],
  failure: unknown,
): Promise<never> {
  const errors = [failure];
  for (const owner of owners) {
    try {
      await owner?.unload();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 1)
    throw new AggregateError(errors, "Sound construction and cleanup failed");
  throw failure;
}
