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
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import type { ShowActions } from "./show-actions";
import { cueDisplayName, formatShowTime } from "./time-format";

const MILLISECONDS_PER_SECOND = 1_000;

export interface ShowTimelineOptions {
  readonly parent: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly actions: ShowActions;
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
  readonly slot: HTMLElement;
  readonly progress: HTMLElement;
  readonly button: HTMLButtonElement;
}

export function createShowTimeline({
  parent,
  schedule,
  actions,
  onScrubChange,
}: ShowTimelineOptions): ConductorPanel {
  const { durationSeconds } = schedule;
  const root = document.createElement("section");
  root.className = "conductor__timeline";
  root.setAttribute("aria-label", "Show timeline");

  const track = document.createElement("div");
  track.className = "timeline__track";

  const buttons = document.createElement("div");
  buttons.className = "conductor__chapters";

  const chapters = readChapters(schedule).map((chapter) =>
    createChapterView(track, buttons, chapter, durationSeconds, actions),
  );

  const playhead = document.createElement("div");
  playhead.className = "timeline__playhead";
  track.append(playhead);
  root.append(track, buttons);
  parent.append(root);

  attachScrubbing({ track, durationSeconds, actions, onScrubChange });

  return {
    update(state): void {
      const showTimeSeconds = state.showTimeSeconds;

      // The scrub gesture reads this to know whether to resume afterwards.
      track.dataset.playing = String(state.snapshot.isPlaying);
      playhead.style.left = `${toPercent(showTimeSeconds, durationSeconds)}%`;

      for (const view of chapters) {
        const { startSeconds, endSeconds } = view.chapter;
        const isCurrent =
          showTimeSeconds >= startSeconds && showTimeSeconds < endSeconds;
        view.slot.dataset.current = String(isCurrent);
        view.button.setAttribute("aria-pressed", String(isCurrent));

        const played =
          (showTimeSeconds - startSeconds) / (endSeconds - startSeconds);
        view.progress.style.width = `${Math.min(Math.max(played, 0), 1) * 100}%`;
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
  track: HTMLElement,
  buttons: HTMLElement,
  chapter: Chapter,
  durationSeconds: number,
  actions: ShowActions,
): ChapterView {
  const slot = document.createElement("div");
  slot.className = "timeline__slot";
  slot.style.left = `${toPercent(chapter.startSeconds, durationSeconds)}%`;
  slot.style.width = `${toPercent(
    chapter.endSeconds - chapter.startSeconds,
    durationSeconds,
  )}%`;

  const name = document.createElement("span");
  name.className = "timeline__slot-name";
  name.textContent = cueDisplayName(chapter.cueId);

  const progress = document.createElement("div");
  progress.className = "timeline__progress";

  slot.append(name, progress);
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
  button.addEventListener("click", () => actions.seekTo(chapter.startSeconds));
  buttons.append(button);

  return { chapter, slot, progress, button };
}

interface ScrubbingOptions {
  readonly track: HTMLElement;
  readonly durationSeconds: number;
  readonly actions: ShowActions;
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
  actions,
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
    wasPlaying = track.dataset.playing === "true";
    if (wasPlaying) actions.pause();

    const showTimeSeconds = readShowTime(event);
    lastSentMilliseconds = performance.now();
    onScrubChange(showTimeSeconds);
    actions.seekTo(showTimeSeconds);
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
    actions.seekTo(showTimeSeconds);
  });

  function endScrub(event: PointerEvent): void {
    if (!track.hasPointerCapture(event.pointerId)) return;

    track.releasePointerCapture(event.pointerId);
    // The throttle can have swallowed the last move, so land it exactly.
    actions.seekTo(readShowTime(event));
    if (wasPlaying) actions.play();
    wasPlaying = false;
    onScrubChange(undefined);
  }

  track.addEventListener("pointerup", endScrub);
  track.addEventListener("pointercancel", endScrub);
}

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
