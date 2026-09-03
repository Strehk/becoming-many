/**
 * Purpose: Drive one preloaded world from narration show time.
 * Context: The show changes presentation, sense strength, and module gates without rebuilding resources.
 * Responsibility: Own narration following, transitions, sense intensities, the organ's frame, and the public show controls.
 * Boundary: Level Runtime constructs modules; concrete modules and the render loop remain elsewhere.
 */

import { Color } from "three";
import { endCreditsPresenceAt } from "../dramaturgy/end-credits";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
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
import type { WorldFadeEffect } from "../modules/world-fade/world-fade";
import { createAudioTimebase } from "../sound/audio-timebase";
import { createDroneOrgan } from "../sound/drone-organ/drone-organ";
import type { OrganPlacementGroup } from "../sound/drone-organ/drone-organ-settings";
import { createNarrationPlayer } from "../sound/narration-player";
import type { WorldModule } from "../world/module-runtime";
import type { WorldContext } from "../world/world-runtime";
import type { WorldSurface } from "../world-surface/world-surface";

export interface ShowRequest {
  readonly schedule: NarrationSchedule;
  readonly language: NarrationLanguage;
  readonly states: Record<ShowLevelName, ShowLevelState>;
}

export interface RunningShow {
  readonly clock: ShowClock;
  readonly readLanguage: () => NarrationLanguage;
  readonly readActiveLevel: () => ShowLevelName;
  readonly setLanguage: (language: NarrationLanguage) => void;
  readonly readAudioState: () => AudioContextState;
}

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

export interface ShowRuntime {
  readonly update: () => void;
  readonly readActiveLevelState: () => ShowLevelState;
  readonly running: RunningShow;
}

export function createShowRuntime(
  request: ShowRequest,
  world: WorldContext,
  reach: ShowWorldReach,
  worldSurface: WorldSurface,
): ShowRuntime {
  const { schedule, states } = request;
  const openingLevel = showLevelAt(schedule, 0);
  if (!openingLevel) throw new Error("A show schedule needs at least one cue");

  const timebase = createAudioTimebase();
  const clock = createShowClock(schedule.durationSeconds, timebase.readSeconds);
  const cueIds = schedule.narration.map((cue) => cue.cueId);
  let language = request.language;
  let narration = createNarrationPlayer({ language, cueIds });
  // The organ follows the same clock but plays on Tone's own context, which
  // is the only context its rooms come up on. It loads Tone.js by itself, so
  // the world runs on before the organ makes a sound.
  const droneOrgan = createDroneOrgan({
    pulseSeconds: ORGAN_SCORE.pulseSeconds,
  });
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
    const scent = senseIntensityAt(schedule, states, "scent", showTimeSeconds);
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
  }

  // The organ is a follower like the narration: the score says how strong
  // each voice stands at this instant, and the clock says what instant it is.
  function followOrgan(showTime: ShowTimeSample): void {
    for (const voice of ORGAN_VOICES) {
      voiceStrengths[voice] = organVoiceStrengthAt(
        schedule,
        ORGAN_SCORE,
        voice,
        showTime.timeSeconds,
      );
    }
    readListenerPose(world, listenerPose);
    droneOrgan.update({
      showTimeSeconds: showTime.timeSeconds,
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
      voiceStrengths,
      listener: listenerPose,
      groundYMeters: worldSurface.groundYAt(listenerPose.x, listenerPose.z),
      readGroupCenters: (group) => readActorCenters(reach, group),
    });
  }

  followWorld(0);

  return {
    update: (): void => {
      const showTime = clock.sample();
      narration.follow({
        position: narrationCueAt(schedule, showTime.timeSeconds),
        isPlaying: showTime.isPlaying,
        timeScale: showTime.timeScale,
      });
      followWorld(showTime.timeSeconds);
      followOrgan(showTime);
    },

    readActiveLevelState: () => states[activeLevel ?? openingLevel],

    running: {
      clock,
      readLanguage: () => language,
      readActiveLevel: () => activeLevel ?? openingLevel,
      readAudioState: timebase.readState,
      setLanguage: (next): void => {
        if (next === language) return;

        clock.pause();
        narration.unload();
        language = next;
        narration = createNarrationPlayer({ language, cueIds });
      },
    },
  };
}

/**
 * Read where the visitor is and which way they face, into the caller's pose.
 * The eye carries the head pose the rig published at the end of the previous
 * frame — the same frame of reference every module windows its content around.
 */
function readListenerPose(
  world: WorldContext,
  pose: MutableListenerPose,
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
