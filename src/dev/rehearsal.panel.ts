/**
 * Purpose: Give the rehearsal page the two moves a run-through needs — scrub
 *   the show, and jump to a section.
 * Context: The default page plays the piece full-window, without the conductor
 *   page's operator surface; rehearsing a cue there otherwise means reloading.
 * Responsibility: Mount one bar that reflects show time and commands the show.
 * Boundary: The show clock stays the authority; nothing here tracks show time.
 *   Slot arithmetic belongs to the dramaturgy layout.
 */

import {
  NARRATION_LANGUAGES,
  type NarrationLanguage,
} from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { cueSlots } from "../dramaturgy/schedule-layout";
import type { RunningShow } from "../levels/show.runtime";

const SECONDS_PER_MINUTE = 60;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// The playhead is placed to a tenth of a percent — under half a second of an
// eight-minute show, and finer than the track can show. Rounding to it is what
// lets the loop below skip the DOM on almost every frame.
const PLAYHEAD_DECIMALS = 1;

export interface RehearsalTransportOptions {
  readonly container: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly show: Pick<
    RunningShow,
    | "sample"
    | "togglePlayback"
    | "play"
    | "pause"
    | "seekTo"
    | "readLanguage"
    | "setLanguage"
  >;
}

/**
 * Deliberately pointer-only. The arrow keys steer the flight on this page,
 * and a transport that also took them would fight the controls the page
 * exists to try out; the conductor page is where the keyboard map lives.
 */
export function mountRehearsalTransport({
  container,
  schedule,
  show,
}: RehearsalTransportOptions): () => void {
  const { durationSeconds } = schedule;

  const bar = document.createElement("div");
  bar.className = "rehearsal";

  const topRow = document.createElement("div");
  topRow.className = "rehearsal__top-row";

  const transportButton = createBarButton("Hold");
  transportButton.className = "rehearsal__transport";

  const readout = document.createElement("output");
  readout.className = "rehearsal__readout";

  const track = createTrack();
  const playhead = document.createElementNS(SVG_NAMESPACE, "line");
  playhead.classList.add("rehearsal__playhead");
  playhead.setAttribute("y2", "100%");
  track.append(playhead);

  const languageSwitch = createLanguageSwitch(
    show.readLanguage,
    show.setLanguage,
  );

  topRow.append(transportButton, readout, track, ...languageSwitch.buttons);

  const sections = document.createElement("div");
  sections.className = "rehearsal__sections";

  // The slots are shared between languages; only recording lengths differ,
  // and those are not this bar's concern.
  cueSlots(schedule, "en").forEach((slot, index) => {
    // The pre-roll before the first word belongs to the first section: from
    // 0:00 the piece is already underway.
    const startSeconds = index === 0 ? 0 : slot.atSeconds;

    const button = createBarButton(sectionName(slot.cueId));
    button.addEventListener("click", () => show.seekTo(startSeconds));
    sections.append(button);

    track.append(createSectionTick(startSeconds, durationSeconds));
  });

  bar.append(topRow, sections);
  container.append(bar);

  transportButton.addEventListener("click", show.togglePlayback);

  // The dragged position while scrubbing; it wins over the clock, which is
  // sampled a frame behind the pointer.
  let scrubSeconds: number | undefined;

  attachScrubbing({
    track,
    durationSeconds,
    show,
    onScrubChange: (showTimeSeconds) => {
      scrubSeconds = showTimeSeconds;
    },
  });

  // What the bar last wrote, so a frame that changes nothing touches no DOM.
  let renderedPlaying: boolean | undefined;
  let renderedText: string | undefined;
  let renderedPlayheadLeft: string | undefined;

  function draw(): void {
    const sample = show.sample();
    const showTimeSeconds = scrubSeconds ?? sample.timeSeconds;

    if (renderedPlaying !== sample.isPlaying) {
      renderedPlaying = sample.isPlaying;
      transportButton.textContent = sample.isPlaying ? "Hold" : "Play";
    }

    const text = `${formatShowTime(showTimeSeconds)} / ${formatShowTime(
      durationSeconds,
    )}`;
    if (renderedText !== text) {
      renderedText = text;
      readout.textContent = text;
    }

    const playheadLeft = `${toPercent(showTimeSeconds, durationSeconds).toFixed(
      PLAYHEAD_DECIMALS,
    )}%`;
    if (renderedPlayheadLeft !== playheadLeft) {
      renderedPlayheadLeft = playheadLeft;
      playhead.setAttribute("x1", playheadLeft);
      playhead.setAttribute("x2", playheadLeft);
    }

    languageSwitch.draw();

    animationFrame = requestAnimationFrame(draw);
  }

  let animationFrame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(animationFrame);
    bar.remove();
  };
}

interface LanguageSwitch {
  readonly buttons: readonly HTMLButtonElement[];
  /** Repaints only when the armed language changed, like the rest of the bar. */
  readonly draw: () => void;
}

/**
 * One button per narration language, the armed one shown inverted. Switching
 * narration holds the show, the same move the conductor's language buttons
 * make; the transport button then resumes the run.
 */
function createLanguageSwitch(
  readLanguage: () => NarrationLanguage,
  setLanguage: (language: NarrationLanguage) => void,
): LanguageSwitch {
  const buttons = NARRATION_LANGUAGES.map((language) => {
    const button = createBarButton(language.toUpperCase());
    button.addEventListener("click", () => setLanguage(language));
    return button;
  });

  let renderedLanguage: NarrationLanguage | undefined;

  return {
    buttons,
    draw: (): void => {
      const language = readLanguage();
      if (renderedLanguage === language) return;

      renderedLanguage = language;
      buttons.forEach((button, index) => {
        const isActive = NARRATION_LANGUAGES[index] === language;
        button.setAttribute("aria-pressed", String(isActive));
      });
    },
  };
}

interface ScrubbingOptions {
  readonly track: SVGSVGElement;
  readonly durationSeconds: number;
  readonly show: Pick<RunningShow, "sample" | "play" | "pause" | "seekTo">;
  /** Reports the dragged position, or undefined when the drag ends. */
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
}

/**
 * A drag holds the show for its duration and restores the prior transport
 * state when it ends: seeking a playing show makes the narration chase the
 * pointer, while against a held one the playhead simply follows the finger.
 */
function attachScrubbing({
  track,
  durationSeconds,
  show,
  onScrubChange,
}: ScrubbingOptions): void {
  let wasPlaying = false;

  function readShowTime(event: PointerEvent): number {
    const bounds = track.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left) / bounds.width;

    return Math.min(Math.max(fraction, 0), 1) * durationSeconds;
  }

  function seek(event: PointerEvent): void {
    const showTimeSeconds = readShowTime(event);
    onScrubChange(showTimeSeconds);
    show.seekTo(showTimeSeconds);
  }

  track.addEventListener("pointerdown", (event) => {
    track.setPointerCapture(event.pointerId);
    wasPlaying = show.sample().isPlaying;
    if (wasPlaying) show.pause();
    seek(event);
  });

  track.addEventListener("pointermove", (event) => {
    if (!track.hasPointerCapture(event.pointerId)) return;

    seek(event);
  });

  function endScrub(event: PointerEvent): void {
    if (!track.hasPointerCapture(event.pointerId)) return;

    track.releasePointerCapture(event.pointerId);
    show.seekTo(readShowTime(event));
    if (wasPlaying) show.play();
    wasPlaying = false;
    onScrubChange(undefined);
  }

  track.addEventListener("pointerup", endScrub);
  track.addEventListener("pointercancel", endScrub);
}

/** Where a section begins, drawn on the track so a drag can aim at it. */
function createSectionTick(
  startSeconds: number,
  durationSeconds: number,
): SVGLineElement {
  const tick = document.createElementNS(SVG_NAMESPACE, "line");
  tick.classList.add("rehearsal__tick");
  const position = `${toPercent(startSeconds, durationSeconds)}%`;
  tick.setAttribute("x1", position);
  tick.setAttribute("x2", position);
  tick.setAttribute("y2", "100%");
  return tick;
}

function createTrack(): SVGSVGElement {
  const track = document.createElementNS(SVG_NAMESPACE, "svg");
  track.classList.add("rehearsal__track");
  track.setAttribute("aria-hidden", "true");
  return track;
}

function createBarButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return button;
}

/** A cue id reads as a section name: "prologue" is the section "Prologue". */
function sectionName(cueId: string): string {
  return cueId.charAt(0).toUpperCase() + cueId.slice(1);
}

/** Minutes and seconds, always two digits of seconds. */
function formatShowTime(seconds: number): string {
  const whole = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const remainder = whole % SECONDS_PER_MINUTE;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
