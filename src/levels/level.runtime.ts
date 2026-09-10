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
  type ComposedLevel,
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
  type ShowTutorial,
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
   * Reset the rig and retained training practice/audio, without rewinding Show.
   * The visitor's local head pose remains owned by pointer look or the headset.
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
  const run = new LevelRun(request);
  try {
    await run.start(surface);
    return run;
  } catch (error) {
    try {
      await run.unload();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Level startup and cleanup failed",
      );
    }
    throw error;
  }
}

/** One Run owns its children; Composition constructs and Show decides playback. */
class LevelRun {
  private readonly lifetime = new AbortController();
  private readonly signal: AbortSignal;
  private readonly level: LevelPreset;
  private readonly tutorialPreset: LevelPreset | undefined;
  private readonly benchmark: BenchmarkRun | undefined;
  private assets: LoadedLevelAssets | undefined;
  private world!: ReturnType<typeof createWorld>;
  private worldSurface!: ComposedLevel["worldSurface"];
  private reach!: ComposedLevel["reach"];
  private hasGround = false;
  private trainingModules: WorldModule[] = [];
  private mainModules: WorldModule[] = [];
  private startContent: ComposedLevel["start"];
  private audio: SpatialAudio | undefined;
  private trainingAudio: TrainingAudio | undefined;
  private retiringTrainingAudio: TrainingAudio | undefined;
  private audioRelease: Promise<void> | undefined;
  private resolveAudioRelease: (() => void) | undefined;
  private trainingPreparation: AbortController | undefined;
  private trainingLoading: Promise<void> | undefined;
  private desktop: ReturnType<typeof createDesktopControls> | undefined;
  private applyM5Flight!: ReturnType<typeof createM5Flight>;
  private playback: ShowRuntime | undefined;
  private unloading: Promise<void> | undefined;
  private mainFieldOfViewDegrees = 0;
  private readonly heightLimits = {
    minimumGroundClearanceMeters: undefined as number | undefined,
    maximumGroundClearanceMeters: undefined as number | undefined,
  };
  m5: M5Runtime | undefined;

  constructor(private readonly request: LevelStartRequest) {
    this.level = request.preset;
    this.benchmark = request.kind === "static" ? request.benchmark : undefined;
    this.tutorialPreset =
      request.kind === "show"
        ? request.tutorial
        : this.level.start
          ? this.level
          : undefined;
    this.signal = request.signal
      ? AbortSignal.any([request.signal, this.lifetime.signal])
      : this.lifetime.signal;
  }

  get renderCounters(): RenderCounters {
    return this.world.renderCounters;
  }
  get xr(): Run["xr"] {
    return this.world.xr;
  }
  get show(): RunningShow | undefined {
    return this.request.kind === "show" ? this.playback?.running : undefined;
  }
  get training(): RunningShow | undefined {
    return this.request.kind === "static" ? this.playback?.running : undefined;
  }
  readonly readGraphicsInfo = (): GraphicsInfo => this.world.readGraphicsInfo();

  async start(surface: WorldViewport): Promise<void> {
    this.signal.throwIfAborted();
    const presentation = initialLevelPresentation(this.request);
    this.assets = await loadLevelAssets(
      this.level,
      this.request.kind === "show",
      this.signal,
    );
    this.signal.throwIfAborted();
    this.world = createWorld(surface, {
      frameControl: this.benchmark,
      viewPitchAssistDegrees: VIEW_PITCH_ASSIST_DEGREES,
    });
    this.mainFieldOfViewDegrees =
      this.level.desktopFieldOfViewDegrees ?? this.world.camera.fov;
    this.present(
      presentation,
      this.tutorialPreset?.desktopFieldOfViewDegrees ??
        this.mainFieldOfViewDegrees,
    );
    const setRoomPresence = await this.loadComposition();
    this.signal.throwIfAborted();
    this.connectControls();
    if (!this.benchmark && (this.request.kind === "show" || this.startContent))
      await this.startPlayback(setRoomPresence);
    this.signal.throwIfAborted();
    this.signal.addEventListener("abort", this.onAbort, { once: true });
    this.world.start(this.updateFrame);
  }

  /** Reset the existing visit; replacement/calibration remains a separate operation. */
  readonly resetShowAndFlight = (): void => {
    if (this.signal.aborted) return;
    this.resetRig();
    this.trainingAudio?.reset();
    if (this.startContent || !this.tutorialPreset?.start || !this.playback) {
      this.playback?.running.resetTime();
      return;
    }
    this.playback.setPreparationState("loading");
    try {
      this.recreateTraining();
      const preparation = new AbortController();
      this.trainingPreparation = preparation;
      this.trainingLoading = this.prepareTraining(preparation);
      void this.trainingLoading.catch(() => undefined);
    } catch (error) {
      this.failTraining(error);
    }
  };

  readonly resetFlight = (): void => {
    this.trainingAudio?.reset();
    this.resetPractice();
    this.resetRig();
  };

  readonly unload = (): Promise<void> => {
    if (this.unloading) return this.unloading;
    this.signal.removeEventListener("abort", this.onAbort);
    this.lifetime.abort();
    this.unloading = this.endChildren();
    return this.unloading;
  };

  private async loadComposition(): Promise<
    ComposedLevel["setTrainingRoomPresence"]
  > {
    if (!this.assets) throw new Error("Level assets are unavailable");
    const composition = await composeLevel({
      world: this.world,
      level: this.level,
      assets: this.assets,
      forShow: this.request.kind === "show",
      tutorial:
        this.request.kind === "show" ? this.request.tutorial : undefined,
    });
    this.startContent = composition.start;
    this.trainingModules = [...composition.trainingModules];
    this.mainModules = composition.modules.filter(
      (module) => !this.trainingModules.includes(module),
    );
    this.worldSurface = composition.worldSurface;
    this.reach = composition.reach;
    this.hasGround = composition.hasGround;
    if (this.benchmark) composition.setTrainingRoomPresence?.(1);
    for (const module of composition.modules) {
      this.world.modules.load(module);
      this.world.modules.activate(module);
    }
    if (this.request.kind === "show" || (this.startContent && !this.benchmark))
      await this.world.prepareRenderer();
    return composition.setTrainingRoomPresence;
  }

  private connectControls(): void {
    this.applyM5Flight = createM5Flight(this.world.viewerRig);
    if (this.benchmark) return;
    this.desktop = createDesktopControls(
      this.world.camera,
      this.world.viewerRig,
      this.world.renderer.domElement,
    );
    this.m5 = createM5Runtime();
  }

  private async preparePlaybackAudio(): Promise<void> {
    const preset = this.tutorialPreset;
    if (
      this.request.kind === "show" ||
      preset?.startAudio ||
      preset?.start?.windStrength
    )
      this.audio = await createSpatialAudio(this.world.camera, this.signal);
    this.signal.throwIfAborted();
    if (preset?.startAudio && this.audio)
      this.trainingAudio = await createTrainingAudio(
        preset.startAudio,
        this.audio,
        this.signal,
      );
  }

  private async startPlayback(
    setRoomPresence?: (presence: number) => void,
  ): Promise<void> {
    await this.preparePlaybackAudio();
    const preset = this.tutorialPreset;
    const request =
      this.request.kind === "show"
        ? this.request.show
        : {
            schedule: PIECE_SCHEDULE,
            states: SHOW_LEVEL_STATES,
            language: this.request.language ?? "en",
          };
    this.playback = await createShowRuntime(request, {
      world: this.world,
      reach: this.reach,
      worldSurface: this.worldSurface,
      audio: this.audio,
      standalone: this.request.kind === "static",
      tutorial: this.tutorialDefinition(setRoomPresence),
    });
    if (!this.startContent || !preset?.start) return;
    if (this.request.kind === "show") this.setMainActive(false);
    this.present(preset, this.world.camera.fov);
  }

  private tutorialDefinition(
    setRoomPresence?: (presence: number) => void,
  ): ShowTutorial | undefined {
    if (!this.startContent || !this.tutorialPreset?.start) return undefined;
    return {
      start: this.startContent,
      setRoomPresence,
      parameters: this.tutorialPreset.start,
      recordings: this.tutorialPreset.startNarration,
      reset: this.resetPractice,
      finish: this.finishTraining,
    };
  }

  private recreateTraining(): void {
    const preset = this.tutorialPreset;
    if (!preset?.start || !this.playback) return;
    this.setMainActive(false);
    const training = composeTraining(
      preset,
      this.world,
      this.worldSurface.groundYAt,
    );
    if (!training) throw new Error("Training composition is unavailable");
    this.startContent = training.start;
    this.trainingModules = training.modules;
    const tutorial = this.tutorialDefinition(training.setRoomPresence);
    if (tutorial) this.playback.setTutorial(tutorial);
    for (const module of training.modules) {
      this.world.modules.load(module);
      this.world.modules.activate(module);
    }
    this.present(
      preset,
      preset.desktopFieldOfViewDegrees ?? this.mainFieldOfViewDegrees,
    );
  }

  private async prepareTraining(preparation: AbortController): Promise<void> {
    try {
      await this.world.prepareRenderer();
      if (!this.isCurrentPreparation(preparation)) return;
      await this.audioRelease;
      if (!this.isCurrentPreparation(preparation)) return;
      const parameters = this.tutorialPreset?.startAudio;
      const created =
        parameters && this.audio
          ? await createTrainingAudio(
              parameters,
              this.audio,
              AbortSignal.any([this.signal, preparation.signal]),
            )
          : undefined;
      if (!this.isCurrentPreparation(preparation)) {
        created?.unload();
        return;
      }
      this.trainingAudio = created;
      this.playback?.setPreparationState("ready");
    } catch (error) {
      if (this.isCurrentPreparation(preparation))
        throw this.failTraining(error);
    }
  }

  private isCurrentPreparation(preparation: AbortController): boolean {
    return (
      !this.signal.aborted &&
      !preparation.signal.aborted &&
      this.trainingPreparation === preparation
    );
  }

  private failTraining(error: unknown): unknown {
    const errors = [error];
    for (const release of [
      () => this.playback?.setPreparationState("failed"),
      () => this.unloadTraining(),
    ]) {
      try {
        release();
      } catch (failure) {
        errors.push(failure);
      }
    }
    const failure =
      errors.length === 1
        ? error
        : new AggregateError(errors, "Training restart and cleanup failed");
    console.error("Training restart failed", failure);
    return failure;
  }

  private readonly finishTraining = (): void => {
    if (this.trainingAudio) {
      this.retiringTrainingAudio = this.trainingAudio;
      this.trainingAudio = undefined;
      this.retiringTrainingAudio.beginRelease();
      this.audioRelease = new Promise<void>((resolve) => {
        this.resolveAudioRelease = resolve;
      });
    }
    this.unloadTraining();
    this.world.camera.fov = this.mainFieldOfViewDegrees;
    this.world.camera.updateProjectionMatrix();
    this.setMainActive(true);
    this.resetRig();
  };

  private unloadTraining(): void {
    this.trainingPreparation?.abort();
    this.trainingPreparation = undefined;
    const audio = this.trainingAudio;
    this.trainingAudio = undefined;
    const modules = this.trainingModules;
    this.trainingModules = [];
    this.startContent = undefined;
    const errors: unknown[] = [];
    const operations = [
      () => audio?.unload(),
      ...[...modules]
        .reverse()
        .map((module) => () => this.world.modules.unload(module)),
    ];
    for (const release of operations) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Training cleanup failed");
  }

  private readonly resetPractice = (): void => {
    this.startContent?.resetPractice();
  };
  private resetRig(): void {
    resetFlightPose(
      this.world.viewerRig.position,
      this.world.viewerRig.quaternion,
    );
  }

  private present(
    presentation: LevelPresentation,
    fieldOfViewDegrees: number,
  ): void {
    this.world.renderer.setClearColor(presentation.backgroundColor);
    this.world.camera.fov = fieldOfViewDegrees;
    this.world.camera.far = presentation.viewDistance;
    this.world.camera.updateProjectionMatrix();
  }

  private setMainActive(active: boolean): void {
    for (const module of this.mainModules) {
      if (active) this.world.modules.activate(module);
      else this.world.modules.deactivate(module);
    }
  }

  private readonly updateFrame = (deltaSeconds: number): void => {
    this.request.onFrame?.(deltaSeconds);
    this.updateFlight(deltaSeconds);
    this.playback?.update();
    this.audio?.update();
    const playing = this.playback?.running.sample().isPlaying ?? true;
    if (this.retiringTrainingAudio?.updateRelease(playing))
      this.finishAudioRelease();
    if (this.startContent && this.trainingAudio)
      this.trainingAudio.update(
        this.startContent.readObservation(),
        playing,
        this.playback?.readSpeechActive() ?? false,
      );
    this.updateHeightLimits();
  };

  private updateFlight(deltaSeconds: number): void {
    if (this.benchmark) {
      this.benchmark.placeViewer(this.world.viewerRig);
      return;
    }
    const controlFrame = this.m5?.consumeFrame();
    if (
      this.playback?.running.readTutorial() &&
      !this.playback.running.sample().isPlaying
    )
      return;
    const speed = this.startContent
      ? this.tutorialPreset?.flightSpeedMetersPerSecond
      : undefined;
    if (controlFrame) this.applyM5Flight(controlFrame, deltaSeconds, speed);
    else this.desktop?.update(deltaSeconds, speed);
  }

  private updateHeightLimits(): void {
    this.heightLimits.minimumGroundClearanceMeters =
      !this.startContent && this.hasGround
        ? FLIGHT_SETTINGS.minimumGroundClearanceMeters
        : undefined;
    this.heightLimits.maximumGroundClearanceMeters = this.startContent
      ? this.tutorialPreset?.maximumGroundClearanceMeters
      : this.request.kind === "show" && this.playback
        ? this.playback.readActiveLevelState().maximumGroundClearanceMeters
        : this.request.kind === "static"
          ? this.level.maximumGroundClearanceMeters
          : undefined;
    if (
      this.heightLimits.minimumGroundClearanceMeters !== undefined ||
      this.heightLimits.maximumGroundClearanceMeters !== undefined
    )
      keepFlightWithinHeightLimits(
        this.world.viewerRig.position,
        this.worldSurface.groundYAt,
        this.heightLimits,
      );
  }

  private finishAudioRelease(): void {
    const retired = this.retiringTrainingAudio;
    this.retiringTrainingAudio = undefined;
    try {
      retired?.unload();
    } finally {
      this.resolveAudioRelease?.();
      this.resolveAudioRelease = undefined;
      this.audioRelease = undefined;
    }
  }

  private readonly onAbort = (): void => {
    void this.unload().catch((error: unknown) =>
      console.error("Level cleanup failed", error),
    );
  };

  private async endChildren(): Promise<void> {
    const owners = [this.desktop, this.m5, this.playback];
    const results = await Promise.allSettled([
      (async () => this.world?.stop())(),
      ...owners.map(async (owner) => {
        await owner?.unload();
      }),
    ]);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    this.trainingPreparation?.abort();
    for (const release of this.remainingReleases()) {
      try {
        await release();
      } catch (error) {
        errors.push(error);
      }
    }
    this.trainingAudio = undefined;
    if (errors.length) throw new AggregateError(errors, "Level cleanup failed");
  }

  private remainingReleases(): (() => unknown)[] {
    const assets = this.assets;
    const sources = assets
      ? [
          assets.vegetation,
          assets.rocks,
          assets.animals,
          assets.passages?.models,
        ]
      : [];
    return [
      () => this.finishAudioRelease(),
      () => this.trainingLoading,
      () => this.trainingAudio?.unload(),
      () => this.audio?.unload(),
      ...[...this.mainModules, ...this.trainingModules]
        .reverse()
        .map((module) => () => this.world?.modules.unload(module)),
      ...sources.map((batch) => () => {
        if (batch) disposeGltfAssets(batch);
      }),
      () => this.world?.unload(),
    ];
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
