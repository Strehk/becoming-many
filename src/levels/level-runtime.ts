/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Apply startup presentation, coordinate lifecycle, connect controls, and update one running level.
 * Boundary: Authored data and concrete world composition live in dedicated level files.
 */

import type { WebGLRenderer } from "three";
import type { BenchmarkRun } from "../benchmark/benchmark-run";
import { createDesktopControls } from "../control/desktop-controls";
import { createFlightControlSource } from "../control/flight-control-source";
import {
  BASE_MINIMUM_GROUND_CLEARANCE_METERS,
  keepFlightWithinHeightLimits,
} from "../control/flight-ground-clearance";
import { resetFlightPose } from "../control/flight-reset";
import { FLIGHT_SETTINGS } from "../control/flight-settings";
import { showLevelStateAt } from "../dramaturgy/show-levels";
import { createM5Adapter, type M5Adapter } from "../m5/m5-adapter";
import type { WorldModule } from "../world/module-runtime";
import {
  startWorld,
  type WorldContext,
  type WorldUpdate,
} from "../world/world-runtime";
import type { XrSessionControl } from "../world/xr-session";
import type { WorldSurface } from "../world-surface/world-surface";
import {
  composeLevel,
  type LoadedLevelAssets,
  loadLevelAssets,
  type TestLevelModules,
} from "./level-composition";
import type {
  LevelPreset,
  ShowComposition,
  WorldComposition,
} from "./level-preset";
import { prepareShowRenderer } from "./show-renderer-preparation";
import {
  createShowRuntime,
  type RunningShow,
  type ShowRequest,
  type ShowRuntime,
  type ShowWorldReach,
} from "./show-runtime";

export interface FrameMetrics {
  readonly framesPerSecond: number;
  readonly p95Milliseconds: number;
}

interface FrameMetricsRecorder {
  readonly add: (deltaSeconds: number) => void;
  readonly read: () => FrameMetrics | undefined;
}

interface LevelTestOverlay {
  readonly update: (deltaSeconds: number) => void;
}

type TestOverlayFactory = (
  container: HTMLElement,
  renderer: WebGLRenderer,
  readFrameMetrics: () => FrameMetrics | undefined,
) => LevelTestOverlay;

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

interface CommonLevelRequest {
  readonly m5ExpectedDeviceId?: string;
  /** Entry-owned sampling used by Test UI or the Conductor status strip. */
  readonly frameMetrics?: FrameMetricsRecorder;
  /** Test-entry UI factory; absent from show entry graphs. */
  readonly testOverlay?: TestOverlayFactory;
  /** Concrete modules that only diagnostic presets can request. */
  readonly testModules?: TestLevelModules;
}

export interface StaticLevelRequest extends CommonLevelRequest {
  readonly kind: "static";
  readonly preset: LevelPreset;
  readonly benchmark?: BenchmarkRun;
}

export interface ShowLevelRequest extends CommonLevelRequest {
  readonly kind: "show";
  readonly composition: ShowComposition;
  readonly show: ShowRequest;
}

/** A run is either one standalone preset or one preloaded show composition. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;

export async function startLevel(
  container: Element | null,
  request: LevelStartRequest,
): Promise<RunningLevel> {
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing level container element");
  }

  const level =
    request.kind === "static" ? request.preset : request.composition.world;
  const assets = await loadLevelAssets(level, request.kind === "show");
  let running: RunningLevel | undefined;
  await startWorld(container, {
    setupWorld: async (world) => {
      const setup = await setupLevel(container, world, level, assets, request);
      running = setup.running;
      return setup.update;
    },
    frameControl: request.kind === "static" ? request.benchmark : undefined,
    viewPitchAssistDegrees: FLIGHT_SETTINGS.viewPitchAssistDegrees,
  });

  if (!running) throw new Error("The world runtime skipped level setup");

  return running;
}

interface LevelUpdate {
  readonly update: WorldUpdate;
  readonly running: RunningLevel;
}

async function setupLevel(
  container: HTMLElement,
  world: WorldContext,
  level: WorldComposition,
  assets: LoadedLevelAssets,
  request: LevelStartRequest,
): Promise<LevelUpdate> {
  const { worldSurface, reach, hasGround } = await prepareLevelComposition({
    world,
    level,
    assets,
    request,
  });
  const benchmark = request.kind === "static" ? request.benchmark : undefined;
  const { flightControl, m5 } = createLevelControls(
    world,
    benchmark,
    request.m5ExpectedDeviceId,
  );
  const frameMetrics = request.frameMetrics;
  const readFrameMetrics = (): FrameMetrics | undefined => frameMetrics?.read();
  const testOverlay = createOptionalTestOverlay({
    container,
    world,
    request,
    benchmark,
    readFrameMetrics,
    factory: request.testOverlay,
  });
  // A benchmark must stay deterministic: an audio context and media elements
  // would add nondeterministic decode work to the samples, and a fixed
  // timestep is not the real time the show is cut to.
  const show = createOptionalShow({
    request,
    benchmark,
    world,
    reach,
    worldSurface,
  });
  const staticMaximumGroundClearanceMeters =
    request.kind === "static"
      ? request.preset.maximumGroundClearanceMeters
      : undefined;
  const heightLimits = {
    minimumGroundClearanceMeters: hasGround
      ? BASE_MINIMUM_GROUND_CLEARANCE_METERS
      : undefined,
    maximumGroundClearanceMeters: staticMaximumGroundClearanceMeters,
  };

  return {
    update: createLevelUpdate({
      world,
      worldSurface,
      benchmark,
      flightControl,
      show,
      frameMetrics,
      heightLimits,
      staticMaximumGroundClearanceMeters,
      testOverlay,
    }),

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

interface LevelCompositionOptions {
  readonly world: WorldContext;
  readonly level: WorldComposition;
  readonly assets: LoadedLevelAssets;
  readonly request: LevelStartRequest;
}

interface PreparedLevelComposition {
  readonly worldSurface: WorldSurface;
  readonly reach: ShowWorldReach;
  readonly hasGround: boolean;
}

async function prepareLevelComposition(
  options: LevelCompositionOptions,
): Promise<PreparedLevelComposition> {
  const { world, level, assets, request } = options;
  applyLevelPresentation(world, initialLevelPresentation(request));

  const composed = composeLevel({
    world,
    level,
    assets,
    materialHazeColor:
      request.kind === "static"
        ? request.preset.backgroundColor
        : request.composition.materialHazeColor,
    forShow: request.kind === "show",
    testModules: request.testModules,
  });
  activateModules(world, composed.modules);
  if (request.kind === "show") await prepareShowRenderer(world);

  return {
    worldSurface: composed.worldSurface,
    reach: composed.reach,
    hasGround: composed.hasGround,
  };
}

type LevelPresentation = Pick<LevelPreset, "backgroundColor" | "viewDistance">;

function initialLevelPresentation(
  request: LevelStartRequest,
): LevelPresentation {
  if (request.kind === "static") return request.preset;

  const openingState = showLevelStateAt(
    request.show.schedule,
    request.show.states,
    0,
  );
  if (!openingState) throw new Error("A show schedule needs at least one cue");

  return openingState;
}

interface LevelControls {
  readonly flightControl:
    | ReturnType<typeof createFlightControlSource>
    | undefined;
  readonly m5: M5Adapter | undefined;
}

function createLevelControls(
  world: WorldContext,
  benchmark: BenchmarkRun | undefined,
  expectedM5DeviceId: string | undefined,
): LevelControls {
  // Benchmarks drive the rig directly and must not create live input sources.
  if (benchmark) return { flightControl: undefined, m5: undefined };

  const desktop = createDesktopControls(
    world.camera,
    world.viewerRig,
    world.renderer.domElement,
  );
  // Created idle: without a host, the adapter owns no timer or network work.
  const m5 = createM5Adapter(expectedM5DeviceId);
  return {
    flightControl: createFlightControlSource(world.viewerRig, desktop, m5),
    m5,
  };
}

interface OptionalTestOverlayOptions {
  readonly container: HTMLElement;
  readonly world: WorldContext;
  readonly request: LevelStartRequest;
  readonly benchmark: BenchmarkRun | undefined;
  readonly readFrameMetrics: () => FrameMetrics | undefined;
  readonly factory: TestOverlayFactory | undefined;
}

function createOptionalTestOverlay(
  options: OptionalTestOverlayOptions,
): LevelTestOverlay | undefined {
  if (
    options.benchmark ||
    options.request.kind !== "static" ||
    !options.request.preset.testUi ||
    !options.factory
  ) {
    return undefined;
  }

  return options.factory(
    options.container,
    options.world.renderer,
    options.readFrameMetrics,
  );
}

interface OptionalShowOptions {
  readonly request: LevelStartRequest;
  readonly benchmark: BenchmarkRun | undefined;
  readonly world: WorldContext;
  readonly reach: ShowWorldReach;
  readonly worldSurface: WorldSurface;
}

function createOptionalShow(
  options: OptionalShowOptions,
): ShowRuntime | undefined {
  if (options.benchmark || options.request.kind !== "show") return undefined;
  return createShowRuntime(
    options.request.show,
    options.world,
    options.reach,
    options.worldSurface,
  );
}

interface LevelFrameOptions {
  readonly world: WorldContext;
  readonly worldSurface: WorldSurface;
  readonly benchmark: BenchmarkRun | undefined;
  readonly flightControl:
    | ReturnType<typeof createFlightControlSource>
    | undefined;
  readonly show: ReturnType<typeof createShowRuntime> | undefined;
  readonly frameMetrics: FrameMetricsRecorder | undefined;
  readonly heightLimits: {
    minimumGroundClearanceMeters: number | undefined;
    maximumGroundClearanceMeters: number | undefined;
  };
  readonly staticMaximumGroundClearanceMeters: number | undefined;
  readonly testOverlay: LevelTestOverlay | undefined;
}

function createLevelUpdate(options: LevelFrameOptions): WorldUpdate {
  return (deltaSeconds): void => {
    options.frameMetrics?.add(deltaSeconds);
    if (options.benchmark) {
      options.benchmark.placeViewer(options.world.viewerRig);
    } else {
      options.flightControl?.update(deltaSeconds);
    }

    options.show?.update();
    options.heightLimits.maximumGroundClearanceMeters = options.show
      ? options.show.readActiveLevelState().maximumGroundClearanceMeters
      : options.staticMaximumGroundClearanceMeters;
    if (
      options.heightLimits.minimumGroundClearanceMeters !== undefined ||
      options.heightLimits.maximumGroundClearanceMeters !== undefined
    ) {
      keepFlightWithinHeightLimits(
        options.world.viewerRig.position,
        options.worldSurface.groundYAt,
        options.heightLimits,
      );
    }
    options.testOverlay?.update(deltaSeconds);
  };
}

function applyLevelPresentation(
  { camera, renderer }: WorldContext,
  level: LevelPresentation,
): void {
  renderer.setClearColor(level.backgroundColor);
  camera.far = level.viewDistance;
  camera.updateProjectionMatrix();
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
