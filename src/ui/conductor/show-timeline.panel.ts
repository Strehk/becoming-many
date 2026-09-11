import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import {
  type TimelineChapter,
  timelineChapters,
} from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show-contract";
import { requireElement, writeAttribute, writeText } from "../shared/dom";
import { cueDisplayName, formatShowTime } from "../shared/show-time-format";
import { attachScrubbing } from "../shared/transport-scrubbing";
import {
  showTrackFraction,
  type TimelineRun,
  TUTORIAL_TRACK_FRACTION,
  trackShowSeconds,
  tutorialReadout,
} from "../shared/tutorial-timeline";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";

type TimelineShow = Pick<RunningShow, "sample" | "play" | "pause" | "seekTo">;

export interface ShowTimelineOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly schedule: NarrationSchedule;
  readonly show?: TimelineShow;
  readonly run?: TimelineRun;
  readonly readShow?: () => TimelineShow | undefined;
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
  run,
  readShow = () => run?.show ?? show,
  onScrubChange,
}: ShowTimelineOptions): ConductorPanel {
  const hasTutorial = !!run?.readTutorial();
  const seek = (seconds: number) => {
    const available = readShow();
    if (available) available.seekTo(seconds);
    else run?.skipTutorial(seconds);
  };
  const durationSeconds = schedule.durationSeconds;
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
  const chapters = timelineChapters(schedule).map((chapter) => {
    const slotFragment = document.importNode(slotTemplate.content, true);
    const slot = requireElement(slotFragment, "svg", SVGSVGElement);
    const progress = requireElement(
      slot,
      ".timeline__progress",
      SVGRectElement,
    );
    slot.setAttribute(
      "x",
      `${showTrackFraction(chapter.startSeconds, durationSeconds, hasTutorial) * 100}%`,
    );
    slot.setAttribute(
      "width",
      `${((chapter.endSeconds - chapter.startSeconds) / durationSeconds) * (hasTutorial ? 1 - TUTORIAL_TRACK_FRACTION : 1) * 100}%`,
    );
    requireElement(slot, "text", SVGTextElement).textContent = cueDisplayName(
      chapter.cueId,
    );
    const buttonFragment = document.importNode(buttonTemplate.content, true);
    const button = requireElement(buttonFragment, "button", HTMLButtonElement);
    requireElement(button, "[data-name]", HTMLElement).textContent =
      cueDisplayName(chapter.cueId);
    requireElement(
      button,
      ".conductor__chapter-time",
      HTMLElement,
    ).textContent = formatShowTime(chapter.startSeconds);
    return { chapter, slot, progress, button } satisfies ChapterView;
  });
  const tutorialSlot = hasTutorial
    ? requireElement(
        document.importNode(slotTemplate.content, true),
        "svg",
        SVGSVGElement,
      )
    : undefined;
  const tutorialButton = hasTutorial
    ? requireElement(
        document.importNode(buttonTemplate.content, true),
        "button",
        HTMLButtonElement,
      )
    : undefined;
  if (tutorialSlot && tutorialButton) {
    tutorialButton.dataset.tutorial = "";
    tutorialSlot.dataset.tutorialBlock = "";
    tutorialSlot.setAttribute("x", "0%");
    tutorialSlot.setAttribute("width", `${TUTORIAL_TRACK_FRACTION * 100}%`);
    requireElement(tutorialSlot, "text", SVGTextElement).textContent =
      "Tutorial";
    requireElement(tutorialButton, "[data-name]", HTMLElement).textContent =
      "Tutorial";
    requireElement(
      tutorialButton,
      ".conductor__chapter-time",
      HTMLElement,
    ).textContent = "Chunks";
    tutorialButton.addEventListener("click", () => run?.resetShowAndFlight(), {
      signal,
    });
    track.insertBefore(tutorialSlot, playhead);
    buttons.append(tutorialButton);
  }
  for (const view of chapters) {
    const { slot, button } = view;
    button.addEventListener("click", () => seek(view.chapter.startSeconds), {
      signal,
    });
    track.insertBefore(slot, playhead);
    buttons.append(button);
  }
  signal.addEventListener(
    "abort",
    () => {
      tutorialSlot?.remove();
      tutorialButton?.remove();
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
    readShow,
    mapFraction: (fraction) =>
      trackShowSeconds(fraction, durationSeconds, hasTutorial),
    onUnavailableSeek: seek,
    onScrubChange,
    signal,
  });
  slider.setAttribute("aria-valuemax", String(durationSeconds));
  slider.setAttribute(
    "aria-valuetext",
    `0:00 of ${formatShowTime(durationSeconds)}`,
  );
  slider.addEventListener(
    "keydown",
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const show = readShow();
      if (!show) return;
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

  function updatePosition(
    showTimeSeconds: number,
    tutorial: ReturnType<TimelineRun["readTutorial"]>,
  ): void {
    const timeText = formatShowTime(showTimeSeconds);
    const durationText = formatShowTime(durationSeconds);
    writeText(
      readout,
      tutorial ? tutorialReadout(tutorial) : `${timeText} / ${durationText}`,
    );
    writeAttribute(
      slider,
      "aria-valuenow",
      String(Math.floor(showTimeSeconds)),
    );
    writeAttribute(
      slider,
      "aria-valuetext",
      tutorial ? tutorialReadout(tutorial) : `${timeText} of ${durationText}`,
    );
    writeAttribute(slider, "aria-disabled", String(!readShow()));
    const position = `${tutorial ? 0 : showTrackFraction(showTimeSeconds, durationSeconds, hasTutorial) * 100}%`;
    writeAttribute(playhead, "x1", position);
    writeAttribute(playhead, "x2", position);
  }

  function updateChapters(showTimeSeconds: number, isTutorial: boolean): void {
    if (tutorialSlot)
      writeAttribute(tutorialSlot, "data-current", String(isTutorial));
    for (const view of chapters) {
      const { startSeconds, endSeconds } = view.chapter;
      const isCurrent =
        !isTutorial &&
        showTimeSeconds >= startSeconds &&
        (showTimeSeconds < endSeconds || endSeconds === durationSeconds);
      writeAttribute(view.slot, "data-current", String(isCurrent));
      writeAttribute(view.button, "aria-pressed", String(isCurrent));
      const played =
        endSeconds > startSeconds
          ? (showTimeSeconds - startSeconds) / (endSeconds - startSeconds)
          : 1;
      writeAttribute(
        view.progress,
        "width",
        `${isTutorial ? 0 : Math.min(Math.max(played, 0), 1) * 100}%`,
      );
    }
  }

  return {
    update(state): void {
      const tutorial = run?.readTutorial();
      updatePosition(state.showTimeSeconds, tutorial);
      updateChapters(state.showTimeSeconds, !!tutorial);
    },
  };
}
