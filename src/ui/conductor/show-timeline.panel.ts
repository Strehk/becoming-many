import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import {
  type TimelineChapter,
  timelineChapters,
} from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show-contract";
import { requireElement, writeText } from "../shared/dom";
import { cueDisplayName, formatShowTime } from "../shared/show-time-format";
import { attachScrubbing } from "../shared/transport-scrubbing";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";

type TimelineShow = Pick<
  RunningShow,
  "sample" | "play" | "pause" | "seekTo" | "readTutorial"
>;

export interface ShowTimelineOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly schedule: NarrationSchedule;
  readonly show: TimelineShow;
  /** Reports the operator's own position, or undefined when the drag ends. */
  readonly onScrubChange: (showTimeSeconds: number | undefined) => void;
}

interface ChapterView {
  chapter: TimelineChapter;
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
  let mainStartSeconds = show.sample().mainStartSeconds;
  let durationSeconds = mainStartSeconds + schedule.durationSeconds;
  const root = requireElement(parent, ".conductor__timeline", HTMLElement);
  const readout = requireElement(
    root,
    "[data-timeline-readout]",
    HTMLOutputElement,
  );
  const track = requireElement(root, ".timeline__track", SVGSVGElement);
  const slider = requireElement(
    root,
    ".conductor__timeline-slider",
    HTMLElement,
  );
  const buttons = requireElement(root, ".conductor__chapters", HTMLElement);
  const playhead = requireElement(track, ".timeline__playhead", SVGLineElement);
  const slotTemplate = requireElement(
    root,
    "[data-chapter-slot]",
    HTMLTemplateElement,
  );
  const buttonTemplate = requireElement(
    root,
    "[data-chapter-button]",
    HTMLTemplateElement,
  );
  const chapters = timelineChapters(schedule, mainStartSeconds).map(
    (chapter) => {
      const slotFragment = document.importNode(slotTemplate.content, true);
      const slot = requireElement(slotFragment, "svg", SVGSVGElement);
      const progress = requireElement(
        slot,
        ".timeline__progress",
        SVGRectElement,
      );
      slot.setAttribute(
        "x",
        `${toPercent(chapter.startSeconds, durationSeconds)}%`,
      );
      slot.setAttribute(
        "width",
        `${toPercent(chapter.endSeconds - chapter.startSeconds, durationSeconds)}%`,
      );
      requireElement(slot, "text", SVGTextElement).textContent = cueDisplayName(
        chapter.cueId,
      );
      const buttonFragment = document.importNode(buttonTemplate.content, true);
      const button = requireElement(
        buttonFragment,
        "button",
        HTMLButtonElement,
      );
      requireElement(button, "[data-name]", HTMLElement).textContent =
        cueDisplayName(chapter.cueId);
      requireElement(
        button,
        ".conductor__chapter-time",
        HTMLElement,
      ).textContent = formatShowTime(chapter.startSeconds);
      return { chapter, slot, progress, button } satisfies ChapterView;
    },
  );
  for (const view of chapters) {
    const { slot, button } = view;
    button.addEventListener(
      "click",
      () => show.seekTo(view.chapter.startSeconds),
      {
        signal,
      },
    );
    track.insertBefore(slot, playhead);
    buttons.append(button);
  }
  signal.addEventListener(
    "abort",
    () => {
      for (const view of chapters) {
        view.slot.remove();
        view.button.remove();
      }
    },
    { once: true },
  );
  attachScrubbing({
    track,
    readDurationSeconds: () => durationSeconds,
    show,
    onScrubChange,
    signal,
    isEnabled: () => !show.readTutorial(),
  });
  slider.setAttribute("aria-valuemax", String(durationSeconds));
  slider.setAttribute(
    "aria-valuetext",
    `0:00 of ${formatShowTime(durationSeconds)}`,
  );
  slider.addEventListener(
    "keydown",
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || show.readTutorial())
        return;
      const step = event.shiftKey
        ? CONDUCTOR_SETTINGS.coarseNudgeSeconds
        : CONDUCTOR_SETTINGS.nudgeSeconds;
      let seconds: number;
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          seconds = show.sample().timeSeconds - step;
          break;
        case "ArrowRight":
        case "ArrowUp":
          seconds = show.sample().timeSeconds + step;
          break;
        case "Home":
          seconds = 0;
          break;
        case "End":
          seconds = durationSeconds;
          break;
        default:
          return;
      }
      event.preventDefault();
      show.seekTo(seconds);
    },
    { signal },
  );

  return {
    update(state): void {
      slider.setAttribute("aria-disabled", String(Boolean(state.tutorial)));
      slider.tabIndex = state.tutorial ? -1 : 0;
      for (const view of chapters)
        view.button.disabled =
          Boolean(state.tutorial) || view.chapter.cueId === "tutorial";
      if (mainStartSeconds !== state.mainStartSeconds) {
        mainStartSeconds = state.mainStartSeconds;
        durationSeconds = mainStartSeconds + schedule.durationSeconds;
        const layout = timelineChapters(schedule, mainStartSeconds);
        for (const [index, view] of chapters.entries()) {
          const chapter = layout[index];
          if (!chapter) continue;
          view.chapter = chapter;
          view.slot.setAttribute(
            "x",
            `${toPercent(view.chapter.startSeconds, durationSeconds)}%`,
          );
          view.slot.setAttribute(
            "width",
            `${toPercent(view.chapter.endSeconds - view.chapter.startSeconds, durationSeconds)}%`,
          );
          requireElement(
            view.button,
            ".conductor__chapter-time",
            HTMLElement,
          ).textContent = formatShowTime(view.chapter.startSeconds);
        }
        slider.setAttribute("aria-valuemax", String(durationSeconds));
        slider.removeAttribute("aria-valuenow");
      }
      const showTimeSeconds = state.showTimeSeconds;
      writeText(
        readout,
        `${formatShowTime(showTimeSeconds)} / ${formatShowTime(durationSeconds)}`,
      );
      const accessibleSeconds = String(Math.floor(showTimeSeconds));
      if (slider.getAttribute("aria-valuenow") !== accessibleSeconds) {
        slider.setAttribute("aria-valuenow", accessibleSeconds);
        slider.setAttribute(
          "aria-valuetext",
          `${formatShowTime(showTimeSeconds)} of ${formatShowTime(durationSeconds)}`,
        );
      }

      const position = `${toPercent(showTimeSeconds, durationSeconds)}%`;
      playhead.setAttribute("x1", position);
      playhead.setAttribute("x2", position);

      for (const view of chapters) {
        const { startSeconds, endSeconds } = view.chapter;
        const isCurrent =
          showTimeSeconds >= startSeconds &&
          (showTimeSeconds < endSeconds || endSeconds === durationSeconds);
        const current = String(isCurrent);
        if (view.slot.dataset.current !== current) {
          view.slot.dataset.current = current;
          view.button.setAttribute("aria-pressed", current);
        }

        const played =
          endSeconds > startSeconds
            ? (showTimeSeconds - startSeconds) / (endSeconds - startSeconds)
            : 1;
        view.progress.setAttribute(
          "width",
          `${Math.min(Math.max(played, 0), 1) * 100}%`,
        );
      }
    },
  };
}

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
