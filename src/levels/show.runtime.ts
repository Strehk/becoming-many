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
  type ShowLevelState,
  type ShowSense,
  senseIntensityAt,
  showLevelAt,
} from "../dramaturgy/show-levels";
import type { MotionActorGroup } from "../modules/motion-sense/motion-sense";
import type {
  StartModuleHandle,
  StartParameters,
} from "../modules/start/start.module";
import type { WorldFadeEffect } from "../modules/world-fade/world-fade";
import { createAudioTimebase } from "../sound/audio-timebase";
import { createDroneOrgan } from "../sound/drone-organ/drone-organ";
import type { OrganPlacementGroup } from "../sound/drone-organ/drone-organ-settings";
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
  readonly missCount?: number;
  /** Prepared integrated practice may be skipped independently of learned goals. */
  readonly readyToContinue: boolean;
}

export interface RunningShow {
  readonly readTutorial: () => TutorialStatus | undefined;
  readonly continueToExperience: () => void;
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

/** The listener pose scratch a show writes each frame; the organ only reads. */
type MutableListenerPose = {
  x: number;
  y: number;
  z: number;
  yawRadians: number;
  pitchRadians: number;
};

interface ShowTutorial {
  readonly setRoomPresence?: (presence: number) => void;
  readonly start: StartModuleHandle;
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

export async function createShowRuntime(
  request: ShowRequest,
  world: ShowWorld,
  reach: ShowWorldReach,
  worldSurface: WorldSurface,
  audio: SpatialAudio | undefined,
  standalone = false,
  initialTutorial?: ShowTutorial,
): Promise<ShowRuntime> {
  const { schedule, states } = request;
  if (
    !Number.isFinite(schedule.durationSeconds) ||
    schedule.durationSeconds <= 0
  )
    throw new RangeError("Show duration must be positive and finite");
  const openingLevel = showLevelAt(schedule, 0);
  if (!openingLevel) throw new Error("A show schedule needs at least one cue");

  const timebase = createAudioTimebase();
  let clock: ShowClock;
  const cueIds = schedule.narration.map((cue) => cue.cueId);
  let language = request.language;
  let narration: ReturnType<typeof createNarrationPlayer> | undefined;
  let droneOrgan: ReturnType<typeof createDroneOrgan> | undefined;
  let unloading: Promise<void> | undefined;
  let tutorial: ShowTutorial | undefined;
  let roomPresence = 0;
  let mainStartSeconds = 0;
  let instruction = "right";
  let instructionStartSeconds = 0;
  let tutorialGoalIndex = 0;
  let tutorialAttempt = 0;
  let preparationState: "loading" | "ready" | "failed" = "ready";
  function unload(): Promise<void> {
    clock?.pause();
    unloading ??= (async () => {
      const results = await Promise.allSettled([
        Promise.resolve().then(() => narration?.unload()),
        droneOrgan?.unload(),
        timebase.unload(),
      ]);
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "Show cleanup failed");
    })();
    return unloading;
  }
  try {
    // The same clock runs practice and its successful closing voice, then rebases
    // to the main score. The public timeline retains the actual tutorial span.
    clock = createShowClock(schedule.durationSeconds, timebase.readSeconds);
    function prepareNarration(nextTutorial?: ShowTutorial): void {
      const recordings: NarrationRecording[] = standalone
        ? []
        : cueIds.map((cueId) => ({
            cueId,
            url: narrationUrl(cueId, language),
            durationSeconds: narrationDurationSeconds(cueId, language),
          }));
      recordings.push(...(nextTutorial?.recordings?.[language] ?? []));
      if (narration) narration.setRecordings(recordings);
      else narration = createNarrationPlayer({ recordings });
    }
    if (!initialTutorial) prepareNarration();
    // The organ follows the same clock but plays on Tone's own context, which
    // is the only context its rooms come up on. It loads Tone.js by itself, so
    // the world runs on before the organ makes a sound.
    if (audio && (!standalone || initialTutorial?.parameters.windStrength))
      droneOrgan = createDroneOrgan(
        {
          pulseSeconds: ORGAN_SCORE.pulseSeconds,
          voices: standalone ? ["wind"] : undefined,
        },
        audio,
      );
    let activeLevel: ShowLevelName | undefined;
    // Scratch state, so following the show allocates nothing per frame.
    const voiceStrengths: Record<OrganVoiceName, number> = {
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
    const listenerPose: MutableListenerPose = {
      x: 0,
      y: 0,
      z: 0,
      yawRadians: 0,
      pitchRadians: 0,
    };
    const liveBackground = new Color(0xffffff);
    const backgroundColors = createBackgroundColors(states);

    function followViewDistance(showTimeSeconds: number): void {
      const levelName = showLevelAt(schedule, showTimeSeconds);
      if (levelName === undefined || levelName === activeLevel) return;

      world.camera.far = states[levelName].viewDistance;
      world.camera.updateProjectionMatrix();
      activeLevel = levelName;
    }

    function followBackground(showTimeSeconds: number): void {
      const transition = levelTransitionAt(schedule, showTimeSeconds);
      if (!transition) return;

      liveBackground
        .copy(backgroundColors[transition.from])
        .lerp(backgroundColors[transition.to], transition.progress);
      world.renderer.setClearColor(liveBackground);
      reach.worldFades.structure?.setBackground(liveBackground);
      reach.worldFades.animals?.setBackground(liveBackground);
      reach.setSkyBackground?.(liveBackground);
    }

    function setSense(sense: ShowSense, intensity: number): void {
      reach.senses[sense]?.(intensity);
      const modules = reach.gates.get(sense);
      if (!modules) return;

      for (const module of modules) {
        if (intensity > 0) world.modules.activate(module);
        else world.modules.deactivate(module);
      }
    }

    function followSenses(showTimeSeconds: number): void {
      const scent = senseIntensityAt(
        schedule,
        states,
        "scent",
        showTimeSeconds,
      );
      const echo = senseIntensityAt(schedule, states, "echo", showTimeSeconds);
      const motion = senseIntensityAt(
        schedule,
        states,
        "motion",
        showTimeSeconds,
      );
      const thermal = senseIntensityAt(
        schedule,
        states,
        "thermal",
        showTimeSeconds,
      );
      const magnetic = senseIntensityAt(
        schedule,
        states,
        "magnetic",
        showTimeSeconds,
      );
      const connections = senseIntensityAt(
        schedule,
        states,
        "connections",
        showTimeSeconds,
      );

      setSense("scent", scent);
      setSense("echo", echo);
      setSense("motion", motion);
      setSense("thermal", thermal);
      setSense("magnetic", magnetic);
      setSense("connections", connections);
      reach.worldFades.structure?.setPresence(echo);
      reach.worldFades.animals?.setPresence(thermal);
      // Derived like everything else here, so a seek lands mid-fade and a seek
      // to zero puts the credits away without a second piece of state.
      reach.setEndCreditsPresence?.(
        endCreditsPresenceAt(schedule, showTimeSeconds),
      );
    }

    function followWorld(showTimeSeconds: number): void {
      followViewDistance(showTimeSeconds);
      followBackground(showTimeSeconds);
      followSenses(showTimeSeconds);
      // Passages read the same instant as the senses they announce, so an
      // animal crossing a cue boundary stays in step with the fade under it.
      reach.followPassages?.(showTimeSeconds);
    }

    function readTutorial(): TutorialStatus | undefined {
      if (preparationState !== "ready")
        return {
          phase: preparationState,
          goalIndex: 0,
          direction: "right",
          crossingCount: 0,
          readyToContinue: false,
        };
      if (!tutorial) return undefined;
      const observed = tutorial.start.readObservation();
      return {
        phase: observed.phase,
        goalTarget: observed.goalTarget,
        goalIndex: observed.goalIndex,
        direction: observed.direction,
        crossingCount: observed.crossingCount,
        missCount: observed.missCount,
        readyToContinue: !standalone,
      };
    }

    // The organ is a follower like the narration: the score says how strong
    // each voice stands at this instant, and the clock says what instant it is.
    function followOrgan(showTime: ShowTimeSample): void {
      for (const voice of ORGAN_VOICES) {
        voiceStrengths[voice] = tutorial
          ? voice === "wind" && showTime.isPlaying
            ? (tutorial.parameters.windStrength ?? 0) *
              roomPresence *
              (narration?.readIsPlaying() ? 0.5 : 1)
            : 0
          : organVoiceStrengthAt(
              schedule,
              ORGAN_SCORE,
              voice,
              showTime.timeSeconds,
            );
      }
      readListenerPose(world, listenerPose);
      droneOrgan?.update({
        showTimeSeconds: showTime.timeSeconds,
        isPlaying: showTime.isPlaying,
        timeScale: showTime.timeScale,
        voiceStrengths,
        listener: listenerPose,
        groundYMeters: worldSurface.groundYAt(listenerPose.x, listenerPose.z),
        readGroupCenters: (group) => readActorCenters(reach, group),
      });
    }

    if (!standalone) followWorld(0);

    function setTutorial(next: ShowTutorial): void {
      if (
        !Number.isFinite(next.parameters.maximumPracticeSeconds) ||
        next.parameters.maximumPracticeSeconds <= 0
      )
        throw new RangeError(
          "Tutorial practice duration must be positive and finite",
        );
      clock.pause();
      clock.seekTo(0);
      clock.setTimeScale(1);
      clock.setDuration(undefined);
      tutorial = next;
      roomPresence = 0;
      tutorial.setRoomPresence?.(0);
      followOrgan({ ...clock.sample(), isPlaying: false });
      mainStartSeconds = standalone
        ? 0
        : next.parameters.maximumPracticeSeconds;
      tutorial.start.reset();
      tutorial.start.setPlaying(false);
      tutorial.start.setGoalAdvanceAllowed(false);
      tutorial.start.setFormationAllowed(false);
      instruction = next.parameters.directions[0];
      tutorialGoalIndex = 0;
      tutorialAttempt = 0;
      instructionStartSeconds = 0;
      prepareNarration(next);
    }
    function continueToExperience(): void {
      if (!tutorial || preparationState !== "ready" || standalone || unloading)
        return;
      const completed = tutorial;
      // A manual skip keeps only elapsed tutorial time; timeout keeps its planned end.
      mainStartSeconds = Math.min(clock.sample().timeSeconds, mainStartSeconds);
      tutorial = undefined;
      prepareNarration();
      completed.finish();
      clock.seekTo(0);
      clock.setTimeScale(1);
      clock.setDuration(schedule.durationSeconds);
      activeLevel = undefined;
      followWorld(0);
      clock.play();
    }
    if (initialTutorial) setTutorial(initialTutorial);

    return {
      unload,
      setTutorial,
      readSpeechActive: () => narration?.readIsPlaying() ?? false,
      setPreparationState(state): void {
        preparationState = state;
        if (state !== "ready") {
          clock.pause();
          if (!standalone) followOrgan({ ...clock.sample(), isPlaying: false });
          tutorial?.start.setPlaying(false);
        }
        if (state === "failed") {
          tutorial = undefined;
          narration?.unload();
          narration = undefined;
        }
      },
      update: (): void => {
        if (unloading || preparationState !== "ready") return;
        const showTime = clock.sample();
        if (tutorial) {
          const observed = tutorial.start.readObservation();
          const succeeded =
            observed.crossingCount === tutorial.parameters.directions.length;
          if (
            !standalone &&
            showTime.isPlaying &&
            !succeeded &&
            showTime.timeSeconds >= tutorial.parameters.maximumPracticeSeconds
          ) {
            continueToExperience();
            return;
          }
          const currentRecording = tutorial.recordings?.[language].find(
            (clip) => clip.cueId === instruction,
          );
          const instructionFinished =
            showTime.timeSeconds - instructionStartSeconds >=
            (currentRecording?.durationSeconds ?? 0);
          const nextInstruction = succeeded ? "complete" : observed.direction;
          if (
            nextInstruction !== instruction ||
            observed.goalIndex !== tutorialGoalIndex ||
            (observed.attempt !== tutorialAttempt && instructionFinished)
          ) {
            const retry =
              nextInstruction === instruction &&
              observed.goalIndex === tutorialGoalIndex;
            instruction = nextInstruction;
            tutorialGoalIndex = observed.goalIndex;
            tutorialAttempt = observed.attempt;
            instructionStartSeconds =
              showTime.timeSeconds -
              (retry ? (currentRecording?.instructionAtSeconds ?? 0) : 0);
            if (!standalone && instruction === "complete") {
              const completion = tutorial.recordings?.[language].find(
                (clip) => clip.cueId === "complete",
              );
              mainStartSeconds =
                instructionStartSeconds + (completion?.durationSeconds ?? 0);
            }
          }
          if (
            !standalone &&
            showTime.isPlaying &&
            instruction === "complete" &&
            showTime.timeSeconds >= mainStartSeconds
          ) {
            continueToExperience();
            return;
          }
          const selectedRecording = tutorial.recordings?.[language].find(
            (clip) => clip.cueId === instruction,
          );
          narration?.follow({
            position: {
              cueId: instruction,
              offsetSeconds: showTime.timeSeconds - instructionStartSeconds,
            },
            isPlaying: showTime.isPlaying,
            timeScale: 1,
          });
          const requestedOffset =
            showTime.timeSeconds - instructionStartSeconds;
          const spokenOffset = selectedRecording
            ? Math.min(
                requestedOffset,
                narration?.readOffsetSeconds(instruction) ?? 0,
              )
            : requestedOffset;
          const openingCue = tutorial.parameters.directions[0];
          const openingRecording = tutorial.recordings?.[language].find(
            (clip) => clip.cueId === openingCue,
          );
          roomPresence = Math.max(
            roomPresence,
            observed.goalIndex > 0 || observed.attempt > 0 || succeeded
              ? 1
              : Math.min(
                  1,
                  Math.max(
                    0,
                    (spokenOffset -
                      (openingRecording?.environmentAtSeconds ?? 0)) /
                      tutorial.parameters.formationSeconds,
                  ),
                ),
          );
          tutorial.setRoomPresence?.(roomPresence);
          tutorial.start.setFormationAllowed(
            observed.attempt === tutorialAttempt &&
              spokenOffset >= (selectedRecording?.instructionAtSeconds ?? 0),
          );
          tutorial.start.setGoalAdvanceAllowed(instructionFinished);
          tutorial.start.setPlaying(
            preparationState === "ready" &&
              showTime.isPlaying &&
              timebase.readState() === "running",
          );
          followOrgan(showTime);
          return;
        }
        if (standalone) return;
        narration?.follow({
          position: narrationCueAt(schedule, showTime.timeSeconds),
          isPlaying: showTime.isPlaying,
          timeScale: showTime.timeScale,
        });
        followWorld(showTime.timeSeconds);
        followOrgan(showTime);
      },

      readActiveLevelState: () => states[activeLevel ?? openingLevel],

      running: {
        readTutorial,
        continueToExperience,
        sample: () => {
          const sample = clock.sample();
          return {
            ...sample,
            timeSeconds: sample.timeSeconds + (tutorial ? 0 : mainStartSeconds),
            mainStartSeconds,
            isPlaying:
              sample.isPlaying &&
              preparationState === "ready" &&
              (!tutorial || timebase.readState() === "running"),
          };
        },
        play: () => {
          if (preparationState === "ready") clock.play();
        },
        pause: () => {
          clock.pause();
          tutorial?.start.setPlaying(false);
        },
        seekTo: (seconds) => {
          if (!tutorial && preparationState === "ready")
            clock.seekTo(seconds - mainStartSeconds);
        },
        seekBy: (seconds) => {
          if (!tutorial && preparationState === "ready") clock.seekBy(seconds);
        },
        setTimeScale: (scale) => {
          if (!tutorial && preparationState === "ready")
            clock.setTimeScale(scale);
        },
        togglePlayback: () => {
          if (preparationState !== "ready") return;
          if (clock.sample().isPlaying) {
            clock.pause();
            tutorial?.start.setPlaying(false);
          } else clock.play();
        },
        resetTime: () => {
          clock.seekTo(0);
          clock.pause();
          if (tutorial) {
            mainStartSeconds = standalone
              ? 0
              : tutorial.parameters.maximumPracticeSeconds;
            roomPresence = 0;
            tutorial.setRoomPresence?.(0);
            tutorial.start.reset();
            tutorial.start.setPlaying(false);
            tutorial.start.setGoalAdvanceAllowed(false);
            tutorial.start.setFormationAllowed(false);
            instruction = tutorial.parameters.directions[0];
            instructionStartSeconds = 0;
            tutorialGoalIndex = 0;
            tutorialAttempt = 0;
          }
        },
        readLanguage: () => language,
        readActiveLevel: () => activeLevel ?? openingLevel,
        readAudioState: timebase.readState,
        setLanguage: (next): void => {
          if (unloading || next === language) return;

          language = next;
          if (preparationState === "failed") return;
          prepareNarration(tutorial);
          if (tutorial) {
            if (instruction !== "complete")
              instructionStartSeconds = clock.sample().timeSeconds;
            else if (!standalone) {
              const completion = tutorial.recordings?.[language].find(
                (clip) => clip.cueId === "complete",
              );
              mainStartSeconds = Math.max(
                clock.sample().timeSeconds,
                instructionStartSeconds + (completion?.durationSeconds ?? 0),
              );
            }
            tutorial.start.setGoalAdvanceAllowed(false);
            tutorial.start.setFormationAllowed(false);
          }
        },
      },
    };
  } catch (error) {
    try {
      await unload();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Show startup failed");
    }
    throw error;
  }
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

function createBackgroundColors(
  states: Record<ShowLevelName, ShowLevelState>,
): Record<ShowLevelName, Color> {
  return {
    "white-world": new Color(states["white-world"].backgroundColor),
    scent: new Color(states.scent.backgroundColor),
    echo: new Color(states.echo.backgroundColor),
    motion: new Color(states.motion.backgroundColor),
    thermal: new Color(states.thermal.backgroundColor),
    magnetic: new Color(states.magnetic.backgroundColor),
    connections: new Color(states.connections.backgroundColor),
  };
}
