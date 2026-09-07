/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Apply startup presentation, coordinate lifecycle, connect controls, and update one running level.
 * Boundary: Authored data and concrete world composition live in dedicated level files.
 */

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
import { disposeGltfAssets } from "../utils/asset-loader/gltf-assets";
import type { WorldModule } from "../world/module-runtime";
import {
  createWorld,
  type GraphicsInfo,
  type RenderCounters,
} from "../world/world-runtime";
import type { XrSessionControl } from "../world/xr-session";
import {
  composeLevel,
  type LoadedLevelAssets,
  loadLevelAssets,
  type TestLevelModules,
} from "./level-composition";
import type { LevelPreset } from "./level-preset";
import {
  createShowRuntime,
  type RunningShow,
  type ShowRequest,
  type ShowRuntime,
} from "./show-runtime";

/** One running level, returned so the page that started it can command it. */
export interface RunningLevel {
  readonly renderCounters: RenderCounters;
  /** Diagnostic reads only; never called by the frame loop. */
  readonly readGraphicsInfo: () => GraphicsInfo;
  readonly unload: () => Promise<void>;
  readonly show: RunningShow | undefined;

  /**
   * Return the flight rig to the level's start pose. The visitor's local head
   * pose remains owned by pointer look or the headset.
   */
  readonly resetFlight: () => void;

  /**
   * The M5 tilt controller, idle until a host is set (by the conductor page,
   * a deployment config, or a `?m5=` request). Undefined under a benchmark.
   */
  readonly m5: M5Adapter | undefined;

  /** The renderer's WebXR session, for the page that owns the entry button. */
  readonly xr: XrSessionControl;
}

interface CommonLevelRequest {
  readonly signal?: AbortSignal;
  readonly preset: LevelPreset;
  readonly m5ExpectedDeviceId?: string;
  /** Entry-owned diagnostic work; absent from normal Experience runs. */
  readonly onFrame?: (deltaSeconds: number) => void;
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
  const presentation = initialLevelPresentation(request);
  const benchmark = request.kind === "static" ? request.benchmark : undefined;
  let assets: LoadedLevelAssets | undefined;
  let world: ReturnType<typeof createWorld> | undefined;
  let modules: readonly WorldModule[] = [];
  let desktop: ReturnType<typeof createDesktopControls> | undefined;
  let m5: M5Adapter | undefined;
  let show: ShowRuntime | undefined;
  let unloading: Promise<void> | undefined;
  const signal = request.signal;
  signal?.throwIfAborted();

  try {
    assets = await loadLevelAssets(level, request.kind === "show", signal);
    signal?.throwIfAborted();
    world = createWorld(container, {
      frameControl: benchmark,
      viewPitchAssistDegrees: FLIGHT_SETTINGS.viewPitchAssistDegrees,
    });
    world.renderer.setClearColor(presentation.backgroundColor);
    world.camera.far = presentation.viewDistance;
    world.camera.updateProjectionMatrix();

    const composition = composeLevel({
      world,
      level,
      assets,
      forShow: request.kind === "show",
      testModules: request.testModules,
    });
    const { worldSurface, reach, hasGround } = composition;
    modules = composition.modules;
    for (const module of modules) {
      world.modules.load(module);
      world.modules.activate(module);
    }
    if (request.kind === "show") await world.prepareRenderer();
    signal?.throwIfAborted();

    // Benchmarks place the rig directly; live input sources stay absent.
    desktop = benchmark
      ? undefined
      : createDesktopControls(
          world.camera,
          world.viewerRig,
          world.renderer.domElement,
        );
    // Without a host, the adapter owns no timer or network work.
    m5 = benchmark ? undefined : createM5Adapter(request.m5ExpectedDeviceId);
    // Static runs (including benchmarks) never create show time or audio.
    show =
      request.kind === "show"
        ? await createShowRuntime(request.show, world, reach, worldSurface)
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

    signal?.throwIfAborted();
    signal?.addEventListener("abort", onAbort, { once: true });
    const runningWorld = world;
    world.start(updateFrame);
    return {
      unload,
      readGraphicsInfo: world.readGraphicsInfo,
      show: show?.running,
      resetFlight: (): void =>
        resetFlightPose(
          runningWorld.viewerRig.position,
          runningWorld.viewerRig.quaternion,
        ),
      renderCounters: world.renderCounters,
      m5,
      xr: world.xr,
    };

    function updateFrame(deltaSeconds: number): void {
      request.onFrame?.(deltaSeconds);
      if (benchmark) {
        benchmark.placeViewer(runningWorld.viewerRig);
      } else {
        const controlFrame = m5?.readFrame();
        if (controlFrame)
          applyM5Flight(runningWorld.viewerRig, controlFrame, deltaSeconds);
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
          runningWorld.viewerRig.position,
          worldSurface.groundYAt,
          heightLimits,
        );
      }
    }
  } catch (error) {
    try {
      await unload();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Level startup and cleanup failed",
      );
    }
    throw error;
  }

  function onAbort(): void {
    void unload().catch((error: unknown) =>
      console.error("Level cleanup failed", error),
    );
  }

  function unload(): Promise<void> {
    if (unloading) return unloading;
    signal?.removeEventListener("abort", onAbort);
    unloading = (async () => {
      const errors: unknown[] = [];
      const children = [
        (async () => {
          await world?.stop();
        })(),
        ...[desktop, m5, show].map(async (child) => {
          await child?.unload();
        }),
      ];
      for (const result of await Promise.allSettled(children)) {
        if (result.status === "rejected") errors.push(result.reason);
      }
      for (const module of [...modules].reverse()) {
        try {
          world?.modules.unload(module);
        } catch (error) {
          errors.push(error);
        }
      }
      if (assets) {
        for (const batch of [
          assets.vegetation,
          assets.rocks,
          assets.animals,
          assets.passages?.models,
        ]) {
          try {
            if (batch) disposeGltfAssets(batch);
          } catch (error) {
            errors.push(error);
          }
        }
      }
      try {
        await world?.unload();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length)
        throw new AggregateError(errors, "Level cleanup failed");
    })();
    return unloading;
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
