/**
 * Purpose: Drive one preloaded world from narration show time.
 * Context: The show changes presentation, sense strength, and module gates without rebuilding resources.
 * Responsibility: Own narration following, transitions, sense intensities, the organ's frame, and the public show controls.
 * Boundary: Level Runtime constructs modules; concrete modules and the render loop remain elsewhere.
 */

import { Color, MathUtils } from "three";
import { endCreditsPresenceAt } from "../dramaturgy/end-credits";
import {
  type NarrationLanguage,
  narrationDurationSeconds,
  narrationUrl,
} from "../dramaturgy/narration-catalog";
import {
  type NarrationSchedule,
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
import type { MotionActorGroup } from "../modules/motion-sense/motion-sense";
import type { StartModuleHandle } from "../modules/start/start.module";
import type { StartParameters } from "../modules/start/start-settings";
import type { WorldFadeEffect } from "../modules/world-fade/world-fade";
import { createAudioTimebase } from "../sound/audio-timebase";
import { createDroneOrgan } from "../sound/drone-organ/drone-organ";
import type { OrganPlacementGroup } from "../sound/drone-organ/drone-organ-settings";
import type { ListenerPose } from "../sound/drone-organ/organ-signals";
import type { NarrationRecording } from "../sound/narration-player";
import { createNarrationPlayer } from "../sound/narration-player";
import type { SpatialAudio } from "../sound/spatial-audio.runtime";
import type { WorldModule } from "../world/module-runtime";
import type { WorldContext } from "../world/world-runtime";
import type { WorldSurface } from "../world-surface/world-surface";

export interface ShowRequest {
  readonly schedule: NarrationSchedule;
  readonly language: NarrationLanguage;
  readonly states: Record<ShowLevelName, ShowLevelState>;
}

export interface TutorialStatus {
  /** Borrowed world-space passage target; absent during preparation. */
  readonly goalTarget?: Readonly<{ x: number; y: number; z: number }>;
  readonly phase: string;
  readonly goalIndex: number;
  readonly direction: "right" | "left" | "up" | "down";
  readonly crossingCount: number;
}

export interface RunningShow {
  readonly readTutorial: () => TutorialStatus | undefined;
  /** Continuous visit timeline; main cues remain relative to mainStartSeconds. */
  readonly sample: () => ShowTimeSample & { readonly mainStartSeconds: number };
  readonly play: ShowClock["play"];
  readonly pause: ShowClock["pause"];
  readonly seekTo: ShowClock["seekTo"];
  readonly seekBy: ShowClock["seekBy"];
  readonly setTimeScale: ShowClock["setTimeScale"];
  /** Toggle from the current Show state, independently of UI refresh timing. */
  readonly togglePlayback: () => void;
  /** Rewind and hold; the current world and flight remain unchanged. */
  readonly resetTime: () => void;
  readonly readLanguage: () => NarrationLanguage;
  readonly readActiveLevel: () => ShowLevelName;
  /** Replace narration at the current position without changing playback state. */
  readonly setLanguage: (language: NarrationLanguage) => void;
  readonly readAudioState: () => AudioContextState;
}

type ShowWorld = Pick<
  WorldContext,
  "camera" | "renderer" | "modules" | "viewpoint"
>;

type SenseDrivers = Readonly<
  Partial<Record<ShowSense, (intensity: number) => void>>
>;

/** Narrow reach from show policy into the world composed by Level Runtime. */
export interface ShowWorldReach {
  readonly gates: ReadonlyMap<ShowSense, readonly WorldModule[]>;
  readonly senses: SenseDrivers;
  readonly worldFades: {
    readonly structure?: WorldFadeEffect;
    readonly animals?: WorldFadeEffect;
  };
  readonly setSkyBackground?: (background: Color) => void;
  /**
   * Fades the closing credits in at the end of the show. Not a gate: the
   * credits are not a sense, and the panel costs no draw while hidden.
   */
  readonly setEndCreditsPresence?: (presence: number) => void;
  /** Places the authored animal crossings; composed only for a show. */
  readonly followPassages?: (showTimeSeconds: number) => void;

  /**
   * Where the moving actor clouds are, so the drone organ can put its two
   * placed voices on the birds and the insects the motion sense shows.
   */
  readonly readMotionActorCenters?: (group: MotionActorGroup) => Float32Array;
}

/** Answer for a placement group nothing in this world produces. */
const NO_ACTOR_CENTERS = new Float32Array(0);
const TUTORIAL_BREATH_SECONDS = 1.5;

/** The listener pose scratch a show writes each frame; the organ only reads. */
type MutableListenerPose = {
  -readonly [Key in keyof ListenerPose]: ListenerPose[Key];
};

export interface ShowTutorial {
  readonly setRoomPresence?: (presence: number) => void;
  readonly start: Pick<
    StartModuleHandle,
    | "readObservation"
    | "setPlaying"
    | "setFormationAllowed"
    | "setGoalAdvanceAllowed"
  >;
  /** Run resets practice once; Show resets playback policy. */
  readonly reset: () => void;
  readonly parameters: StartParameters;
  readonly recordings?: Readonly<
    Record<NarrationLanguage, readonly NarrationRecording[]>
  >;
  /** Run removes training resources and releases the prepared main world. */
  readonly finish: () => void;
}

export interface ShowRuntime {
  readonly setTutorial: (tutorial: ShowTutorial) => void;
  readonly readSpeechActive: () => boolean;
  /** Run holds playback until an exclusive training sample is prepared. */
  readonly setPreparationState: (state: "loading" | "ready" | "failed") => void;
  readonly update: () => void;
  readonly readActiveLevelState: () => ShowLevelState;
  readonly running: RunningShow;
  readonly unload: () => Promise<void>;
}

interface ShowRuntimeOptions {
  readonly world: ShowWorld;
  readonly reach: ShowWorldReach;
  readonly worldSurface: WorldSurface;
  readonly audio?: SpatialAudio;
  readonly standalone?: boolean;
  readonly tutorial?: ShowTutorial;
}

export async function createShowRuntime(
  request: ShowRequest,
  options: ShowRuntimeOptions,
): Promise<ShowRuntime> {
  validateDuration(request.schedule.durationSeconds, "Show");
  const openingLevel = showLevelAt(request.schedule, 0);
  if (!openingLevel) throw new Error("A show schedule needs at least one cue");
  const { tutorial, ...configuration } = options;
  const show = new Show(request, configuration, openingLevel);
  try {
    show.prepare(tutorial);
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

/** One Show owns both practice and score policy on the same audio clock. */
class Show implements ShowRuntime, RunningShow {
  private readonly timebase = createAudioTimebase();
  private clock!: ShowClock;
  private readonly targetBackground = new Color();
  private readonly liveBackground = new Color(0xffffff);
  private readonly listenerPose: MutableListenerPose = {
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
  private narration: ReturnType<typeof createNarrationPlayer> | undefined;
  private droneOrgan: ReturnType<typeof createDroneOrgan> | undefined;
  private unloading: Promise<void> | undefined;
  private tutorial: ShowTutorial | undefined;
  private activeLevel: ShowLevelName | undefined;
  private roomPresence = 0;
  private mainStartSeconds = 0;
  private instruction = "right";
  private instructionStartSeconds = 0;
  private tutorialGoalIndex = 0;
  private tutorialAttempt = 0;
  private transition: { breathStartSeconds?: number } | undefined;
  private preparationState: "loading" | "ready" | "failed" = "ready";

  constructor(
    private readonly request: ShowRequest,
    private readonly options: Omit<ShowRuntimeOptions, "tutorial">,
    private readonly openingLevel: ShowLevelName,
  ) {
    this.language = request.language;
  }

  prepare(tutorial?: ShowTutorial): void {
    this.clock = createShowClock(
      this.request.schedule.durationSeconds,
      this.timebase.readSeconds,
    );
    const { audio, standalone } = this.options;
    if (!tutorial) this.prepareNarration();
    if (audio && (!standalone || tutorial?.parameters.windStrength))
      this.droneOrgan = createDroneOrgan(
        {
          pulseSeconds: ORGAN_SCORE.pulseSeconds,
          voices: standalone ? ["wind"] : undefined,
        },
        audio,
      );
    if (!standalone) this.followWorld(0);
    if (tutorial) this.setTutorial(tutorial);
  }

  readonly unload = (): Promise<void> => {
    this.clock?.pause();
    this.unloading ??= this.releaseAudio();
    return this.unloading;
  };

  private async releaseAudio(): Promise<void> {
    const results = await Promise.allSettled([
      Promise.resolve().then(() => this.narration?.unload()),
      this.droneOrgan?.unload(),
      this.timebase.unload(),
    ]);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (errors.length) throw new AggregateError(errors, "Show cleanup failed");
  }

  private prepareNarration(): void {
    const recordings: NarrationRecording[] = this.options.standalone
      ? []
      : this.request.schedule.narration.map(({ cueId }) => ({
          cueId,
          url: narrationUrl(cueId, this.language),
          durationSeconds: narrationDurationSeconds(cueId, this.language),
        }));
    recordings.push(...(this.tutorial?.recordings?.[this.language] ?? []));
    if (this.narration) this.narration.setRecordings(recordings);
    else this.narration = createNarrationPlayer({ recordings });
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

  readonly readTutorial = (): TutorialStatus | undefined => {
    if (this.preparationState !== "ready")
      return {
        phase: this.preparationState,
        goalIndex: 0,
        direction: "right",
        crossingCount: 0,
      };
    if (!this.tutorial) return undefined;
    const observed = this.tutorial.start.readObservation();
    return {
      phase: observed.phase,
      goalTarget: observed.goalPosition,
      goalIndex: observed.goalIndex,
      direction: observed.direction,
      crossingCount: observed.crossingCount,
    };
  };

  private voiceStrength(
    voice: OrganVoiceName,
    showTime: ShowTimeSample,
  ): number {
    if (!this.tutorial)
      return organVoiceStrengthAt(
        this.request.schedule,
        ORGAN_SCORE,
        voice,
        showTime.timeSeconds,
      );
    if (voice !== "wind" || !showTime.isPlaying) return 0;
    return (
      (this.tutorial.parameters.windStrength ?? 0) *
      this.roomPresence *
      (this.narration?.readIsPlaying() ? 0.5 : 1)
    );
  }

  private followOrgan(showTime: ShowTimeSample): void {
    for (const voice of ORGAN_VOICES)
      this.voiceStrengths[voice] = this.voiceStrength(voice, showTime);
    readListenerPose(this.options.world, this.listenerPose);
    this.droneOrgan?.update({
      showTimeSeconds: showTime.timeSeconds,
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
      voiceStrengths: this.voiceStrengths,
      listener: this.listenerPose,
      groundYMeters: this.options.worldSurface.groundYAt(
        this.listenerPose.x,
        this.listenerPose.z,
      ),
      readGroupCenters: (group) => readActorCenters(this.options.reach, group),
    });
  }

  readonly setTutorial = (tutorial: ShowTutorial): void => {
    validateDuration(
      tutorial.parameters.maximumPracticeSeconds,
      "Tutorial practice",
    );
    this.clock.pause();
    this.clock.seekTo(0);
    this.clock.setTimeScale(1);
    this.clock.setDuration(undefined);
    this.tutorial = tutorial;
    this.resetTutorial();
    this.followOrgan(this.clock.sample());
    this.prepareNarration();
  };

  private holdTutorial(): void {
    this.tutorial?.start.setPlaying(false);
    this.tutorial?.start.setGoalAdvanceAllowed(false);
    this.tutorial?.start.setFormationAllowed(false);
  }

  private resetTutorial(): void {
    if (!this.tutorial) return;
    this.transition = undefined;
    this.roomPresence = 0;
    this.tutorial.setRoomPresence?.(0);
    this.mainStartSeconds = this.options.standalone
      ? 0
      : this.tutorial.parameters.maximumPracticeSeconds;
    this.tutorial.reset();
    this.holdTutorial();
    this.instruction = this.tutorial.parameters.directions[0];
    this.instructionStartSeconds = 0;
    this.tutorialGoalIndex = 0;
    this.tutorialAttempt = 0;
  }

  private requestTransition(): void {
    if (this.options.standalone || this.transition) return;
    this.transition = {};
    this.holdTutorial();
  }

  private finishTutorial(): void {
    if (!this.tutorial) return;
    const completed = this.tutorial;
    this.mainStartSeconds = this.clock.sample().timeSeconds;
    this.tutorial = undefined;
    this.transition = undefined;
    this.prepareNarration();
    completed.finish();
    this.clock.seekTo(0);
    this.clock.setTimeScale(1);
    this.clock.setDuration(this.request.schedule.durationSeconds);
    this.activeLevel = undefined;
    this.followWorld(0);
    this.clock.play();
  }

  readonly readSpeechActive = (): boolean =>
    this.narration?.readIsPlaying() ?? false;
  readonly readActiveLevelState = (): ShowLevelState =>
    this.request.states[this.readActiveLevel()];

  readonly setPreparationState = (
    state: "loading" | "ready" | "failed",
  ): void => {
    this.preparationState = state;
    if (state !== "ready") {
      this.pause();
      if (!this.options.standalone) this.followOrgan(this.clock.sample());
    }
    if (state !== "failed") return;
    this.tutorial = undefined;
    this.narration?.unload();
    this.narration = undefined;
  };

  readonly update = (): void => {
    if (this.unloading || this.preparationState !== "ready") return;
    const showTime = this.clock.sample();
    if (this.tutorial) {
      if (!this.followTutorial(showTime)) this.followOrgan(showTime);
      return;
    }
    if (this.options.standalone) return;
    this.narration?.follow({
      position: narrationCueAt(this.request.schedule, showTime.timeSeconds),
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
    });
    this.followWorld(showTime.timeSeconds);
    this.followOrgan(showTime);
  };

  /** Returning true ends this frame after rebasing onto the main score. */
  private followTutorial(showTime: ShowTimeSample): boolean {
    if (!this.tutorial) return false;
    const observed = this.tutorial.start.readObservation();
    const instructionFinished = this.advanceTutorial(showTime, observed);
    this.narration?.follow({
      position: {
        cueId: this.instruction,
        offsetSeconds: showTime.timeSeconds - this.instructionStartSeconds,
      },
      isPlaying: showTime.isPlaying,
      timeScale: 1,
      preserveNaturalEnd: true,
    });
    if (this.transition) return this.followBreathing(showTime);
    this.followPractice(observed, showTime, instructionFinished);
    return false;
  }

  private advanceTutorial(
    showTime: ShowTimeSample,
    observed: TutorialObservation,
  ): boolean {
    if (!this.tutorial) return true;
    const succeeded =
      observed.crossingCount === this.tutorial.parameters.directions.length;
    if (
      showTime.isPlaying &&
      !succeeded &&
      showTime.timeSeconds >= this.tutorial.parameters.maximumPracticeSeconds
    )
      this.requestTransition();
    const instructionFinished =
      this.narration?.readHasEnded(this.instruction) ?? true;
    if (!this.transition && instructionFinished)
      this.advanceInstruction(observed, succeeded, showTime.timeSeconds);
    if (
      showTime.isPlaying &&
      this.instruction === "complete" &&
      showTime.timeSeconds >= this.mainStartSeconds
    )
      this.requestTransition();
    return instructionFinished;
  }

  private recording(cueId: string): NarrationRecording | undefined {
    return this.tutorial?.recordings?.[this.language].find(
      (clip) => clip.cueId === cueId,
    );
  }

  private advanceInstruction(
    observed: TutorialObservation,
    succeeded: boolean,
    seconds: number,
  ): void {
    const next = succeeded ? "complete" : observed.direction;
    if (
      next === this.instruction &&
      observed.goalIndex === this.tutorialGoalIndex &&
      observed.attempt === this.tutorialAttempt
    )
      return;
    const retry =
      next === this.instruction &&
      observed.goalIndex === this.tutorialGoalIndex;
    this.instructionStartSeconds =
      seconds -
      (retry
        ? (this.recording(this.instruction)?.instructionAtSeconds ?? 0)
        : 0);
    this.instruction = next;
    this.tutorialGoalIndex = observed.goalIndex;
    this.tutorialAttempt = observed.attempt;
    if (!this.options.standalone && next === "complete")
      this.mainStartSeconds =
        this.instructionStartSeconds +
        (this.recording("complete")?.durationSeconds ?? 0);
  }

  private followBreathing(showTime: ShowTimeSample): boolean {
    const transition = this.transition;
    if (
      !transition ||
      !showTime.isPlaying ||
      !(this.narration?.readHasEnded(this.instruction) ?? true)
    )
      return false;
    transition.breathStartSeconds ??= showTime.timeSeconds;
    if (
      showTime.timeSeconds - transition.breathStartSeconds <
      TUTORIAL_BREATH_SECONDS
    )
      return false;
    this.finishTutorial();
    return true;
  }

  private followPractice(
    observed: TutorialObservation,
    showTime: ShowTimeSample,
    instructionFinished: boolean,
  ): void {
    if (!this.tutorial) return;
    const selected = this.recording(this.instruction);
    const requestedOffset = showTime.timeSeconds - this.instructionStartSeconds;
    const spokenOffset = selected
      ? Math.min(
          requestedOffset,
          this.narration?.readOffsetSeconds(this.instruction) ?? 0,
        )
      : requestedOffset;
    this.followRoom(observed, spokenOffset);
    this.tutorial.start.setFormationAllowed(
      observed.attempt === this.tutorialAttempt &&
        spokenOffset >= (selected?.instructionAtSeconds ?? 0),
    );
    this.tutorial.start.setGoalAdvanceAllowed(instructionFinished);
    this.tutorial.start.setPlaying(
      showTime.isPlaying && this.timebase.readState() === "running",
    );
  }

  private followRoom(
    observed: TutorialObservation,
    spokenOffset: number,
  ): void {
    if (!this.tutorial) return;
    const opening = this.recording(this.tutorial.parameters.directions[0]);
    const progressed =
      observed.goalIndex > 0 ||
      observed.attempt > 0 ||
      observed.crossingCount === this.tutorial.parameters.directions.length;
    this.roomPresence = Math.max(
      this.roomPresence,
      progressed
        ? 1
        : MathUtils.clamp(
            (spokenOffset - (opening?.environmentAtSeconds ?? 0)) /
              this.tutorial.parameters.formationSeconds,
            0,
            1,
          ),
    );
    this.tutorial.setRoomPresence?.(this.roomPresence);
  }

  readonly pause = (): void => {
    this.clock.pause();
    this.tutorial?.start.setPlaying(false);
  };

  readonly resetTime = (): void => {
    this.clock.seekTo(0);
    this.clock.pause();
    this.resetTutorial();
  };

  readonly setLanguage = (language: NarrationLanguage): void => {
    if (this.unloading || language === this.language || this.transition) return;
    this.language = language;
    if (this.preparationState === "failed") return;
    this.prepareNarration();
    if (!this.tutorial) return;
    if (this.instruction !== "complete")
      this.instructionStartSeconds = this.clock.sample().timeSeconds;
    else if (!this.options.standalone)
      this.mainStartSeconds = Math.max(
        this.clock.sample().timeSeconds,
        this.instructionStartSeconds +
          (this.recording("complete")?.durationSeconds ?? 0),
      );
    this.tutorial.start.setGoalAdvanceAllowed(false);
    this.tutorial.start.setFormationAllowed(false);
  };

  readonly play = (): void => {
    if (this.preparationState === "ready") this.clock.play();
  };
  readonly seekTo = (seconds: number): void => {
    if (this.canScrub()) this.clock.seekTo(seconds - this.mainStartSeconds);
  };
  readonly seekBy = (seconds: number): void => {
    if (this.canScrub()) this.clock.seekBy(seconds);
  };
  readonly setTimeScale = (scale: number): void => {
    if (this.canScrub()) this.clock.setTimeScale(scale);
  };
  readonly togglePlayback = (): void => {
    if (this.preparationState !== "ready") return;
    if (this.clock.sample().isPlaying) this.pause();
    else this.clock.play();
  };
  readonly readLanguage = (): NarrationLanguage => this.language;
  readonly readActiveLevel = (): ShowLevelName =>
    this.activeLevel ?? this.openingLevel;
  readonly readAudioState = this.timebase.readState;

  private canScrub(): boolean {
    return !this.tutorial && this.preparationState === "ready";
  }

  readonly sample = (): ShowTimeSample & {
    readonly mainStartSeconds: number;
  } => {
    const sample = this.clock.sample();
    return {
      ...sample,
      timeSeconds:
        sample.timeSeconds + (this.tutorial ? 0 : this.mainStartSeconds),
      mainStartSeconds: this.mainStartSeconds,
      isPlaying:
        sample.isPlaying &&
        this.preparationState === "ready" &&
        (!this.tutorial || this.timebase.readState() === "running"),
    };
  };
  readonly running: RunningShow = {
    readTutorial: this.readTutorial,
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

type TutorialObservation = ReturnType<ShowTutorial["start"]["readObservation"]>;

function validateDuration(seconds: number, subject: string): void {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new RangeError(`${subject} duration must be positive and finite`);
}

/**
 * Read where the visitor is and which way they face, into the caller's pose.
 * The eye carries the head pose the rig published at the end of the previous
 * frame — the same frame of reference every module windows its content around.
 */
function readListenerPose(world: ShowWorld, pose: MutableListenerPose): void {
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

/** The organ's placement groups, answered from the moving world it can reach. */
function readActorCenters(
  reach: ShowWorldReach,
  group: OrganPlacementGroup,
): Float32Array {
  return (
    reach.readMotionActorCenters?.(group === "insects" ? "flies" : "birds") ??
    NO_ACTOR_CENTERS
  );
}
