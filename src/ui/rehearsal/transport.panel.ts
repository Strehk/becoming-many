import {
  NARRATION_LANGUAGES,
  type NarrationLanguage,
} from "../../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import { timelineChapters } from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show-contract";
import { requireElement, writeText } from "../shared/dom";
import { cueDisplayName, formatShowTime } from "../shared/show-time-format";
import { attachScrubbing } from "../shared/transport-scrubbing";
import {
  showTrackFraction,
  type TimelineRun,
  TUTORIAL_TRACK_FRACTION,
  trackShowSeconds,
  tutorialReadout,
} from "../shared/tutorial-timeline";

export interface RehearsalTransportOptions {
  readonly container: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly run?: TimelineRun;
  readonly show?: Pick<
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

// A tenth of a percent is finer than the track displays; cache writes at that precision.
const PLAYHEAD_DECIMALS = 1;

/**
 * Bind the declared rehearsal bar. Scrubbing is pointer-only because arrow keys
 * steer flight here. Cleanup ends gestures, listeners and this UI's frame reads.
 */
export function mountRehearsalTransport({
  container,
  schedule,
  show: initialShow,
  run,
}: RehearsalTransportOptions): () => void {
  const readShow = () => run?.show ?? initialShow;
  const hasTutorial = !!run?.readTutorial();
  const seek = (seconds: number) => {
    const show = readShow();
    if (show) show.seekTo(seconds);
    else run?.skipTutorial(seconds);
  };
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const durationSeconds = schedule.durationSeconds;
  const bar = requireElement(container, "[data-rehearsal]", HTMLElement);
  const transportButton = requireElement(
    bar,
    "[data-transport]",
    HTMLButtonElement,
  );
  const readout = requireElement(bar, "[data-readout]", HTMLOutputElement);
  const track = requireElement(bar, "[data-track]", SVGSVGElement);
  const tutorialBlock = requireElement(
    track,
    "[data-tutorial-block]",
    SVGRectElement,
  );
  tutorialBlock.setAttribute(
    "width",
    `${hasTutorial ? TUTORIAL_TRACK_FRACTION * 100 : 0}%`,
  );
  const playhead = requireElement(track, "[data-playhead]", SVGLineElement);
  const sections = requireElement(bar, "[data-sections]", HTMLElement);
  const sectionTemplate = requireElement(
    bar,
    "[data-section-template]",
    HTMLTemplateElement,
  );
  const tickTemplate = requireElement(
    bar,
    "[data-tick-template]",
    HTMLTemplateElement,
  );
  const languageButtons = NARRATION_LANGUAGES.map((language) => ({
    language,
    button: requireElement(
      bar,
      `[data-language="${language}"]`,
      HTMLButtonElement,
    ),
  }));

  const chapters = timelineChapters(schedule).map((chapter) => {
    const { startSeconds } = chapter;
    const sectionContent = document.importNode(sectionTemplate.content, true);
    const button = requireElement(sectionContent, "button", HTMLButtonElement);
    button.textContent = cueDisplayName(chapter.cueId);
    const tickContent = document.importNode(tickTemplate.content, true);
    const tick = requireElement(tickContent, "line", SVGLineElement);
    const position = `${showTrackFraction(startSeconds, durationSeconds, hasTutorial) * 100}%`;
    tick.setAttribute("x1", position);
    tick.setAttribute("x2", position);
    return { chapter, button, tick };
  });

  const tutorialButton = hasTutorial
    ? requireElement(
        document.importNode(sectionTemplate.content, true),
        "button",
        HTMLButtonElement,
      )
    : undefined;
  if (tutorialButton) {
    tutorialButton.dataset.tutorial = "";
    tutorialButton.textContent = "Tutorial";
    tutorialButton.addEventListener("click", () => run?.resetShowAndFlight(), {
      signal,
    });
    sections.append(tutorialButton);
  }

  for (const { language, button } of languageButtons) {
    button.addEventListener("click", () => readShow()?.setLanguage(language), {
      signal,
    });
  }
  for (const view of chapters) {
    const { button, tick } = view;
    button.addEventListener("click", () => seek(view.chapter.startSeconds), {
      signal,
    });
    sections.append(button);
    track.append(tick);
  }
  transportButton.addEventListener(
    "click",
    () => readShow()?.togglePlayback(),
    { signal },
  );
  let scrubSeconds: number | undefined;
  attachScrubbing({
    track,
    readDurationSeconds: () => durationSeconds,
    readShow,
    mapFraction: (fraction) =>
      trackShowSeconds(fraction, durationSeconds, hasTutorial),
    onUnavailableSeek: seek,
    signal,
    onScrubChange: (seconds) => {
      scrubSeconds = seconds;
    },
  });
  let renderedPlaying: boolean | undefined;
  let renderedPlayheadLeft: string | undefined;
  let renderedLanguage: NarrationLanguage | undefined;

  function updateControls(
    show: ReturnType<typeof readShow>,
    isPlaying: boolean,
  ): void {
    transportButton.disabled = !show;
    for (const { button } of languageButtons) button.disabled = !show;
    if (renderedPlaying !== isPlaying) {
      renderedPlaying = isPlaying;
      transportButton.textContent = isPlaying ? "Hold" : "Play";
    }
    const language = show?.readLanguage();
    if (renderedLanguage === language) return;
    renderedLanguage = language;
    for (const entry of languageButtons) {
      entry.button.setAttribute(
        "aria-pressed",
        String(entry.language === language),
      );
    }
  }

  function updateProgress(
    showTimeSeconds: number,
    tutorial: ReturnType<TimelineRun["readTutorial"]>,
  ): void {
    writeText(
      readout,
      tutorial
        ? tutorialReadout(tutorial)
        : `${formatShowTime(showTimeSeconds)} / ${formatShowTime(durationSeconds)}`,
    );
    const position = `${(tutorial ? 0 : showTrackFraction(showTimeSeconds, durationSeconds, hasTutorial) * 100).toFixed(PLAYHEAD_DECIMALS)}%`;
    if (renderedPlayheadLeft === position) return;
    renderedPlayheadLeft = position;
    playhead.setAttribute("x1", position);
    playhead.setAttribute("x2", position);
  }

  function draw(): void {
    const show = readShow();
    const sample = show?.sample() ?? { timeSeconds: 0, isPlaying: false };
    updateControls(show, sample.isPlaying);
    updateProgress(scrubSeconds ?? sample.timeSeconds, run?.readTutorial());
    animationFrame = requestAnimationFrame(draw);
  }

  bar.hidden = false;
  let animationFrame = 0;
  draw();
  return () => {
    if (signal.aborted) return;
    lifetime.abort();
    cancelAnimationFrame(animationFrame);
    for (const { button, tick } of chapters) {
      button.remove();
      tick.remove();
    }
    tutorialButton?.remove();
    tutorialBlock.setAttribute("width", "0%");
    bar.hidden = true;
  };
}
