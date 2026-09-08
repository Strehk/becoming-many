import { requireElement } from "../shared/dom";
import { attachScrubbing } from "../shared/transport-scrubbing";
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

import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import { cueSlots } from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show.runtime";
import type { ConductorPanel } from "./view-state";

type TimelineShow = Pick<RunningShow, "sample" | "play" | "pause" | "seekTo">;

import { cueDisplayName, formatShowTime } from "../shared/show-time-format";


export interface ShowTimelineOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
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
  signal,
  schedule,
  show,
  onScrubChange,
}: ShowTimelineOptions): ConductorPanel {
  const { durationSeconds } = schedule;
  const root = requireElement(parent, ".conductor__timeline", HTMLElement);
  const track = requireElement(root, ".timeline__track", SVGSVGElement);
  const buttons = requireElement(root, ".conductor__chapters", HTMLElement);
  const playhead = requireElement(track, ".timeline__playhead", SVGLineElement);
  const slotTemplate = requireElement(root, "[data-chapter-slot]", HTMLTemplateElement);
  const buttonTemplate = requireElement(root, "[data-chapter-button]", HTMLTemplateElement);
  const chapters = readChapters(schedule).map((chapter) => {
    const slotFragment = document.importNode(slotTemplate.content, true);
    const slot = requireElement(slotFragment, "svg", SVGSVGElement);
    const progress = requireElement(slot, ".timeline__progress", SVGRectElement);
    slot.setAttribute("x", `${toPercent(chapter.startSeconds, durationSeconds)}%`);
    slot.setAttribute("width", `${toPercent(chapter.endSeconds - chapter.startSeconds, durationSeconds)}%`);
    requireElement(slot, "text", SVGTextElement).textContent = cueDisplayName(chapter.cueId);
    track.insertBefore(slotFragment, playhead);
    const buttonFragment = document.importNode(buttonTemplate.content, true);
    const button = requireElement(buttonFragment, "button", HTMLButtonElement);
    requireElement(button, "[data-name]", HTMLElement).textContent = cueDisplayName(chapter.cueId);
    requireElement(button, ".conductor__chapter-time", HTMLElement).textContent = formatShowTime(chapter.startSeconds);
    button.addEventListener("click", () => show.seekTo(chapter.startSeconds), { signal });
    buttons.append(buttonFragment);
    return { chapter, slot, progress, button } satisfies ChapterView;
  });
  signal.addEventListener("abort", () => {
    for (const view of chapters) { view.slot.remove(); view.button.remove(); }
  }, { once: true });
  attachScrubbing({ track, durationSeconds, show, onScrubChange, signal });

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
        const current = String(isCurrent);
        if (view.slot.dataset.current !== current) {
          view.slot.dataset.current = current;
          view.button.setAttribute("aria-pressed", current);
        }

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

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
