import {
  NARRATION_LANGUAGES,
  type NarrationLanguage,
} from "../../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import { timelineChapters } from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show.runtime";
import { requireElement, writeText } from "../shared/dom";
import {
  cueDisplayName,
  formatShowTime,
  formatTutorialStatus,
} from "../shared/show-time-format";
import { attachScrubbing } from "../shared/transport-scrubbing";

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
    | "readTutorial"
    | "continueToExperience"
  >;
  readonly standalone?: boolean;
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
  show,
  standalone = false,
}: RehearsalTransportOptions): () => void {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let mainStartSeconds = show.sample().mainStartSeconds;
  let durationSeconds = mainStartSeconds + schedule.durationSeconds;
  const bar = requireElement(container, "[data-rehearsal]", HTMLElement);
  const transportButton = requireElement(
    bar,
    "[data-transport]",
    HTMLButtonElement,
  );
  const readout = requireElement(bar, "[data-readout]", HTMLOutputElement);
  const tutorialStatus = requireElement(
    bar,
    "[data-tutorial-status]",
    HTMLOutputElement,
  );
  const continueButton = requireElement(
    bar,
    "[data-continue-experience]",
    HTMLButtonElement,
  );
  const track = requireElement(bar, "[data-track]", SVGSVGElement);
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

  const chapters = (
    standalone ? [] : timelineChapters(schedule, mainStartSeconds)
  ).map((chapter) => {
    const { startSeconds } = chapter;
    const sectionContent = document.importNode(sectionTemplate.content, true);
    const button = requireElement(sectionContent, "button", HTMLButtonElement);
    button.textContent = cueDisplayName(chapter.cueId);
    const tickContent = document.importNode(tickTemplate.content, true);
    const tick = requireElement(tickContent, "line", SVGLineElement);
    const position = `${toPercent(startSeconds, durationSeconds)}%`;
    tick.setAttribute("x1", position);
    tick.setAttribute("x2", position);
    return { chapter, button, tick };
  });

  for (const { language, button } of languageButtons) {
    button.addEventListener("click", () => show.setLanguage(language), {
      signal,
    });
  }
  for (const view of chapters) {
    const { button, tick } = view;
    button.addEventListener(
      "click",
      () => show.seekTo(view.chapter.startSeconds),
      {
        signal,
      },
    );
    sections.append(button);
    track.append(tick);
  }
  transportButton.addEventListener("click", show.togglePlayback, { signal });
  continueButton.addEventListener("click", show.continueToExperience, {
    signal,
  });
  let scrubSeconds: number | undefined;
  attachScrubbing({
    track,
    readDurationSeconds: () => durationSeconds,
    show,
    signal,
    isEnabled: () => !standalone && !show.readTutorial(),
    onScrubChange: (seconds) => {
      scrubSeconds = seconds;
    },
  });
  let renderedPlaying: boolean | undefined;
  let renderedPlayheadLeft: string | undefined;
  let renderedLanguage: NarrationLanguage | undefined;
  let renderedTutorial: boolean | undefined;
  let renderedReady: boolean | undefined;

  function draw(): void {
    const sample = show.sample();
    if (mainStartSeconds !== sample.mainStartSeconds) {
      mainStartSeconds = sample.mainStartSeconds;
      durationSeconds = mainStartSeconds + schedule.durationSeconds;
      const layout = timelineChapters(schedule, mainStartSeconds);
      for (const [index, view] of chapters.entries()) {
        const chapter = layout[index];
        if (!chapter) continue;
        view.chapter = chapter;
        const position = `${toPercent(view.chapter.startSeconds, durationSeconds)}%`;
        view.tick.setAttribute("x1", position);
        view.tick.setAttribute("x2", position);
      }
    }
    const tutorial = show.readTutorial();
    const inTutorial = Boolean(tutorial);
    if (renderedTutorial !== inTutorial) {
      renderedTutorial = inTutorial;
      tutorialStatus.hidden = !tutorial;
      readout.hidden = standalone;
      track.toggleAttribute("hidden", standalone);
      track.setAttribute("aria-disabled", String(inTutorial));
      sections.hidden = standalone;
      sections.inert = inTutorial;
      for (const view of chapters)
        view.button.disabled = inTutorial || view.chapter.cueId === "tutorial";
    }
    if (tutorial) writeText(tutorialStatus, formatTutorialStatus(tutorial));
    const ready = !standalone && Boolean(tutorial?.readyToContinue);
    if (renderedReady !== ready) {
      renderedReady = ready;
      continueButton.hidden = !ready;
    }
    const showTimeSeconds = scrubSeconds ?? sample.timeSeconds;
    if (renderedPlaying !== sample.isPlaying) {
      renderedPlaying = sample.isPlaying;
      transportButton.textContent = sample.isPlaying ? "Hold" : "Play";
    }
    writeText(
      readout,
      `${formatShowTime(showTimeSeconds)} / ${formatShowTime(durationSeconds)}`,
    );
    const position = `${toPercent(showTimeSeconds, durationSeconds).toFixed(PLAYHEAD_DECIMALS)}%`;
    if (renderedPlayheadLeft !== position) {
      renderedPlayheadLeft = position;
      playhead.setAttribute("x1", position);
      playhead.setAttribute("x2", position);
    }
    const language = show.readLanguage();
    if (renderedLanguage !== language) {
      renderedLanguage = language;
      for (const entry of languageButtons) {
        entry.button.setAttribute(
          "aria-pressed",
          String(entry.language === language),
        );
      }
    }
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
    bar.hidden = true;
  };
}

function toPercent(seconds: number, durationSeconds: number): number {
  return (seconds / durationSeconds) * 100;
}
