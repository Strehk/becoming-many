/**
 * Purpose: Drive one preloaded world from narration show time.
 * Context: The show changes presentation, sense strength, and module gates without rebuilding resources.
 * Responsibility: Own narration following, transitions, sense intensities, and the public show controls.
 * Boundary: Level Runtime constructs modules; concrete modules and the render loop remain elsewhere.
 */

import { Color } from "three";
import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import {
  type NarrationSchedule,
  narrationCueAt,
  type ShowLevelName,
} from "../dramaturgy/narration-schedule";
import { createShowClock, type ShowClock } from "../dramaturgy/show-clock";
import {
  levelTransitionAt,
  type ShowLevelState,
  type ShowSense,
  senseIntensityAt,
  showLevelAt,
} from "../dramaturgy/show-levels";
import type { WorldFadeEffect } from "../modules/world-fade/world-fade";
import { createAudioTimebase } from "../sound/audio-timebase";
import { createNarrationPlayer } from "../sound/narration-player";
import type { WorldModule } from "../world/module-runtime";
import type { WorldContext } from "../world/world-runtime";

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
}

export interface ShowRuntime {
  readonly update: () => void;
  readonly readActiveLevelState: () => ShowLevelState;
  readonly running: RunningShow;
}

export function createShowRuntime(
  request: ShowRequest,
  world: WorldContext,
  reach: ShowWorldReach,
): ShowRuntime {
  const { schedule, states } = request;
  const openingLevel = showLevelAt(schedule, 0);
  if (!openingLevel) throw new Error("A show schedule needs at least one cue");

  const timebase = createAudioTimebase();
  const clock = createShowClock(schedule.durationSeconds, timebase.readSeconds);
  const cueIds = schedule.narration.map((cue) => cue.cueId);
  let language = request.language;
  let narration = createNarrationPlayer({ language, cueIds });
  let activeLevel: ShowLevelName | undefined;
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
  }

  function followWorld(showTimeSeconds: number): void {
    followViewDistance(showTimeSeconds);
    followBackground(showTimeSeconds);
    followSenses(showTimeSeconds);
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
