/**
 * Purpose: Drive one preloaded world from narration show time.
 * Context: The show changes presentation, sense strength, and module gates without rebuilding resources.
 * Responsibility: Own narration following, transitions, sense intensities, the organ's frame, and the public show controls.
 * Boundary: Level Runtime constructs modules; concrete modules and the render loop remain elsewhere.
 */

import { Color } from "three";
import { endCreditsPresenceAt } from "../dramaturgy/end-credits";
import {
  type NarrationLanguage,
  narrationDurationSeconds,
  narrationUrl,
} from "../dramaturgy/narration-catalog";
import {
  narrationCueAt,
  type ShowLevelName,
} from "../dramaturgy/narration-schedule";
import {
  ORGAN_SCORE,
  ORGAN_VOICES,
  type OrganVoiceName,
  organVoiceStrengthAt,
} from "../dramaturgy/organ-score";
import {
  createShowClock,
  type ShowClock,
  type ShowTimeSample,
} from "../dramaturgy/show-clock";
import {
  levelTransitionAt,
  SHOW_SENSES,
  type ShowLevelState,
  type ShowSense,
  senseIntensityAt,
  showLevelAt,
} from "../dramaturgy/show-levels";
import type { NarrationPlayer, NarrationRecording } from "../sound/playback";
import type {
  RunningShow,
  ShowRequest,
  ShowRuntime,
  ShowRuntimeOptions,
  ShowWorld,
} from "./show-contract";

/** Answer for a placement group nothing in this world produces. */
const NO_ACTOR_CENTERS = new Float32Array(0);

/** Validate before Composition acquires sound resources; return the first score level. */
export function validateShowRequest(request: ShowRequest): ShowLevelName {
  validateDuration(request.schedule.durationSeconds, "Show");
  const openingLevel = showLevelAt(request.schedule, 0);
  if (!openingLevel) throw new Error("A show schedule needs at least one cue");
  return openingLevel;
}

export async function createShowRuntime(
  request: ShowRequest,
  options: ShowRuntimeOptions,
): Promise<ShowRuntime> {
  const openingLevel = validateShowRequest(request);
  const show = new Show(request, options, openingLevel);
  try {
    show.prepare();
    return show;
  } catch (error) {
    try {
      await show.unload();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Show startup failed");
    }
    throw error;
  }
}

/** One Show owns score policy on the shared audio clock. */
class Show implements ShowRuntime, RunningShow {
  private clock!: ShowClock;
  private readonly targetBackground = new Color();
  private readonly liveBackground = new Color(0xffffff);
  private readonly listenerPose = {
    x: 0,
    y: 0,
    z: 0,
    yawRadians: 0,
    pitchRadians: 0,
  };
  private readonly voiceStrengths: Record<OrganVoiceName, number> = {
    wind: 0,
    choir: 0,
    sonar: 0,
    birdWingBeat: 0,
    insectWingBeat: 0,
    bassLoop: 0,
    pressureWave: 0,
    polyRhythm: 0,
    hiHat: 0,
  };
  private language: NarrationLanguage;
  private narration: NarrationPlayer | undefined;

  private unloading: Promise<void> | undefined;
  private activeLevel: ShowLevelName | undefined;

  constructor(
    private readonly request: ShowRequest,
    private readonly options: ShowRuntimeOptions,
    private readonly openingLevel: ShowLevelName,
  ) {
    this.language = request.language;
  }

  prepare(): void {
    this.clock = createShowClock(
      this.request.schedule.durationSeconds,
      this.options.timebase.readSeconds,
    );
    this.prepareNarration();
    this.followWorld(0);
  }

  readonly unload = (): Promise<void> => {
    this.clock?.pause();
    this.unloading ??= this.releaseAudio();
    return this.unloading;
  };

  private async releaseAudio(): Promise<void> {
    const results = await Promise.allSettled([
      Promise.resolve().then(() => this.narration?.unload()),
      this.options.droneOrgan?.unload(),
      this.options.timebase.unload(),
    ]);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (errors.length) throw new AggregateError(errors, "Show cleanup failed");
  }

  private prepareNarration(): void {
    const recordings: NarrationRecording[] =
      this.request.schedule.narration.map(({ cueId }) => ({
        cueId,
        url: narrationUrl(cueId, this.language),
        durationSeconds: narrationDurationSeconds(cueId, this.language),
      }));
    this.narration ??= this.options.createNarration();
    this.narration.setRecordings(recordings);
  }

  private followBackground(seconds: number): void {
    const transition = levelTransitionAt(this.request.schedule, seconds);
    if (!transition) return;
    this.targetBackground.setHex(
      this.request.states[transition.to].backgroundColor,
    );
    this.liveBackground
      .setHex(this.request.states[transition.from].backgroundColor)
      .lerp(this.targetBackground, transition.progress);
    const { world, reach } = this.options;
    world.renderer.setClearColor(this.liveBackground);
    reach.worldFades.structure?.setBackground(this.liveBackground);
    reach.worldFades.animals?.setBackground(this.liveBackground);
    reach.setSkyBackground?.(this.liveBackground);
  }

  private setSense(sense: ShowSense, intensity: number): void {
    const { reach, world } = this.options;
    reach.senses[sense]?.(intensity);
    for (const module of reach.gates.get(sense) ?? []) {
      if (intensity > 0) world.modules.activate(module);
      else world.modules.deactivate(module);
    }
    if (sense === "echo") reach.worldFades.structure?.setPresence(intensity);
    if (sense === "thermal") reach.worldFades.animals?.setPresence(intensity);
  }

  private followWorld(seconds: number): void {
    const level = showLevelAt(this.request.schedule, seconds);
    if (level !== undefined && level !== this.activeLevel) {
      const { camera } = this.options.world;
      camera.far = this.request.states[level].viewDistance;
      camera.updateProjectionMatrix();
      this.activeLevel = level;
    }
    this.followBackground(seconds);
    for (const sense of SHOW_SENSES)
      this.setSense(
        sense,
        senseIntensityAt(
          this.request.schedule,
          this.request.states,
          sense,
          seconds,
        ),
      );
    this.options.reach.setEndCreditsPresence?.(
      endCreditsPresenceAt(this.request.schedule, seconds),
    );
    this.options.reach.followPassages?.(seconds);
  }

  private followOrgan(showTime: ShowTimeSample): void {
    for (const voice of ORGAN_VOICES)
      this.voiceStrengths[voice] = organVoiceStrengthAt(
        this.request.schedule,
        ORGAN_SCORE,
        voice,
        showTime.timeSeconds,
      );
    readListenerPose(this.options.world, this.listenerPose);
    this.options.droneOrgan?.update({
      showTimeSeconds: showTime.timeSeconds,
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
      voiceStrengths: this.voiceStrengths,
      listener: this.listenerPose,
      groundYMeters: this.options.worldSurface.groundYAt(
        this.listenerPose.x,
        this.listenerPose.z,
      ),
      readGroupCenters: (group) =>
        this.options.reach.readMotionActorCenters?.(
          group === "insects" ? "flies" : "birds",
        ) ?? NO_ACTOR_CENTERS,
    });
  }

  readonly readActiveLevelState = (): ShowLevelState =>
    this.request.states[this.readActiveLevel()];

  readonly update = (): void => {
    if (this.unloading) return;
    const showTime = this.clock.sample();
    this.narration?.follow({
      position: narrationCueAt(this.request.schedule, showTime.timeSeconds),
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
    });
    this.followWorld(showTime.timeSeconds);
    this.followOrgan(showTime);
  };

  readonly pause = (): void => {
    this.clock.pause();
  };

  readonly resetTime = (): void => {
    this.clock.seekTo(0);
    this.clock.pause();
  };

  readonly setLanguage = (language: NarrationLanguage): void => {
    if (this.unloading || language === this.language) return;
    this.language = language;
    this.prepareNarration();
  };

  readonly play = (): void => {
    this.clock.play();
  };
  readonly seekTo = (seconds: number): void => {
    this.clock.seekTo(seconds);
  };
  readonly seekBy = (seconds: number): void => {
    this.clock.seekBy(seconds);
  };
  readonly setTimeScale = (scale: number): void => {
    this.clock.setTimeScale(scale);
  };
  readonly togglePlayback = (): void => {
    if (this.clock.sample().isPlaying) this.pause();
    else this.clock.play();
  };
  readonly readLanguage = (): NarrationLanguage => this.language;
  readonly readActiveLevel = (): ShowLevelName =>
    this.activeLevel ?? this.openingLevel;
  readonly readAudioState = (): AudioContextState =>
    this.options.timebase.readState();

  readonly sample = (): ShowTimeSample => this.clock.sample();
  readonly running: RunningShow = {
    sample: this.sample,
    play: this.play,
    pause: this.pause,
    seekTo: this.seekTo,
    seekBy: this.seekBy,
    setTimeScale: this.setTimeScale,
    togglePlayback: this.togglePlayback,
    resetTime: this.resetTime,
    readLanguage: this.readLanguage,
    readActiveLevel: this.readActiveLevel,
    readAudioState: this.readAudioState,
    setLanguage: this.setLanguage,
  };
}

function validateDuration(seconds: number, subject: string): void {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new RangeError(`${subject} duration must be positive and finite`);
}

/**
 * Read where the visitor is and which way they face, into the caller's pose.
 * The eye carries the head pose the rig published at the end of the previous
 * frame — the same frame of reference every module windows its content around.
 */
function readListenerPose(
  world: ShowWorld,
  pose: {
    x: number;
    y: number;
    z: number;
    yawRadians: number;
    pitchRadians: number;
  },
): void {
  const eye = world.viewpoint.worldPosition;
  pose.x = eye.x;
  pose.y = eye.y;
  pose.z = eye.z;

  // Forward is the camera's negated third column in world space.
  const elements = world.camera.matrixWorld.elements;
  const forwardX = -(elements[8] ?? 0);
  const forwardY = -(elements[9] ?? 0);
  const forwardZ = -(elements[10] ?? 1);
  pose.yawRadians = Math.atan2(forwardX, forwardZ);
  pose.pitchRadians = Math.asin(Math.min(1, Math.max(-1, forwardY)));
}
