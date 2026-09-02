/**
 * Purpose: Pin the operator actions to the clock and level calls they make.
 * Context: The conductor page commands the show it hosts through this surface.
 * Responsibility: Cover the composite actions' call order and the delegations.
 * Boundary: Clock arithmetic is tested with the show clock, not here.
 */

import { describe, expect, test } from "bun:test";
import { createShowActions } from "../../src/conductor/show-actions";
import type { RunningLevel, RunningShow } from "../../src/levels/level-runtime";

interface Recorder {
  readonly calls: string[];
  readonly level: RunningLevel;
  readonly show: RunningShow;
}

function createRecorder(): Recorder {
  const calls: string[] = [];

  const show: RunningShow = {
    clock: {
      sample: () => ({ timeSeconds: 0, isPlaying: false, timeScale: 1 }),
      play: () => calls.push("play"),
      pause: () => calls.push("pause"),
      seekTo: (showTimeSeconds) => calls.push(`seekTo:${showTimeSeconds}`),
      seekBy: (offsetSeconds) => calls.push(`seekBy:${offsetSeconds}`),
      setTimeScale: (timeScale) => calls.push(`setTimeScale:${timeScale}`),
    },
    readLanguage: () => "en",
    readActiveLevel: () => "white-world",
    setLanguage: (language) => calls.push(`setLanguage:${language}`),
    readAudioState: () => "running",
  };

  const level: RunningLevel = {
    show,
    resetFlight: () => calls.push("resetFlight"),
    readFrameMetrics: () => undefined,
    m5: undefined,
    xr: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      subscribe: () => () => undefined,
    },
  };

  return { calls, level, show };
}

describe("createShowActions", () => {
  test("restartExperience rewinds, resets the flight, then plays", () => {
    const { calls, level, show } = createRecorder();

    createShowActions(level, show).restartExperience();

    expect(calls).toEqual(["seekTo:0", "resetFlight", "play"]);
  });

  test("resetShow rewinds and holds", () => {
    const { calls, level, show } = createRecorder();

    createShowActions(level, show).resetShow();

    expect(calls).toEqual(["seekTo:0", "pause"]);
  });

  test("transport and language actions delegate one to one", () => {
    const { calls, level, show } = createRecorder();
    const actions = createShowActions(level, show);

    actions.play();
    actions.pause();
    actions.seekTo(42);
    actions.seekBy(-5);
    actions.setTimeScale(2);
    actions.setLanguage("de");
    actions.resetFlight();

    expect(calls).toEqual([
      "play",
      "pause",
      "seekTo:42",
      "seekBy:-5",
      "setTimeScale:2",
      "setLanguage:de",
      "resetFlight",
    ]);
  });

  test("setM5Host tolerates a build without the adapter", () => {
    const { level, show } = createRecorder();

    expect(() =>
      createShowActions(level, show).setM5Host("m5.local"),
    ).not.toThrow();
  });
});
