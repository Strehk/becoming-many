/**
 * Purpose: Turn the running level into the operator's command surface.
 * Context: The page hosts the show in-process; buttons and keys command it.
 * Responsibility: Name every operator action and apply it to clock and level.
 * Boundary: The show clock stays the authority; nothing here tracks show time.
 */

import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type { RunningLevel, RunningShow } from "../levels/level-runtime";

export interface ShowActions {
  readonly play: () => void;
  readonly pause: () => void;
  readonly seekTo: (showTimeSeconds: number) => void;
  readonly seekBy: (offsetSeconds: number) => void;
  readonly setTimeScale: (timeScale: number) => void;
  readonly setLanguage: (language: NarrationLanguage) => void;
  /** Rewind and hold, so the next thing the operator does is press play. */
  readonly resetShow: () => void;
  readonly resetFlight: () => void;
  /**
   * The between-visitors soft reset: rewind, return the flight to the start
   * pose, and play from the top. The built world keeps running throughout.
   */
  readonly restartExperience: () => void;
  /** Point the show at an M5 controller; an empty host stops polling. */
  readonly setM5Host: (host: string) => void;
  readonly reloadShow: () => void;
}

export function createShowActions(
  level: RunningLevel,
  show: RunningShow,
): ShowActions {
  return {
    play: () => show.clock.play(),
    pause: () => show.clock.pause(),
    seekTo: (showTimeSeconds) => show.clock.seekTo(showTimeSeconds),
    seekBy: (offsetSeconds) => show.clock.seekBy(offsetSeconds),
    setTimeScale: (timeScale) => show.clock.setTimeScale(timeScale),
    setLanguage: (language) => show.setLanguage(language),

    resetShow: () => {
      show.clock.seekTo(0);
      show.clock.pause();
    },

    resetFlight: () => level.resetFlight(),

    restartExperience: () => {
      show.clock.seekTo(0);
      level.resetFlight();
      show.clock.play();
    },

    setM5Host: (host) => level.m5?.setHost(host),

    reloadShow: () => window.location.reload(),
  };
}
