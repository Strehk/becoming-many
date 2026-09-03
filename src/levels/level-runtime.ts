/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Create shared level resources, compose configured modules, and connect controls.
 * Boundary: Level files contain authored data; modules own content definitions and resources.
 */

import { Color, type Matrix4 } from "three";
import type { BenchmarkRun } from "../benchmark/benchmark-run";
import { createDesktopControls } from "../control/desktop-controls";
import {
  BASE_MINIMUM_GROUND_CLEARANCE_METERS,
  keepFlightWithinHeightLimits,
} from "../control/flight-ground-clearance";
import { resetFlightPose } from "../control/flight-reset";
import { FLIGHT_SETTINGS } from "../control/flight-settings";
import { applyM5Flight } from "../control/m5-flight";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import {
  type NarrationSchedule,
  narrationCueAt,
  type ShowLevelName,
} from "../dramaturgy/narration-schedule";
import { createShowClock, type ShowClock } from "../dramaturgy/show-clock";
import {
  levelTransitionAt,
  type ShowSense,
  senseIntensityAt,
  showLevelAt,
} from "../dramaturgy/show-levels";
import { createM5Adapter, type M5Adapter } from "../m5/m5-adapter";
import {
  type AirParticlesParameters,
  createAirParticlesModule,
} from "../modules/air-particles/air-particles";
import {
  type AnimalBodiesObserver,
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
  createGrassClipmapModule,
  type GrassClipmapPreset,
} from "../modules/grass-clipmap/grass-clipmap";
import { getGrassZoneCoverage } from "../modules/grass-clipmap/grass-height-field";
import {
  createMagneticSense,
  type MagneticSenseModuleHandle,
  type MagneticSenseParameters,
} from "../modules/magnetic-sense/magnetic-sense";
import {
  createMotionSenseModule,
  type MotionSenseModuleHandle,
  type MotionSenseParameters,
} from "../modules/motion-sense/motion-sense";
import {
  type ConnectionsModuleHandle,
  type ConnectionsParameters,
  createConnectionsModule,
} from "../modules/mycelium/mycelium";
import { createRockConnectionSource } from "../modules/rocks/rock-nodes";
import { createRocksModule, type RocksPreset } from "../modules/rocks/rocks";
import { ROCKS_DEFINITION } from "../modules/rocks/rocks-definition";
import { createScentConnectionSource } from "../modules/scent-particles/scent-emitter-anchors";
import {
  createScentParticlesModule,
  type ScentParticlesModuleHandle,
  type ScentParticlesParameters,
} from "../modules/scent-particles/scent-particles";
import type { StaticPopulationPreset } from "../modules/static-population";
import { createGroundOccluder } from "../modules/terrain/ground-occluder";
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
import { createVegetationScentSource } from "../modules/vegetation/vegetation-scent";
import {
  createWorldFade,
  type WorldFadeEffect,
} from "../modules/world-fade/world-fade";
import { createZoneVisualizer } from "../modules/zone-visualizer/zone-visualizer";
import { createAudioTimebase } from "../sound/audio-timebase";
import { createNarrationPlayer } from "../sound/narration-player";
import {
  type FrameMetrics,
  FrameMetricsSampler,
} from "../test-ui/frame-metrics";
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
import type { XrSessionControl } from "../world/xr-session";
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

  /** Highest allowed rig altitude in metres above the local world surface. */
  readonly maximumGroundClearanceMeters?: number;

  /** Clamp flight above the shared world surface without rendering Terrain. */
  readonly invisibleGround?: true;

  /**
   * Grow the shared plant population without rendering it, the way
   * `invisibleGround` keeps the surface. The Scent World needs plants to
   * smell of while its intent keeps every source object invisible.
   */
  readonly invisibleVegetation?: StaticPopulationPreset;
  readonly airParticles?: AirParticlesParameters;
  readonly scentParticles?: ScentParticlesParameters;
  readonly terrain?: TerrainPreset;
  readonly grass?: GrassPreset;

  /**
   * The clipmap grass field, ported from the standalone grass demo. It is a
   * separate module rather than a mode of `grass`: it places nothing on the
   * CPU and carries its own ground sampling, so the two cannot share a
   * preset. `echo.level.ts` authors it and every later preset carries it.
   */
  readonly grassClipmap?: GrassClipmapPreset;
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

  /** A sky dome whose pole shimmer follows the authored magnetic field axis. */
  readonly magnetic?: MagneticSenseParameters;

  /**
   * The final synthesis: inside a viewer-centred radius a pulsing root web
   * blends over the carried world, connecting the same deterministic world
   * positions the earlier senses already show.
   */
  readonly connections?: ConnectionsParameters;
}

/** The per-frame half of a running show; the commandable half goes to the caller. */
interface ShowUpdate {
  readonly update: () => void;
  readonly readActiveLevelPreset: () => LevelPreset;
  readonly running: RunningShow;
}

/**
 * The show half of a running level, present only when one was requested.
 * Reported once so a rehearsal or operator surface can drive it; nothing under
 * `src` reads it back, which is what keeps the show clock the sole authority.
 */
export interface RunningShow {
  readonly clock: ShowClock;
  readonly readLanguage: () => NarrationLanguage;

  /** The world state the show currently stands in; the status reports it. */
  readonly readActiveLevel: () => ShowLevelName;

  /**
   * Re-seats the narration in the other language and pauses the show. Fresh
   * elements carry no metadata yet, so a seek into them is ignored for a few
   * frames and playback would otherwise start at the top of the recording.
   * The caller presses play again once it is ready.
   */
  readonly setLanguage: (language: NarrationLanguage) => void;

  /** Suspended freezes show time; only a gesture in this window resumes it. */
  readonly readAudioState: () => AudioContextState;
}

/** One running level, returned so the page that started it can command it. */
export interface RunningLevel {
  readonly show: RunningShow | undefined;

  /**
   * Return the flight rig to the level's start pose. The visitor's local head
   * pose remains owned by pointer look or the headset.
   */
  readonly resetFlight: () => void;

  /** Undefined until frames have been measured. Allocates; not per frame. */
  readonly readFrameMetrics: () => FrameMetrics | undefined;

  /**
   * The M5 tilt controller, idle until a host is set (by the conductor page,
   * a deployment config, or a `?m5=` request). Undefined under a benchmark.
   */
  readonly m5: M5Adapter | undefined;

  /** The renderer's WebXR session, for the page that owns the entry button. */
  readonly xr: XrSessionControl;
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
  /** Only a show composes world fades; a static run keeps its materials bare. */
  readonly forShow: boolean;
}

/** Optional run modes the browser entry can request for any preset. */
export interface LevelOptions {
  /** Replay a fixed route with a fixed timestep instead of live controls. */
  readonly benchmark?: BenchmarkRun;

  /** Play a narration show against this preset. */
  readonly show?: ShowRequest;

  /**
   * DeviceId the M5 adapter expects, from the deployment config. Absent, the
   * authored default in m5-settings.ts holds (accept any device).
   */
  readonly m5ExpectedDeviceId?: string;
}

/**
 * One narration show. It is a run mode rather than level data: the schedule's
 * cues say which world state holds when, the composed world follows them by
 * gating modules and fading sense intensities, and the language is session
 * state fixed when staff arm a session.
 */
export interface ShowRequest {
  readonly schedule: NarrationSchedule;
  /** The language staff arm the session with; the conductor can re-arm it. */
  readonly language: NarrationLanguage;
  /** The preset behind each world state the schedule can call for. */
  readonly levels: Record<ShowLevelName, LevelPreset>;
}

export async function startLevel(
  container: Element | null,
  level: LevelPreset,
  options: LevelOptions = {},
): Promise<RunningLevel> {
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing level container element");
  }

  const assets = await loadLevelAssets(level);
  // The World Runtime calls its setup synchronously, before it returns, so the
  // handle is always in hand by the time this function continues.
  let running: RunningLevel | undefined;
  startWorld(container, {
    setupWorld: (world) => {
      const setup = setupLevel(container, world, level, assets, options);
      running = setup.running;
      return setup.update;
    },
    frameControl: options.benchmark,
    viewPitchAssistDegrees: FLIGHT_SETTINGS.viewPitchAssistDegrees,
  });

  if (!running) throw new Error("The world runtime skipped level setup");

  return running;
}

interface LevelUpdate {
  readonly update: WorldUpdate;
  readonly running: RunningLevel;
}

function setupLevel(
  container: HTMLElement,
  world: WorldContext,
  level: LevelPreset,
  assets: LoadedLevelAssets,
  options: LevelOptions,
): LevelUpdate {
  applyLevelPresentation(world, level);

  const worldSurface = createWorldSurface(
    WORLD_SURFACE_SETTINGS,
    ZONE_SETTINGS,
  );
  const composed = createConfiguredModules({
    world,
    level,
    worldSurface,
    assets,
    forShow: options.show !== undefined,
  });
  activateModules(world, composed.modules);

  const benchmark = options.benchmark;
  // A benchmark drives the viewer rig itself; PointerLock controls cannot be
  // driven reproducibly, and the overlay would add DOM writes to the samples.
  const desktopControls = benchmark
    ? undefined
    : createDesktopControls(
        world.camera,
        world.viewerRig,
        world.renderer.domElement,
      );
  // Created idle: with no host set it owns no timer and touches no network,
  // so a show without a conductor behaves exactly as before.
  const m5 = benchmark
    ? undefined
    : createM5Adapter(options.m5ExpectedDeviceId);
  const hasGround = level.invisibleGround === true || hasVisibleSurface(level);
  // One sampler for the whole level: the narrative presets never set `testUi`,
  // so metrics read from the overlay would be missing exactly where an
  // operator surface needs them.
  const frameMetrics = new FrameMetricsSampler();
  const readFrameMetrics = (): FrameMetrics | undefined => frameMetrics.read();
  const testOverlay =
    level.testUi && !benchmark
      ? createTestOverlay(container, world.renderer, readFrameMetrics)
      : undefined;
  // A benchmark must stay deterministic: an audio context and media elements
  // would add nondeterministic decode work to the samples, and a fixed
  // timestep is not the real time the show is cut to.
  const show = benchmark
    ? undefined
    : createShow(options.show, world, composed.reach);
  const heightLimits = {
    minimumGroundClearanceMeters: hasGround
      ? BASE_MINIMUM_GROUND_CLEARANCE_METERS
      : undefined,
    maximumGroundClearanceMeters: level.maximumGroundClearanceMeters,
  };

  return {
    update: (deltaSeconds): void => {
      frameMetrics.add(deltaSeconds);
      if (benchmark) {
        benchmark.placeViewer(world.viewerRig);
      } else {
        // With an M5 host configured the glider flies every frame — a poll
        // failure only straightens the steering, it never stops the flight.
        // Keyboard movement returns when the host is cleared; mouse look
        // stays live either way. This is the frame's one readFrame call —
        // it consumes the latched button edges.
        const controlFrame = m5?.readFrame();
        if (controlFrame) {
          applyM5Flight(world.viewerRig, controlFrame, deltaSeconds);
        } else {
          desktopControls?.update(deltaSeconds);
        }
      }

      show?.update();
      heightLimits.maximumGroundClearanceMeters = show
        ? show.readActiveLevelPreset().maximumGroundClearanceMeters
        : level.maximumGroundClearanceMeters;
      if (
        heightLimits.minimumGroundClearanceMeters !== undefined ||
        heightLimits.maximumGroundClearanceMeters !== undefined
      ) {
        keepFlightWithinHeightLimits(
          world.viewerRig.position,
          worldSurface.groundYAt,
          heightLimits,
        );
      }
      testOverlay?.update(deltaSeconds);
    },

    running: {
      show: show?.running,
      resetFlight: (): void =>
        resetFlightPose(world.viewerRig.position, world.viewerRig.quaternion),
      readFrameMetrics,
      m5,
      xr: world.xr,
    },
  };
}

/**
 * Wire the show clock to the followers that read it: the narration, the world
 * state, and the sense fades. The clock reads the audio hardware timebase and
 * every follower reads the clock; that direction is what makes a seek land
 * inside a recording — and inside a world state — instead of retriggering it.
 */
function createShow(
  request: ShowRequest | undefined,
  world: WorldContext,
  reach: ShowWorldReach,
): ShowUpdate | undefined {
  if (!request) return undefined;

  // Narrowed aliases: parameter narrowing does not reach into closures.
  const { schedule, levels } = request;

  const openingLevel = showLevelAt(schedule, 0);
  if (!openingLevel) {
    throw new Error("A show schedule needs at least one cue");
  }

  const timebase = createAudioTimebase();
  const clock = createShowClock(
    request.schedule.durationSeconds,
    timebase.readSeconds,
  );
  const cueIds = request.schedule.narration.map((cue) => cue.cueId);
  let language = request.language;
  let narration = createNarrationPlayer({ language, cueIds });
  let activeLevel: ShowLevelName | undefined;
  // Scratch color and per-level constants, so following allocates nothing.
  const liveBackground = new Color(0xffffff);
  const backgroundColors = new Map<ShowLevelName, Color>();
  const backgroundOf = (name: ShowLevelName): Color => {
    let color = backgroundColors.get(name);
    if (!color) {
      color = new Color(levels[name].backgroundColor ?? 0xffffff);
      backgroundColors.set(name, color);
    }
    return color;
  };

  /**
   * Stand the world in the state the schedule calls for at this instant.
   * Nothing cuts: every sense ramps through its strength driver, structure
   * dissolves into and out of the lerping background through the world
   * fades, and each gated module stays active exactly while the sense that
   * introduces it carries any strength — so a fading-out module keeps
   * rendering until it has fully dissolved. Everything derives from the
   * sampled show time, so a seek or scrub lands mid-fade exactly where
   * playing through would have.
   */
  function followWorld(showTimeSeconds: number): void {
    followViewDistance(showTimeSeconds);
    followBackground(showTimeSeconds);
    followSenses(showTimeSeconds);
  }

  function followViewDistance(showTimeSeconds: number): void {
    const levelName = showLevelAt(schedule, showTimeSeconds);
    if (levelName === undefined || levelName === activeLevel) return;

    const preset = levels[levelName];
    if (preset.viewDistance !== undefined) {
      world.camera.far = preset.viewDistance;
      world.camera.updateProjectionMatrix();
    }
    activeLevel = levelName;
  }

  // The background crosses between world states over the fade window; the
  // world fades and the sky dome must chase it, or dissolving surfaces
  // would blend toward a sky that is no longer there.
  function followBackground(showTimeSeconds: number): void {
    const transition = levelTransitionAt(schedule, showTimeSeconds);
    if (!transition) return;

    liveBackground
      .copy(backgroundOf(transition.from))
      .lerp(backgroundOf(transition.to), transition.progress);
    world.renderer.setClearColor(liveBackground);
    reach.worldFades.structure?.setBackground(liveBackground);
    reach.worldFades.animals?.setBackground(liveBackground);
    reach.setSkyBackground?.(liveBackground);
  }

  function followSenses(showTimeSeconds: number): void {
    const strengths: Record<ShowSense, number> = {
      scent: senseIntensityAt(schedule, "scent", showTimeSeconds),
      echo: senseIntensityAt(schedule, "echo", showTimeSeconds),
      motion: senseIntensityAt(schedule, "motion", showTimeSeconds),
      thermal: senseIntensityAt(schedule, "thermal", showTimeSeconds),
      magnetic: senseIntensityAt(schedule, "magnetic", showTimeSeconds),
      connections: senseIntensityAt(schedule, "connections", showTimeSeconds),
    };
    for (const sense of Object.keys(strengths) as readonly ShowSense[]) {
      reach.senses[sense]?.(strengths[sense]);
    }
    // Structure rides the sense that introduces it: surfaces condense with
    // the depth response, the animal population with the heat view.
    reach.worldFades.structure?.setPresence(strengths.echo);
    reach.worldFades.animals?.setPresence(strengths.thermal);

    for (const [gate, module] of reach.gates) {
      if (strengths[GATE_SENSE[gate]] > 0) world.modules.activate(module);
      else world.modules.deactivate(module);
    }
  }

  // Open in the first cue's world before the first frame renders: the
  // composition activates every module, and this puts away the ones the
  // opening state does not carry.
  followWorld(0);

  return {
    update: (): void => {
      // Sample once: every read of the clock re-derives from a live timebase,
      // so two reads in one frame would answer with two different instants.
      const showTime = clock.sample();
      narration.follow({
        position: narrationCueAt(request.schedule, showTime.timeSeconds),
        isPlaying: showTime.isPlaying,
        timeScale: showTime.timeScale,
      });
      followWorld(showTime.timeSeconds);
    },

    readActiveLevelPreset: (): LevelPreset =>
      levels[activeLevel ?? openingLevel],

    running: {
      clock,
      readLanguage: () => language,
      readActiveLevel: () => activeLevel ?? openingLevel,
      readAudioState: timebase.readState,

      setLanguage: (next): void => {
        if (next === language) return;

        // Hold the show across the swap. The replacement elements have no
        // metadata yet, so `follow()` cannot seek into them for a few frames
        // and a playing show would blurt the top of the recording instead.
        clock.pause();
        narration.unload();
        language = next;
        narration = createNarrationPlayer({ language, cueIds });
      },
    },
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

/**
 * A module a show puts up or away as the world state changes. Each gate rides
 * the sense that introduces its module on the ladder: the module is active
 * exactly while that sense carries any strength, so a fading-out module keeps
 * rendering until it has fully dissolved. Air Particles stay ungated — every
 * world state carries them as the neutral depth baseline.
 */
type ShowGate =
  | "scentParticles"
  | "terrain"
  | "vegetation"
  | "rocks"
  | "animals"
  | "motion"
  | "magneticSky"
  | "connections";

/** The ladder sense whose strength opens and closes each gate. */
const GATE_SENSE: Record<ShowGate, ShowSense> = {
  scentParticles: "scent",
  terrain: "echo",
  vegetation: "echo",
  rocks: "echo",
  animals: "thermal",
  motion: "motion",
  magneticSky: "magnetic",
  connections: "connections",
};

/**
 * One runtime strength driver per sense, present when its module exists.
 * Echo never has one — see `ComposedSenseHandles` — but its strength still
 * matters: the structure World Fade and the surface gates ride it.
 */
type SenseDrivers = Readonly<
  Partial<Record<ShowSense, (intensity: number) => void>>
>;

/**
 * How a running show reaches into the composed world: one gate per structural
 * module, one strength driver per sense, the world fades that blend surface
 * groups toward the background, and the magnetic sky's haze tracking.
 */
interface ShowWorldReach {
  readonly gates: ReadonlyMap<ShowGate, WorldModule>;
  readonly senses: SenseDrivers;
  /** Composed only for a show; a static run keeps its materials bare. */
  readonly worldFades: {
    /** Terrain, Vegetation, and Rocks — the surfaces echo introduces. */
    readonly structure?: WorldFadeEffect;
    /** The warm animal population thermal introduces. */
    readonly animals?: WorldFadeEffect;
  };
  /** Keeps the opaque sky dome on the live background while it lerps. */
  readonly setSkyBackground?: (background: Color) => void;
}

interface ComposedWorld {
  readonly modules: readonly WorldModule[];
  readonly reach: ShowWorldReach;
}

function createConfiguredModules(setup: LevelSetup): ComposedWorld {
  const modules: WorldModule[] = [];
  const gates = new Map<ShowGate, WorldModule>();
  const add = (
    gate: ShowGate | undefined,
    module: WorldModule | undefined,
  ): void => {
    if (!module) return;
    modules.push(module);
    if (gate) gates.set(gate, module);
  };

  // World fades exist only for a show: a static run never fades, so its
  // materials skip the extra fragment mix entirely.
  const structureFade = setup.forShow ? createWorldFade() : undefined;
  const animalsFade = setup.forShow ? createWorldFade() : undefined;

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
    "terrain",
    createTerrain(
      setup,
      echoDepth,
      thermal,
      structureFade,
      connections?.terrain,
    ),
  );
  add(undefined, createAirParticles(setup));
  add("scentParticles", scent?.module);
  add(undefined, createGrass(setup, echoDepth, thermal, structureFade));
  add(undefined, createGrassClipmap(setup, echoDepth, thermal, structureFade));
  add("vegetation", createVegetation(setup, echoDepth, thermal, structureFade));
  add("rocks", createRocks(setup, echoDepth, thermal, structureFade));
  add("animals", animals?.module);
  add("motion", motion?.module);
  add("magneticSky", magnetic?.module);
  add("connections", connections?.module);

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
}

function composeShowReach(
  gates: ReadonlyMap<ShowGate, WorldModule>,
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
    fogColor: setup.level.backgroundColor ?? 0xffffff,
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
    effects: buildSurfaceEffects(worldFade, thermal?.vegetation, echoDepth),
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

function hasVisibleSurface(level: LevelPreset): boolean {
  return Boolean(
    level.terrain ||
      level.grass ||
      level.vegetation ||
      level.rocks ||
      level.animals,
  );
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
