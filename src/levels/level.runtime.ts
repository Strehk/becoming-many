/**
 * Purpose: Turn one declarative level preset into a running world.
 * Context: The browser entry selects a level without knowing concrete runtime resources.
 * Responsibility: Apply startup presentation, coordinate lifecycle, connect controls, and update one running level.
 * Boundary: Authored data and concrete world composition live in dedicated level files.
 */

import type { BenchmarkRun } from "../benchmark/benchmark-run";
import { showLevelStateAt } from "../dramaturgy/show-levels";
import type { M5Runtime } from "../m5/m5-contract";
import type { VoicePlayback } from "../sound/playback";
import type { SpatialAudio } from "../sound/spatial-audio";
import { disposeGltfAssets } from "../utils/asset-loader/gltf-assets";
import type { WorldModule } from "../world/module-runtime";
import type {
  GraphicsInfo,
  RenderCounters,
  World,
  WorldViewport,
} from "../world/world-contract";
import {
  type ComposedLevel,
  composeControls,
  composeLevel,
  composePlayback,
  composeWorld,
  type LoadedLevelAssets,
  loadLevelAssets,
} from "./level-composition";
import type { LevelPreset } from "./level-preset";
import type { LevelStartRequest, Run } from "./run-contract";
import type { RunningShow, ShowRuntime } from "./show-contract";

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
  private readonly benchmark: BenchmarkRun | undefined;
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
  private readonly heightLimits = {
    minimumGroundClearanceMeters: undefined as number | undefined,
    maximumGroundClearanceMeters: undefined as number | undefined,
  };
  get m5(): M5Runtime | undefined {
    return this.controls?.m5;
  }

  constructor(private readonly request: LevelStartRequest) {
    this.level = request.preset;
    this.benchmark = request.kind === "static" ? request.benchmark : undefined;
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
    this.world = composeWorld(surface, this.benchmark);
    const fieldOfViewDegrees =
      this.level.desktopFieldOfViewDegrees ?? this.world.camera.fov;
    this.present(presentation, fieldOfViewDegrees);
    await this.loadComposition();
    this.signal.throwIfAborted();
    this.controls = composeControls(
      this.world,
      this.benchmark,
      this.worldSurface,
    );
    if (this.request.kind === "show") await this.startPlayback();
    this.signal.throwIfAborted();
    this.signal.addEventListener("abort", this.onAbort, { once: true });
    this.world.start(this.updateFrame);
  }

  /** Reset the existing visit; replacement/calibration remains a separate operation. */
  readonly resetShowAndFlight = (): void => {
    if (this.signal.aborted) return;
    this.controls?.resetRig();
    this.playback?.running.resetTime();
  };

  readonly resetFlight = (): void => {
    this.controls?.resetRig();
  };

  readonly unload = (): Promise<void> => {
    if (this.unloading) return this.unloading;
    this.signal.removeEventListener("abort", this.onAbort);
    this.lifetime.abort();
    this.unloading = this.endChildren();
    return this.unloading;
  };

  private async loadComposition(): Promise<void> {
    if (!this.assets) throw new Error("Level assets are unavailable");
    const composition = await composeLevel({
      world: this.world,
      level: this.level,
      assets: this.assets,
      forShow: this.request.kind === "show",
    });
    this.voice = composition.voice;
    this.modules = [...composition.modules];
    this.worldSurface = composition.worldSurface;
    this.reach = composition.reach;
    this.hasGround = composition.hasGround;
    for (const module of composition.modules) {
      this.world.modules.load(module);
      this.world.modules.activate(module);
    }
    if (this.request.kind === "show") await this.world.prepareRenderer();
  }

  private async startPlayback(): Promise<void> {
    if (this.request.kind !== "show") return;
    const sound = await composePlayback(this.request.show, {
      signal: this.signal,
      world: this.world,
      reach: this.reach,
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
    this.request.onFrame?.(deltaSeconds);
    this.updateFlight(deltaSeconds);
    this.playback?.update();
    this.audio?.update();
    this.updateHeightLimits();
  };

  private updateFlight(deltaSeconds: number): void {
    if (this.benchmark) {
      this.benchmark.placeViewer(this.world.viewerRig);
      return;
    }
    this.controls?.flight.update(
      deltaSeconds,
      this.request.kind === "static"
        ? this.level.flightSpeedMetersPerSecond
        : undefined,
    );
  }

  private updateHeightLimits(): void {
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
      () => this.voice?.unload(),
      () => this.audio?.unload(),
      ...[...this.modules]
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
