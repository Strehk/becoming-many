/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Apply startup presentation, coordinate lifecycle, connect controls, and update one running level.
 * Boundary: Authored data and concrete world composition live in dedicated level files.
 */

import type { WebGLRenderer } from "three";
import type { BenchmarkRun } from "../benchmark/benchmark-run";
import { createDesktopControls } from "../control/desktop-controls";
import {
  BASE_MINIMUM_GROUND_CLEARANCE_METERS,
  keepFlightWithinHeightLimits,
} from "../control/flight-ground-clearance";
import { resetFlightPose } from "../control/flight-reset";
import { FLIGHT_SETTINGS } from "../control/flight-settings";
import { applyM5Flight } from "../control/m5-flight";
import { showLevelStateAt } from "../dramaturgy/show-levels";
import { createM5Adapter, type M5Adapter } from "../m5/m5-adapter";
import { createWorld, type WorldContext } from "../world/world-runtime";
import type { XrSessionControl } from "../world/xr-session";
import {
  composeLevel,
  loadLevelAssets,
  type TestLevelModules,
} from "./level-composition";
import type { LevelPreset } from "./level-preset";
import {
  createShowRuntime,
  type RunningShow,
  type ShowRequest,
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
  readonly preset: LevelPreset;
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
  readonly benchmark?: BenchmarkRun;
}

export interface ShowLevelRequest extends CommonLevelRequest {
  readonly kind: "show";
  readonly show: ShowRequest;
}

/** Both run modes construct one preset; Show adds its timeline and live states. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;

export async function startLevel(
  container: Element | null,
  request: LevelStartRequest,
): Promise<RunningLevel> {
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing level container element");
  }

  const level = request.preset;
  const assets = await loadLevelAssets(level, request.kind === "show");
  const benchmark = request.kind === "static" ? request.benchmark : undefined;
  const world = createWorld(container, {
    frameControl: benchmark,
    viewPitchAssistDegrees: FLIGHT_SETTINGS.viewPitchAssistDegrees,
  });
  const presentation = initialLevelPresentation(request);
  world.renderer.setClearColor(presentation.backgroundColor);
  world.camera.far = presentation.viewDistance;
  world.camera.updateProjectionMatrix();

  const { worldSurface, modules, reach, hasGround } = composeLevel({
    world,
    level,
    assets,
    materialHazeColor: level.backgroundColor,
    forShow: request.kind === "show",
    testModules: request.testModules,
  });
  for (const module of modules) {
    world.modules.load(module);
    world.modules.activate(module);
  }
  if (request.kind === "show") await world.prepareRenderer();

  // Benchmarks place the rig directly; live input sources stay absent.
  const desktop = benchmark
    ? undefined
    : createDesktopControls(
        world.camera,
        world.viewerRig,
        world.renderer.domElement,
      );
  // Without a host, the adapter owns no timer or network work.
  const m5 = benchmark
    ? undefined
    : createM5Adapter(request.m5ExpectedDeviceId);
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
  // Static runs (including benchmarks) never create show time or audio.
  const show =
    request.kind === "show"
      ? createShowRuntime(request.show, world, reach, worldSurface)
      : undefined;
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

  world.start(updateFrame);
  return {
    show: show?.running,
    resetFlight: (): void =>
      resetFlightPose(world.viewerRig.position, world.viewerRig.quaternion),
    readFrameMetrics,
    m5,
    xr: world.xr,
  };

  function updateFrame(deltaSeconds: number): void {
    frameMetrics?.add(deltaSeconds);
    if (benchmark) {
      benchmark.placeViewer(world.viewerRig);
    } else {
      const controlFrame = m5?.readFrame();
      if (controlFrame)
        applyM5Flight(world.viewerRig, controlFrame, deltaSeconds);
      else desktop?.update(deltaSeconds);
    }

    show?.update();
    heightLimits.maximumGroundClearanceMeters = show
      ? show.readActiveLevelState().maximumGroundClearanceMeters
      : staticMaximumGroundClearanceMeters;
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
  }
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
