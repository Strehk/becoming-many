/**
 * Purpose: Draw the schedule as chapters and let the operator move by touch.
 * Context: Recovering a lost cue means one tap on a chapter, or a drag on
 *   the track — the two gestures front-of-house staff actually use.
 * Responsibility: Render chapter slots, their played progress, the playhead,
 *   and the chapter buttons; seek on tap and drag.
 * Boundary: Slot arithmetic belongs to the dramaturgy layout, never to this
 *   file. Recording lengths and headroom are a tuning concern, verified in
 *   tests/dramaturgy — this panel shows progress, not takes.
 */

import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { cueSlots } from "../dramaturgy/schedule-layout";
import type { RunningShow } from "../levels/show.runtime";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";

type TimelineShow = Pick<RunningShow, "sample" | "play" | "pause" | "seekTo">;

import { cueDisplayName, formatShowTime } from "./time-format";

const MILLISECONDS_PER_SECOND = 1_000;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export interface ShowTimelineOptions {
  readonly parent: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly show: TimelineShow;
  /** Reports the operator's own position, or undefined when the drag ends. */
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
}

/**
 * A chapter as the operator sees it: the schedule's cue slot, with the silent
 * pre-roll before the first word folded into the first chapter so the track
 * never shows an unnamed gap and "now" is defined from 0:00.
 */
interface Chapter {
  readonly cueId: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

interface ChapterView {
  readonly chapter: Chapter;
  readonly slot: SVGSVGElement;
  readonly progress: SVGRectElement;
  readonly button: HTMLButtonElement;
}

export function createShowTimeline({
  parent,
  schedule,
  show,
  onScrubChange,
}: ShowTimelineOptions): ConductorPanel {
  const { durationSeconds } = schedule;
  const root = document.createElement("section");
  root.className = "conductor__timeline";
  root.setAttribute("aria-label", "Show timeline");

  const track = document.createElementNS(SVG_NAMESPACE, "svg");
  track.classList.add("timeline__track");
  track.setAttribute("aria-hidden", "true");

  const buttons = document.createElement("div");
  buttons.className = "conductor__chapters";

  const chapters = readChapters(schedule).map((chapter) =>
    createChapterView(track, buttons, chapter, durationSeconds, show),
  );

  const playhead = document.createElementNS(SVG_NAMESPACE, "line");
  playhead.classList.add("timeline__playhead");
  playhead.setAttribute("y2", "100%");
  track.append(playhead);
  root.append(track, buttons);
  parent.append(root);

  attachScrubbing({ track, durationSeconds, show, onScrubChange });

  return {
    update(state): void {
      const showTimeSeconds = state.showTimeSeconds;

      const position = `${toPercent(showTimeSeconds, durationSeconds)}%`;
      playhead.setAttribute("x1", position);
      playhead.setAttribute("x2", position);

      for (const view of chapters) {
        const { startSeconds, endSeconds } = view.chapter;
        const isCurrent =
          showTimeSeconds >= startSeconds && showTimeSeconds < endSeconds;
        view.slot.dataset.current = String(isCurrent);
        view.button.setAttribute("aria-pressed", String(isCurrent));

        const played =
          (showTimeSeconds - startSeconds) / (endSeconds - startSeconds);
        view.progress.setAttribute(
          "width",
          `${Math.min(Math.max(played, 0), 1) * 100}%`,
        );
      }
    },
  };
}

/** The slot layout with the pre-roll folded into the first chapter. */
function readChapters(schedule: NarrationSchedule): readonly Chapter[] {
  // The slots are shared between languages; only recording lengths differ,
  // and those are not this panel's concern.
  return cueSlots(schedule, "en").map((slot, index) => ({
    cueId: slot.cueId,
    startSeconds: index === 0 ? 0 : slot.atSeconds,
    endSeconds: slot.atSeconds + slot.slotSeconds,
  }));
}

function createChapterView(
  track: SVGSVGElement,
  buttons: HTMLElement,
  chapter: Chapter,
  durationSeconds: number,
  show: TimelineShow,
): ChapterView {
  const slot = document.createElementNS(SVG_NAMESPACE, "svg");
  slot.classList.add("timeline__slot");
  slot.setAttribute(
    "x",
    `${toPercent(chapter.startSeconds, durationSeconds)}%`,
  );
  slot.setAttribute(
    "width",
    `${toPercent(chapter.endSeconds - chapter.startSeconds, durationSeconds)}%`,
  );
  const background = document.createElementNS(SVG_NAMESPACE, "rect");
  background.classList.add("timeline__slot-background");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  const name = document.createElementNS(SVG_NAMESPACE, "text");
  name.classList.add("timeline__slot-name");
  name.setAttribute("x", "10");
  name.setAttribute("y", "21");
  name.textContent = cueDisplayName(chapter.cueId);
  const progress = document.createElementNS(SVG_NAMESPACE, "rect");
  progress.classList.add("timeline__progress");
  progress.setAttribute("y", "60");
  progress.setAttribute("height", "24");
  slot.append(background, progress, name);
  track.append(slot);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "conductor__chapter-button";

  const buttonName = document.createElement("span");
  buttonName.textContent = cueDisplayName(chapter.cueId);
  const buttonTime = document.createElement("span");
  buttonTime.className = "conductor__chapter-time";
  buttonTime.textContent = formatShowTime(chapter.startSeconds);

  button.append(buttonName, buttonTime);
  button.addEventListener("click", () => show.seekTo(chapter.startSeconds));
  buttons.append(button);

  return { chapter, slot, progress, button };
}

interface ScrubbingOptions {
  readonly track: SVGSVGElement;
  readonly durationSeconds: number;
  readonly show: TimelineShow;
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
}

/**
 * A drag pauses the show for its duration. Seeking a playing show would make
 * the narration player re-seek and restart its element on every step; against
 * a paused one the playhead simply moves, which is what scrubbing should feel
 * like. The prior transport state is restored when the drag ends.
 */
function attachScrubbing({
  track,
  durationSeconds,
  show,
  onScrubChange,
}: ScrubbingOptions): void {
  let wasPlaying = false;
  let lastSentMilliseconds = 0;

  function readShowTime(event: PointerEvent): number {
    const bounds = track.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left) / bounds.width;

    return Math.min(Math.max(fraction, 0), 1) * durationSeconds;
  }

  track.addEventListener("pointerdown", (event) => {
    track.setPointerCapture(event.pointerId);
    wasPlaying = show.sample().isPlaying;
    if (wasPlaying) show.pause();

    const showTimeSeconds = readShowTime(event);
    lastSentMilliseconds = performance.now();
    onScrubChange(showTimeSeconds);
    show.seekTo(showTimeSeconds);
  });

  track.addEventListener("pointermove", (event) => {
    if (!track.hasPointerCapture(event.pointerId)) return;

    const showTimeSeconds = readShowTime(event);
    onScrubChange(showTimeSeconds);

    const now = performance.now();
    const intervalMilliseconds =
      MILLISECONDS_PER_SECOND / CONDUCTOR_SETTINGS.scrubHertz;
    if (now - lastSentMilliseconds < intervalMilliseconds) return;

    lastSentMilliseconds = now;
    show.seekTo(showTimeSeconds);
  });

  function endScrub(event: PointerEvent): void {
    if (!track.hasPointerCapture(event.pointerId)) return;

    track.releasePointerCapture(event.pointerId);
    // The throttle can have swallowed the last move, so land it exactly.
    show.seekTo(readShowTime(event));
    if (wasPlaying) show.play();
    wasPlaying = false;
    onScrubChange(undefined);
  }

  track.addEventListener("pointerup", endScrub);
  track.addEventListener("pointercancel", endScrub);
}

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
