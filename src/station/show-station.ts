/**
 * Purpose: Let the show window be commanded from the conductor page.
 * Context: The operator runs the piece from the station's second monitor.
 * Responsibility: Apply arriving commands and report show state on a fixed beat.
 * Boundary: The show clock stays the authority; this only relays to and from it.
 */

import type { RunningLevel, RunningShow } from "../levels/level-runtime";
import { createStationLink, type StationLink } from "./station-link";
import type { ShowCommand } from "./station-protocol";
import { STATION_SETTINGS } from "./station-settings";

const MILLISECONDS_PER_SECOND = 1_000;

export interface ShowStationOptions {
  readonly level: RunningLevel;
  readonly show: RunningShow;
  readonly stationUrl: string;
  /** Reports this window's own socket; the corner widget displays it. */
  readonly onConnectionChange?: (isConnected: boolean) => void;
}

/**
 * Fails soft by design: with no broker running, the link retries quietly and
 * the piece plays exactly as it does without a station.
 */
export function connectShowStation({
  level,
  show,
  stationUrl,
  onConnectionChange,
}: ShowStationOptions): StationLink {
  const link = createStationLink({
    role: "show",
    stationUrl,
    onConnectionChange,
    onMessage: (message) => {
      // Status and presence describe the show; they are never sent to it.
      if (message.kind === "status" || message.kind === "presence") return;

      applyCommand(message, level, show);
      // Answer immediately rather than at the next beat, so a button on the
      // conductor lights up as soon as the show has actually obeyed it.
      publish();
    },
  });

  function publish(): void {
    const showTime = show.clock.sample();
    const metrics = level.readFrameMetrics();

    link.send({
      kind: "status",
      showTimeSeconds: showTime.timeSeconds,
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
      language: show.readLanguage(),
      // The world state the timeline currently holds, not a startup preset:
      // the operator watches it change as the show moves through its cues.
      levelName: show.readActiveLevel(),
      audioState: show.readAudioState(),
      framesPerSecond: metrics?.framesPerSecond,
      p95Milliseconds: metrics?.p95Milliseconds,
    });
  }

  // Published on a timer rather than from the render loop. Show time derives
  // from the audio clock, which keeps running when the window is unfocused or
  // occluded and its animation frames stop — so a status on a beat stays true
  // where a status per frame would simply stop arriving.
  const publishTimer = setInterval(
    publish,
    MILLISECONDS_PER_SECOND / STATION_SETTINGS.statusHertz,
  );

  return {
    send: link.send,
    isConnected: link.isConnected,
    unload(): void {
      clearInterval(publishTimer);
      link.unload();
    },
  };
}

/**
 * One exhaustive switch over the command union, which reads as high branching
 * but is a single decision: every arm is one call, and the compiler proves the
 * set is covered. Splitting it would hide which commands exist.
 */
// fallow-ignore-next-line complexity
function applyCommand(
  command: ShowCommand,
  level: RunningLevel,
  show: RunningShow,
): void {
  switch (command.kind) {
    case "play":
      show.clock.play();
      return;
    case "pause":
      show.clock.pause();
      return;
    case "seekTo":
      show.clock.seekTo(command.showTimeSeconds);
      return;
    case "seekBy":
      show.clock.seekBy(command.offsetSeconds);
      return;
    case "setTimeScale":
      show.clock.setTimeScale(command.timeScale);
      return;
    case "setLanguage":
      show.setLanguage(command.language);
      return;
    case "resetShow":
      // Rewind and hold, so the next thing the operator does is press play.
      show.clock.seekTo(0);
      show.clock.pause();
      return;
    case "resetFlight":
      level.resetFlight();
      return;
    case "reloadShow":
      window.location.reload();
      return;
  }
}
