/**
 * Purpose: Give the rehearsal page the two moves a run-through needs — scrub
 *   the show, and jump to a section.
 * Context: The default page plays the piece full-window, without the conductor
 *   page's operator surface; rehearsing a cue there otherwise means reloading.
 * Responsibility: Mount one bar that reflects show time and commands the clock.
 * Boundary: The show clock stays the authority; nothing here tracks show time.
 *   Slot arithmetic belongs to the dramaturgy layout.
 */

import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { cueSlots } from "../dramaturgy/schedule-layout";
import type { ShowClock } from "../dramaturgy/show-clock";

const SECONDS_PER_MINUTE = 60;

// The playhead is placed to a tenth of a percent — under half a second of an
// eight-minute show, and finer than the track can show. Rounding to it is what
// lets the loop below skip the DOM on almost every frame.
const PLAYHEAD_DECIMALS = 1;

export interface RehearsalTransportOptions {
  readonly container: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly clock: ShowClock;
}

/**
 * Deliberately pointer-only. The arrow keys steer the flight on this page,
 * and a transport that also took them would fight the controls the page
 * exists to try out; the conductor page is where the keyboard map lives.
 */
export function mountRehearsalTransport({
  container,
  schedule,
  clock,
}: RehearsalTransportOptions): void {
  const { durationSeconds } = schedule;

  const bar = document.createElement("div");
  // Styled inline for the same reason the VR entry button is: this page has
  // no UI stylesheet, and dark controls stay readable on the bright canvas.
  bar.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "right:0",
    "z-index:10",
    "display:flex",
    "flex-direction:column",
    "gap:8px",
    "padding:10px 12px",
    "background:rgba(255,255,255,0.85)",
    "color:#111111",
    "font:13px sans-serif",
  ].join(";");

  const topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;align-items:center;gap:12px";

  const transportButton = createBarButton("Hold");
  transportButton.style.minWidth = "64px";

  const readout = document.createElement("output");
  readout.style.cssText = "min-width:96px;font-variant-numeric:tabular-nums";

  const track = createTrack();
  const playhead = document.createElement("div");
  playhead.style.cssText = [
    "position:absolute",
    "top:0",
    "bottom:0",
    "width:2px",
    "margin-left:-1px",
    "background:#111111",
    "pointer-events:none",
  ].join(";");
  track.append(playhead);

  topRow.append(transportButton, readout, track);

  const sections = document.createElement("div");
  sections.style.cssText = "display:flex;flex-wrap:wrap;gap:6px";

  // The slots are shared between languages; only recording lengths differ,
  // and those are not this bar's concern.
  cueSlots(schedule, "en").forEach((slot, index) => {
    // The pre-roll before the first word belongs to the first section: from
    // 0:00 the piece is already underway.
    const startSeconds = index === 0 ? 0 : slot.atSeconds;

    const button = createBarButton(sectionName(slot.cueId));
    button.addEventListener("click", () => clock.seekTo(startSeconds));
    sections.append(button);

    track.append(createSectionTick(startSeconds, durationSeconds));
  });

  bar.append(topRow, sections);
  container.append(bar);

  transportButton.addEventListener("click", () => {
    if (clock.sample().isPlaying) clock.pause();
    else clock.play();
  });

  // The dragged position while scrubbing; it wins over the clock, which is
  // sampled a frame behind the pointer.
  let scrubSeconds: number | undefined;

  attachScrubbing({
    track,
    durationSeconds,
    clock,
    onScrubChange: (showTimeSeconds) => {
      scrubSeconds = showTimeSeconds;
    },
  });

  // What the bar last wrote, so a frame that changes nothing touches no DOM.
  let renderedPlaying: boolean | undefined;
  let renderedText: string | undefined;
  let renderedPlayheadLeft: string | undefined;

  function draw(): void {
    const sample = clock.sample();
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
      playhead.style.left = playheadLeft;
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

interface ScrubbingOptions {
  readonly track: HTMLElement;
  readonly durationSeconds: number;
  readonly clock: ShowClock;
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
  clock,
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
    clock.seekTo(showTimeSeconds);
  }

  track.addEventListener("pointerdown", (event) => {
    track.setPointerCapture(event.pointerId);
    wasPlaying = clock.sample().isPlaying;
    if (wasPlaying) clock.pause();
    seek(event);
  });

  track.addEventListener("pointermove", (event) => {
    if (!track.hasPointerCapture(event.pointerId)) return;

    seek(event);
  });

  function endScrub(event: PointerEvent): void {
    if (!track.hasPointerCapture(event.pointerId)) return;

    track.releasePointerCapture(event.pointerId);
    clock.seekTo(readShowTime(event));
    if (wasPlaying) clock.play();
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
): HTMLElement {
  const tick = document.createElement("div");
  tick.style.cssText = [
    "position:absolute",
    "top:0",
    "bottom:0",
    "width:1px",
    `left:${toPercent(startSeconds, durationSeconds)}%`,
    "background:rgba(17,17,17,0.35)",
    "pointer-events:none",
  ].join(";");

  return tick;
}

function createTrack(): HTMLElement {
  const track = document.createElement("div");
  track.style.cssText = [
    "position:relative",
    "flex:1",
    "height:26px",
    "border:1px solid #111111",
    "border-radius:4px",
    "background:rgba(255,255,255,0.6)",
    "touch-action:none",
    "cursor:pointer",
  ].join(";");

  return track;
}

function createBarButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText = [
    "padding:6px 10px",
    "border:1px solid #111111",
    "border-radius:4px",
    "background:rgba(255,255,255,0.85)",
    "color:#111111",
    "font:13px sans-serif",
    "cursor:pointer",
  ].join(";");

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
