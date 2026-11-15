/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Apply startup presentation, coordinate lifecycle, connect controls, and update one running level.
 * Boundary: Authored data and concrete world composition live in dedicated level files.
 */

import { Group } from "three";
import type { PassageSchedule } from "../dramaturgy/passage-schedule";
import { showLevelStateAt } from "../dramaturgy/show-levels";
import type { M5Runtime } from "../m5/m5-contract";
import type { VoicePlayback } from "../sound/playback";
import type { SpatialAudio } from "../sound/spatial-audio";
import { disposeGltfAssets } from "../utils/asset-loader/gltf-assets";
import type { WorldModule } from "../world/module-runtime";
import type { World, WorldViewport } from "../world/world-contract";
import { HANDOFF_SETTINGS } from "./handoff-settings";
import {
  type ComposedLevel,
  composeControls,
  composeLevel,
  composePlayback,
  composeVeil,
  composeWorld,
  type LoadedLevelAssets,
  loadLevelAssets,
} from "./level-composition";
import type { LevelPreset } from "./level-preset";
import type { LevelStartRequest, Run, RunPreferences } from "./run-contract";
import type { RunningShow, ShowRuntime } from "./show-contract";

/** How long the hidden ground takes to grow back in after a prelude. */
const GROUND_GROW_IN_SECONDS = 8;

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
  private assets: LoadedLevelAssets | undefined;
  private world!: World;
  private worldSurface!: ComposedLevel["worldSurface"];
  private reach!: ComposedLevel["reach"];
  private hasGround = false;
  private modules: WorldModule[] = [];
  private audio: SpatialAudio | undefined;
  private voice: VoicePlayback | undefined;
  private controls: ReturnType<typeof composeControls> | undefined;
  private playback: ShowRuntime | undefined;
  private unloading: Promise<void> | undefined;
  private tutorial: ComposedLevel | undefined;
  private tutorialRestart: Promise<void> | undefined;
  private tutorialHeld: boolean;
  private tutorialFailed = false;
  private tutorialChunkCount = 0;
  private staticTutorial: ComposedLevel["tutorial"];
  private skipTarget: { timeSeconds: number; playing: boolean } | undefined;
  private tutorialAssets: LoadedLevelAssets | undefined;
  private handoffElapsed: number | undefined;
  private mainFieldOfViewDegrees = 0;
  private veil: ReturnType<typeof composeVeil> | undefined;
  /** A page's overlay objects and per-frame hooks (the web start menu). */
  private readonly overlay = new Group();
  private readonly frameHooks = new Set<(deltaSeconds: number) => void>();
  /** True until the first Play when a page plays a prelude in front. */
  private preludeActive = false;
  private preludeGlide = 0;
  /** The hidden ground under the air: absent in a prelude, grows in on Play. */
  private groundPresence = 1;
  private groundModules: readonly WorldModule[] = [];
  private setAirParticleShape:
    | ((shape: "square" | "circle") => void)
    | undefined;
  /** Absent until a page sets them; the Run then leaves every part as authored. */
  private preferences: RunPreferences | undefined;
  /** 1 is white, 0 is the world; it falls only while playback runs. */
  private veilPresence = 1;
  private readonly showListeners = new Set<
    (show: RunningShow | undefined) => void
  >();
  private readonly heightLimits = {
    minimumGroundClearanceMeters: undefined as number | undefined,
    maximumGroundClearanceMeters: undefined as number | undefined,
  };
  get m5(): M5Runtime | undefined {
    return this.controls?.m5;
  }

  constructor(private readonly request: LevelStartRequest) {
    this.level = request.preset;
    if (request.kind === "show" && request.prelude) {
      this.preludeActive = true;
      this.groundPresence = 0;
      this.preludeGlide = request.prelude.glideMetersPerSecond;
    }
    this.tutorialHeld =
      request.kind === "show" && request.initiallyPaused === true;
    this.signal = request.signal
      ? AbortSignal.any([request.signal, this.lifetime.signal])
      : this.lifetime.signal;
  }

  get stage(): Run["stage"] {
    // The overlay joins the scene only when a page asks for the stage.
    if (!this.overlay.parent && !this.signal.aborted) {
      this.overlay.name = "page-overlay";
      this.world.scene.add(this.overlay);
    }
    return {
      scene: this.world.scene,
      camera: this.world.camera,
      renderer: this.world.renderer,
      overlay: this.overlay,
      groundYAt: (worldX, worldZ) =>
        this.worldSurface?.groundYAt(worldX, worldZ) ?? 0,
      onFrame: (hook) => {
        this.frameHooks.add(hook);
        return () => {
          this.frameHooks.delete(hook);
        };
      },
    };
  }

  private readonly readGroundPresence = (): number => this.groundPresence;

  readonly setPreludeGlide: Run["setPreludeGlide"] = (metersPerSecond) => {
    if (Number.isFinite(metersPerSecond))
      this.preludeGlide = Math.max(0, metersPerSecond);
  };

  get xr(): Run["xr"] {
    return this.world.xr;
  }
  get show(): RunningShow | undefined {
    return !this.signal.aborted &&
      !this.tutorial &&
      !this.tutorialRestart &&
      !this.tutorialFailed &&
      this.request.kind === "show"
      ? this.playback?.running
      : undefined;
  }

  async start(surface: WorldViewport): Promise<void> {
    this.signal.throwIfAborted();
    const presentation = initialLevelPresentation(this.request);
    this.assets = await loadLevelAssets(
      this.level,
      this.requestedPassages(),
      this.signal,
    );
    this.signal.throwIfAborted();
    this.world = composeWorld(surface);
    const fieldOfViewDegrees =
      this.level.desktopFieldOfViewDegrees ?? this.world.camera.fov;
    this.mainFieldOfViewDegrees = fieldOfViewDegrees;
    this.present(presentation, fieldOfViewDegrees);
    this.raiseVeil();
    // A prelude shows the first world at once; the page fades its canvas in.
    if (this.preludeActive) {
      this.veilPresence = 0;
      this.veil?.setPresence(0);
    }
    await this.loadComposition();
    this.signal.throwIfAborted();
    const preludeInput =
      this.request.kind === "show" ? this.request.prelude?.input : undefined;
    this.controls = composeControls(
      this.world,
      this.worldSurface,
      preludeInput ? [preludeInput] : [],
    );
    if (this.request.kind === "show") {
      await this.startPlayback();
      await this.startTutorial();
      if (!this.request.tutorial) this.openShowWithoutTutorial();
    }
    this.signal.throwIfAborted();
    this.applyPreferences();
    this.signal.addEventListener("abort", this.onAbort, { once: true });
    this.world.start(this.updateFrame);
  }

  readonly setPreferences: Run["setPreferences"] = (preferences) => {
    if (this.signal.aborted) return;
    const clamp = (
      value: number,
      low: number,
      high: number,
      fallback: number,
    ) =>
      Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
    this.preferences = {
      volume: clamp(preferences.volume, 0, 1, 1),
      renderScale: clamp(preferences.renderScale, 0.5, 2, 1),
      invertPitch: preferences.invertPitch === true,
      roundParticles: preferences.roundParticles === true,
      screenCredits: preferences.screenCredits === true,
    };
    this.applyPreferences();
  };

  /** Hand the current preferences to every part that exists right now. */
  private applyPreferences(): void {
    if (!this.preferences) return;
    const { volume, renderScale, invertPitch } = this.preferences;
    const renderer = this.world?.renderer;
    if (
      renderer &&
      !renderer.xr.isPresenting &&
      renderer.getPixelRatio() !== renderScale
    )
      renderer.setPixelRatio(renderScale);
    this.voice?.setVolume(volume);
    const destination = this.audio?.context.destination;
    if (destination)
      destination.volume.rampTo(
        volume <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(volume),
        0.1,
      );
    this.controls?.flight.setPitchInverted(invertPitch);
    this.setAirParticleShape?.(
      this.preferences.roundParticles ? "circle" : "square",
    );
  }

  readonly subscribeShow = (
    listener: (show: RunningShow | undefined) => void,
  ): (() => void) => {
    this.showListeners.add(listener);
    listener(this.show);
    return () => {
      this.showListeners.delete(listener);
    };
  };

  readonly readLanguage: Run["readLanguage"] = () => {
    if (this.signal.aborted) return undefined;
    return this.request.kind === "show"
      ? (this.playback?.running.readLanguage() ?? this.request.show.language)
      : (this.request.language ?? "en");
  };

  readonly setLanguage: Run["setLanguage"] = (language) => {
    if (this.signal.aborted || this.request.kind !== "show") return;
    this.playback?.running.setLanguage(language);
    this.tutorial?.tutorial?.refreshLanguage();
  };

  readonly readAudioState = (): AudioContextState => {
    if (this.signal.aborted) return "closed";
    return this.show?.readAudioState() ?? this.audio?.context.state ?? "closed";
  };

  readonly readTutorial: Run["readTutorial"] = () => {
    if (this.signal.aborted) return undefined;
    if ((this.tutorialRestart || this.tutorialFailed) && !this.tutorial)
      return {
        completedChunks: 0,
        totalChunks: this.tutorialChunkCount,
        phase: this.tutorialFailed ? "error" : "loading",
        playback: this.readPlayback(),
      };
    const progress = (
      this.tutorial?.tutorial ?? this.staticTutorial
    )?.readProgress();
    if (!progress) return undefined;
    return {
      ...progress,
      playback: this.readPlayback(),
      phase: this.handoffElapsed === undefined ? progress.phase : "transition",
    };
  };

  readonly readPlayback: Run["readPlayback"] = () => {
    if (this.signal.aborted) return "ended";
    if (this.tutorialFailed) return "error";
    if (this.tutorialRestart) return "loading";
    const tutorial = this.tutorial?.tutorial ?? this.staticTutorial;
    if (tutorial) return tutorial.readPlayback();
    if (this.request.kind === "static") return "playing";
    return this.show?.sample().isPlaying ? "playing" : "paused";
  };

  readonly togglePlayback = (): void => {
    if (this.signal.aborted || this.tutorialRestart) return;
    if (this.readPlayback() === "error") {
      this.resetShowAndFlight();
      return;
    }
    const tutorial = this.tutorial?.tutorial ?? this.staticTutorial;
    if (!tutorial) {
      this.show?.togglePlayback();
      return;
    }
    const status = this.readPlayback();
    this.tutorialHeld = status === "playing" || status === "buffering";
    tutorial.setPaused(this.tutorialHeld);
  };

  readonly skipTutorial: Run["skipTutorial"] = (
    timeSeconds,
    playing = true,
  ) => {
    if (this.signal.aborted || !this.tutorial || this.request.kind !== "show")
      return;
    if (!Number.isFinite(timeSeconds)) return;
    this.skipTarget = {
      timeSeconds: Math.max(
        0,
        Math.min(this.request.show.schedule.durationSeconds, timeSeconds),
      ),
      playing,
    };
    this.tutorialHeld = false;
    this.tutorial.tutorial?.setPaused(false);
    this.handoffElapsed ??= 0;
  };

  private async startTutorial(): Promise<void> {
    if (this.request.kind !== "show" || !this.request.tutorial) return;
    const level = this.request.tutorial;
    const assets = await loadLevelAssets(level, undefined, this.signal);
    this.tutorialAssets = assets;
    this.tutorial = await composeLevel({
      world: this.world,
      level,
      assets,
      forShow: false,
      signal: this.signal,
      sharedAudio: this.audio,
      readLanguage: this.readLanguage,
      language:
        this.playback?.running.readLanguage() ?? this.request.show.language,
    });
    this.activateTutorial(this.tutorial, level);
  }

  private activateTutorial(
    composition: ComposedLevel,
    level: LevelPreset,
  ): void {
    for (const module of composition.modules) this.world.modules.load(module);
    this.signal.throwIfAborted();
    if (!composition.tutorial)
      throw new Error("Tutorial preset needs a Start module");
    composition.tutorial.setPaused(this.tutorialHeld);
    this.tutorialChunkCount = composition.tutorial.readProgress().totalChunks;
    for (const module of this.modules) this.world.modules.deactivate(module);
    this.present(
      level,
      level.desktopFieldOfViewDegrees ?? this.world.camera.fov,
    );
    for (const module of composition.modules) {
      this.world.modules.activate(module);
    }
  }

  private updateHandoff(deltaSeconds: number): void {
    if (this.tutorialHeld) return;
    const tutorial = this.tutorial?.tutorial;
    if (
      !tutorial ||
      (this.handoffElapsed === undefined && !tutorial.readComplete())
    )
      return;
    this.handoffElapsed =
      (this.handoffElapsed ?? 0) + Math.max(0, deltaSeconds);
    const progress = Math.min(
      1,
      this.handoffElapsed / HANDOFF_SETTINGS.fadeSeconds,
    );
    tutorial.setPresence(1 - progress * progress * (3 - 2 * progress));
    if (progress === 1) this.finishTutorial();
  }

  private finishTutorial(): void {
    const target = this.skipTarget;
    this.releaseTutorial();
    this.placeRigAtArrival();
    this.present(
      initialLevelPresentation(this.request),
      this.mainFieldOfViewDegrees,
    );
    for (const module of this.modules) this.world.modules.activate(module);
    if (target) this.playback?.running.seekTo(target.timeSeconds);
    this.playback?.update();
    if (target?.playing !== false) this.playback?.running.play();
    else this.playback?.running.pause();
    for (const listener of this.showListeners) listener(this.show);
  }

  /** Without a handoff the Show still opens where one would have arrived. */
  private openShowWithoutTutorial(): void {
    if (this.request.kind !== "show") return;
    this.placeRigAtArrival();
    if (!this.request.initiallyPaused && !this.request.prelude)
      this.playback?.running.play();
  }

  /** Every Show opens from the origin at the same height above the terrain. */
  private placeRigAtArrival(): void {
    this.controls?.resetRig();
    this.controls?.constrainHeight({
      minimumGroundClearanceMeters: HANDOFF_SETTINGS.arrivalClearanceMeters,
      maximumGroundClearanceMeters: HANDOFF_SETTINGS.arrivalClearanceMeters,
    });
  }

  private releaseTutorial(): void {
    const tutorial = this.tutorial;
    this.tutorial = undefined;
    this.skipTarget = undefined;
    this.handoffElapsed = undefined;
    const assets = this.tutorialAssets;
    this.tutorialAssets = undefined;
    const releases = [
      ...(tutorial?.modules ?? []).map(
        (module) => () => this.world.modules.unload(module),
      ),
      () => tutorial?.voice?.unload(),
      ...assetReleases(assets),
    ];
    const errors: unknown[] = [];
    for (const release of releases) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Tutorial cleanup failed");
  }

  /** Restart training in this Run; renderer, XR, controls and shared audio survive. */
  readonly resetShowAndFlight = (): void => {
    if (this.signal.aborted || this.tutorialRestart) return;
    this.cutToWhite();
    this.tutorialHeld = true;
    this.tutorialFailed = false;
    this.controls?.resetRig();
    this.playback?.running.resetTime();
    this.playback?.update();
    if (this.request.kind !== "show") return;
    if (!this.request.tutorial) {
      this.placeRigAtArrival();
      return;
    }
    try {
      this.releaseTutorial();
    } catch (error) {
      this.tutorialFailed = true;
      console.error("Tutorial reset failed", error);
      return;
    }
    for (const module of this.modules) this.world.modules.deactivate(module);
    this.present(
      this.request.tutorial,
      this.request.tutorial.desktopFieldOfViewDegrees ??
        this.mainFieldOfViewDegrees,
    );
    const restart = this.startTutorial();
    this.tutorialRestart = restart;
    for (const listener of this.showListeners) listener(undefined);
    void this.finishRestart(restart);
  };

  private async finishRestart(restart: Promise<void>): Promise<void> {
    try {
      await restart;
    } catch (error) {
      if (this.signal.aborted) return;
      this.tutorialFailed = true;
      console.error("Tutorial restart failed", error);
      try {
        this.releaseTutorial();
      } catch (cleanupError) {
        console.error("Tutorial restart cleanup failed", cleanupError);
      }
    } finally {
      this.tutorialRestart = undefined;
    }
  }

  readonly resetFlight = (): void => {
    this.controls?.resetRig();
  };

  readonly unload = (): Promise<void> => {
    if (this.unloading) return this.unloading;
    this.signal.removeEventListener("abort", this.onAbort);
    this.lifetime.abort();
    this.showListeners.clear();
    this.unloading = this.endChildren();
    return this.unloading;
  };

  /**
   * The animals this request crosses. Only a show has them: a passage is placed
   * by show time, and a static run has no show time to place it against.
   */
  private requestedPassages(): PassageSchedule | undefined {
    return this.request.kind === "show"
      ? this.request.show.passages
      : undefined;
  }

  private async loadComposition(): Promise<void> {
    if (!this.assets) throw new Error("Level assets are unavailable");
    const composition = await composeLevel({
      world: this.world,
      level: this.level,
      assets: this.assets,
      forShow: this.request.kind === "show",
      particles: this.request.particles,
      readGroundPresence: this.readGroundPresence,
      passages: this.requestedPassages(),
      language:
        this.request.kind === "show"
          ? this.request.show.language
          : this.request.language,
      signal: this.signal,
    });
    this.staticTutorial = composition.tutorial;
    this.voice = composition.voice;
    this.audio = composition.audio;
    this.modules = [...composition.modules];
    this.worldSurface = composition.worldSurface;
    this.reach = composition.reach;
    this.hasGround = composition.hasGround;
    this.groundModules = composition.groundModules ?? [];
    this.setAirParticleShape = composition.setAirParticleShape;
    for (const module of composition.modules) {
      this.world.modules.load(module);
      // A prelude holds the drawn ground back until the piece begins.
      if (!(this.preludeActive && this.groundModules.includes(module)))
        this.world.modules.activate(module);
    }
    if (this.request.kind === "show") await this.world.prepareRenderer();
  }

  private async startPlayback(): Promise<void> {
    if (this.request.kind !== "show") return;
    const sound = await composePlayback(this.request.show, {
      signal: this.signal,
      world: this.world,
      reach: {
        ...this.reach,
        // A page that draws the credits over the screen keeps the world's
        // panel hidden, except in a headset, where no overlay is seen.
        setEndCreditsPresence: (presence) =>
          this.reach.setEndCreditsPresence?.(
            this.preferences?.screenCredits &&
              !this.world.renderer.xr.isPresenting
              ? 0
              : presence,
          ),
      },
      worldSurface: this.worldSurface,
    });
    this.audio = sound.audio;
    this.playback = sound.playback;
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

  private readonly updateFrame = (deltaSeconds: number): void => {
    if (this.signal.aborted) return;
    this.updateFlight(deltaSeconds);
    if (!this.tutorial && !this.tutorialRestart && !this.tutorialFailed)
      this.playback?.update();
    this.updateHandoff(deltaSeconds);
    this.updateVeil(deltaSeconds);
    this.audio?.update();
    this.updateHeightLimits();
    // After a prelude the ground grows back in under the air, slowly.
    if (!this.preludeActive && this.groundPresence < 1)
      this.groundPresence = Math.min(
        1,
        this.groundPresence +
          Math.max(0, deltaSeconds) / GROUND_GROW_IN_SECONDS,
      );
    if (this.frameHooks.size === 0) return;
    // Hooks place overlay objects against this frame's camera.
    this.world.camera.updateWorldMatrix(true, false);
    for (const hook of this.frameHooks) hook(deltaSeconds);
  };

  /** A Show opens in white; static levels open on their world. */
  private raiseVeil(): void {
    if (this.request.kind !== "show") return;
    this.veil = composeVeil(this.world);
    this.world.modules.load(this.veil.module);
    this.world.modules.activate(this.veil.module);
  }

  /** Stop leaves no fade: the world is gone in one frame. */
  private cutToWhite(): void {
    this.veilPresence = 1;
    this.veil?.setPresence(1);
  }

  private updateVeil(deltaSeconds: number): void {
    if (!this.veil || this.veilPresence === 0) return;
    if (this.readPlayback() !== "playing") return;
    this.veilPresence = Math.max(
      0,
      this.veilPresence -
        Math.max(0, deltaSeconds) / HANDOFF_SETTINGS.veilLiftSeconds,
    );
    const lifted = 1 - this.veilPresence;
    this.veil.setPresence(1 - lifted * lifted * (3 - 2 * lifted));
  }

  private updateFlight(deltaSeconds: number): void {
    const playing = this.readPlayback() === "playing";
    // The prelude ends with the first Play; later pauses hold flight again.
    if (playing && this.preludeActive) {
      this.preludeActive = false;
      for (const module of this.groundModules)
        this.world.modules.activate(module);
    }
    const speed =
      this.tutorialRestart ||
      (!playing && !this.preludeActive) ||
      (this.handoffElapsed !== undefined && !this.skipTarget)
        ? 0
        : playing
          ? this.flightSpeed()
          : this.preludeGlide;
    this.controls?.flight.update(
      deltaSeconds,
      speed,
      this.world.renderer.xr.isPresenting,
    );
  }

  private flightSpeed(): number | undefined {
    if (this.request.kind === "static")
      return this.level.flightSpeedMetersPerSecond;
    return this.tutorial
      ? this.request.tutorial?.flightSpeedMetersPerSecond
      : undefined;
  }

  private updateHeightLimits(): void {
    if (this.tutorial || this.tutorialRestart || this.tutorialFailed) return;
    this.heightLimits.minimumGroundClearanceMeters = this.hasGround
      ? this.controls?.minimumGroundClearanceMeters
      : undefined;
    this.heightLimits.maximumGroundClearanceMeters =
      this.request.kind === "show" && this.playback
        ? this.playback.readActiveLevelState().maximumGroundClearanceMeters
        : this.level.maximumGroundClearanceMeters;
    if (
      this.heightLimits.minimumGroundClearanceMeters !== undefined ||
      this.heightLimits.maximumGroundClearanceMeters !== undefined
    )
      this.controls?.constrainHeight(this.heightLimits);
  }

  private readonly onAbort = (): void => {
    void this.unload().catch((error: unknown) =>
      console.error("Level cleanup failed", error),
    );
  };

  private async endChildren(): Promise<void> {
    const owners = [this.controls?.desktop, this.m5, this.playback];
    const results = await Promise.allSettled([
      this.tutorialRestart?.catch(() => undefined),
      (async () => this.world?.stop())(),
      ...owners.map(async (owner) => {
        await owner?.unload();
      }),
    ]);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    for (const release of this.remainingReleases()) {
      try {
        await release();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Level cleanup failed");
  }

  private remainingReleases(): (() => unknown)[] {
    return [
      () => {
        this.frameHooks.clear();
        this.overlay.removeFromParent();
      },
      () => this.releaseTutorial(),
      () => this.voice?.unload(),
      ...[...this.modules]
        .reverse()
        .map((module) => () => this.world?.modules.unload(module)),
      () => this.veil && this.world?.modules.unload(this.veil.module),
      () => this.audio?.unload(),
      ...assetReleases(this.assets),
      () => this.world?.unload(),
    ];
  }
}

/** Return individual releases so one failing resource never skips the others. */
function assetReleases(assets: LoadedLevelAssets | undefined): (() => void)[] {
  return [
    assets?.vegetation,
    assets?.rocks,
    assets?.animals,
    assets?.birds,
    assets?.passages?.models,
  ].map((batch) => () => {
    if (batch) disposeGltfAssets(batch);
  });
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
