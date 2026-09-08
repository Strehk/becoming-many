/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Apply startup presentation, coordinate lifecycle, connect controls, and update one running level.
 * Boundary: Authored data and concrete world composition live in dedicated level files.
 */

import type { BenchmarkRun } from "../benchmark/benchmark-run";
import { createDesktopControls } from "../control/desktop-controls.runtime";
import { keepFlightWithinHeightLimits } from "../control/flight-ground-clearance";
import { resetFlightPose } from "../control/flight-reset";
import { FLIGHT_SETTINGS } from "../control/flight-settings";
import { createM5Flight } from "../control/m5-flight.runtime";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../dramaturgy/piece-schedule";
import { SHOW_LEVEL_STATES, showLevelStateAt } from "../dramaturgy/show-levels";
import { createM5Runtime, type M5Runtime } from "../m5/runtime/m5.runtime";
import {
  createSpatialAudio,
  type SpatialAudio,
} from "../sound/spatial-audio.runtime";
import {
  createTrainingAudio,
  type TrainingAudio,
} from "../sound/training-audio.runtime";
import { disposeGltfAssets } from "../utils/asset-loader/gltf-assets";
import type { WorldModule } from "../world/module-runtime";
import { VIEW_PITCH_ASSIST_DEGREES } from "../world/viewer-rig";
import {
  createWorld,
  type GraphicsInfo,
  type RenderCounters,
  type WorldViewport,
} from "../world/world-runtime";
import type { XrSessionControl } from "../world/xr-session";
import {
  composeLevel,
  composeTraining,
  type LoadedLevelAssets,
  loadLevelAssets,
} from "./level-composition";
import type { LevelPreset } from "./level-preset";
import {
  createShowRuntime,
  type RunningShow,
  type ShowRequest,
  type ShowRuntime,
} from "./show.runtime";

/** One experience lifetime, with commands and observations for its entry/UI. */
export interface Run {
  readonly renderCounters: RenderCounters;
  /** Diagnostic reads only; never called by the frame loop. */
  readonly readGraphicsInfo: () => GraphicsInfo;
  readonly unload: () => Promise<void>;
  readonly show: RunningShow | undefined;
  readonly training: RunningShow | undefined;

  /**
   * Return the flight rig to the level's start pose. The visitor's local head
   * pose remains owned by pointer look or the headset.
   */
  readonly resetFlight: () => void;
  /** Rewind, reset the flight rig and hold; this does not replace the Run. */
  readonly resetShowAndFlight: () => void;

  /**
   * The M5 tilt controller, idle until a host is set (by the conductor page,
   * a deployment config, or a `?m5=` request). Undefined under a benchmark.
   */
  readonly m5: Pick<M5Runtime, "setHost" | "readObservation"> | undefined;

  /** The renderer's WebXR session, for the page that owns the entry button. */
  readonly xr: Pick<XrSessionControl, "start" | "stop" | "subscribe">;
}

interface CommonLevelRequest {
  readonly signal?: AbortSignal;
  readonly preset: LevelPreset;
  readonly language?: NarrationLanguage;
  readonly m5ExpectedDeviceId?: string;
  /** Entry-owned diagnostic work; absent from normal Experience runs. */
  readonly onFrame?: (deltaSeconds: number) => void;
}

export interface StaticLevelRequest extends CommonLevelRequest {
  readonly kind: "static";
  readonly benchmark?: BenchmarkRun;
}

export interface ShowLevelRequest extends CommonLevelRequest {
  readonly kind: "show";
  readonly show: ShowRequest;
  readonly tutorial?: LevelPreset;
}

/** Both run modes construct one preset; Show adds its timeline and live states. */
export type LevelStartRequest = StaticLevelRequest | ShowLevelRequest;

export async function startLevel(
  surface: WorldViewport,
  request: LevelStartRequest,
): Promise<Run> {
  const level = request.preset;
  const presentation = initialLevelPresentation(request);
  const benchmark = request.kind === "static" ? request.benchmark : undefined;
  let assets: LoadedLevelAssets | undefined;
  let world: ReturnType<typeof createWorld> | undefined;
  let modules: WorldModule[] = [];
  let audio: SpatialAudio | undefined;
  let trainingAudio: TrainingAudio | undefined;
  let trainingPreparation: AbortController | undefined;
  let trainingLoading: Promise<void> | undefined;
  let desktop: ReturnType<typeof createDesktopControls> | undefined;
  let m5: M5Runtime | undefined;
  let show: ShowRuntime | undefined;
  let unloading: Promise<void> | undefined;
  const lifetime = new AbortController();
  const signal = request.signal
    ? AbortSignal.any([request.signal, lifetime.signal])
    : lifetime.signal;
  const tutorialPreset =
    request.kind === "show"
      ? request.tutorial
      : level.start
        ? level
        : undefined;
  signal?.throwIfAborted();

  try {
    assets = await loadLevelAssets(level, request.kind === "show", signal);
    signal?.throwIfAborted();
    world = createWorld(surface, {
      frameControl: benchmark,
      viewPitchAssistDegrees: VIEW_PITCH_ASSIST_DEGREES,
    });
    const mainFieldOfViewDegrees =
      level.desktopFieldOfViewDegrees ?? world.camera.fov;
    world.camera.fov =
      tutorialPreset?.desktopFieldOfViewDegrees ?? mainFieldOfViewDegrees;
    world.renderer.setClearColor(presentation.backgroundColor);
    world.camera.far = presentation.viewDistance;
    world.camera.updateProjectionMatrix();

    const composition = await composeLevel({
      world,
      level,
      assets,
      forShow: request.kind === "show",
      tutorial: request.kind === "show" ? request.tutorial : undefined,
    });
    const { worldSurface, reach, hasGround } = composition;
    let start = composition.start;
    let trainingModules = [...composition.trainingModules];
    const mainModules = composition.modules.filter(
      (module) => !trainingModules.includes(module),
    );
    const applyM5Flight = createM5Flight(world.viewerRig);
    modules = [...composition.modules];
    for (const module of modules) {
      world.modules.load(module);
      world.modules.activate(module);
    }
    if (request.kind === "show" || (start && !benchmark))
      await world.prepareRenderer();
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
    m5 = benchmark ? undefined : createM5Runtime(request.m5ExpectedDeviceId);
    // Standalone training borrows Show's transport/narration policy without a main show.
    if (!benchmark && (request.kind === "show" || start)) {
      if (request.kind === "show" || tutorialPreset?.startAudio)
        audio = await createSpatialAudio(world.camera, signal);
      signal.throwIfAborted();
      if (tutorialPreset?.startAudio && audio)
        trainingAudio = await createTrainingAudio(
          tutorialPreset.startAudio,
          audio,
          signal,
        );
      show = await createShowRuntime(
        request.kind === "show"
          ? request.show
          : {
              schedule: PIECE_SCHEDULE,
              states: SHOW_LEVEL_STATES,
              language: request.language ?? "en",
            },
        world,
        reach,
        worldSurface,
        audio,
        request.kind === "static",
        start && tutorialPreset?.start
          ? {
              start,
              parameters: tutorialPreset.start,
              recordings: tutorialPreset.startNarration,
              finish: finishTraining,
            }
          : undefined,
      );
      if (start && tutorialPreset?.start) {
        if (request.kind === "show")
          for (const module of mainModules) world.modules.deactivate(module);
        world.renderer.setClearColor(tutorialPreset.backgroundColor);
        world.camera.far = tutorialPreset.viewDistance;
        world.camera.updateProjectionMatrix();
      }
    }
    const staticMaximumGroundClearanceMeters =
      request.kind === "static"
        ? request.preset.maximumGroundClearanceMeters
        : undefined;
    const heightLimits = {
      minimumGroundClearanceMeters: hasGround
        ? FLIGHT_SETTINGS.minimumGroundClearanceMeters
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
      show: request.kind === "show" ? show?.running : undefined,
      training: request.kind === "static" ? show?.running : undefined,
      resetFlight,
      resetShowAndFlight,
      renderCounters: world.renderCounters,
      m5,
      xr: world.xr,
    };

    function resetShowAndFlight(): void {
      if (signal.aborted) return;
      resetFlight();
      if (start) {
        show?.running.resetTime();
        return;
      }
      if (!tutorialPreset?.start || !show) {
        show?.running.resetTime();
        return;
      }
      show.setPreparationState("loading");
      try {
        for (const module of mainModules)
          runningWorld.modules.deactivate(module);
        const training = composeTraining(
          tutorialPreset,
          runningWorld,
          request.kind === "show",
        );
        if (!training) throw new Error("Training composition is unavailable");
        start = training.start;
        trainingModules = training.modules;
        modules.push(...trainingModules);
        show.setTutorial({
          start,
          parameters: tutorialPreset.start,
          recordings: tutorialPreset.startNarration,
          finish: finishTraining,
        });
        for (const module of trainingModules) {
          runningWorld.modules.load(module);
          runningWorld.modules.activate(module);
        }
        runningWorld.renderer.setClearColor(tutorialPreset.backgroundColor);
        runningWorld.camera.fov =
          tutorialPreset.desktopFieldOfViewDegrees ?? mainFieldOfViewDegrees;
        runningWorld.camera.far = tutorialPreset.viewDistance;
        runningWorld.camera.updateProjectionMatrix();
        const preparation = new AbortController();
        trainingPreparation = preparation;
        const pendingStart = start;
        const isCurrentPreparation = (): boolean =>
          !signal.aborted &&
          !preparation.signal.aborted &&
          trainingPreparation === preparation &&
          start === pendingStart;
        trainingLoading = (async () => {
          try {
            await runningWorld.prepareRenderer();
            if (!isCurrentPreparation()) return;
            const created =
              tutorialPreset.startAudio && audio
                ? await createTrainingAudio(
                    tutorialPreset.startAudio,
                    audio,
                    AbortSignal.any([signal, preparation.signal]),
                  )
                : undefined;
            if (!isCurrentPreparation()) {
              created?.unload();
              return;
            }
            trainingAudio = created;
            show?.setPreparationState("ready");
          } catch (error) {
            if (isCurrentPreparation()) throw failTraining(error);
          }
        })();
        void trainingLoading.catch(() => undefined);
      } catch (error) {
        failTraining(error);
      }
    }

    function failTraining(error: unknown): unknown {
      const errors = [error];
      // Show must release its references before Run disposes the failed children.
      try {
        show?.setPreparationState("failed");
      } catch (cleanupError) {
        errors.push(cleanupError);
      }
      try {
        unloadTraining();
      } catch (cleanupError) {
        errors.push(cleanupError);
      }
      const failure =
        errors.length === 1
          ? error
          : new AggregateError(errors, "Training restart and cleanup failed");
      console.error("Training restart failed", failure);
      return failure;
    }

    function finishTraining(): void {
      unloadTraining();
      runningWorld.camera.fov = mainFieldOfViewDegrees;
      runningWorld.camera.updateProjectionMatrix();
      for (const module of mainModules) runningWorld.modules.activate(module);
      resetFlight();
    }

    function unloadTraining(): void {
      trainingPreparation?.abort();
      trainingPreparation = undefined;
      const releasingAudio = trainingAudio;
      trainingAudio = undefined;
      const releasingModules = trainingModules;
      trainingModules = [];
      modules = modules.filter((module) => !releasingModules.includes(module));
      start = undefined;
      const errors: unknown[] = [];
      try {
        releasingAudio?.unload();
      } catch (error) {
        errors.push(error);
      }
      for (const module of [...releasingModules].reverse()) {
        try {
          runningWorld.modules.unload(module);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(errors, "Training cleanup failed");
    }

    function resetFlight(): void {
      start?.reset();
      resetFlightPose(
        runningWorld.viewerRig.position,
        runningWorld.viewerRig.quaternion,
      );
    }

    function updateFrame(deltaSeconds: number): void {
      request.onFrame?.(deltaSeconds);
      if (benchmark) {
        benchmark.placeViewer(runningWorld.viewerRig);
      } else {
        const controlFrame = m5?.consumeFrame();
        if (!show?.running.readTutorial() || show.running.sample().isPlaying) {
          if (controlFrame) applyM5Flight(controlFrame, deltaSeconds);
          else desktop?.update(deltaSeconds);
        }
      }

      show?.update();
      audio?.update();
      if (start && trainingAudio)
        trainingAudio.update(
          start.readObservation(),
          show?.running.sample().isPlaying ?? true,
          show?.readSpeechActive() ?? false,
        );
      // Training has the same white-space limits as standalone Start. The
      // prepared main terrain must not invisibly block its spatial goals.
      heightLimits.minimumGroundClearanceMeters =
        !start && hasGround
          ? FLIGHT_SETTINGS.minimumGroundClearanceMeters
          : undefined;
      heightLimits.maximumGroundClearanceMeters = start
        ? tutorialPreset?.maximumGroundClearanceMeters
        : request.kind === "show" && show
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
    lifetime.abort();
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
      trainingPreparation?.abort();
      try {
        await trainingLoading;
      } catch (error) {
        errors.push(error);
      }
      try {
        trainingAudio?.unload();
      } catch (error) {
        errors.push(error);
      }
      trainingAudio = undefined;
      try {
        await audio?.unload();
      } catch (error) {
        errors.push(error);
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
