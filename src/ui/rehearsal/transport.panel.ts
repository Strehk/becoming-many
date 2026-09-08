import {
  NARRATION_LANGUAGES,
  type NarrationLanguage,
} from "../../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import { cueSlots } from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show.runtime";
import { requireElement, writeText } from "../shared/dom";
import { cueDisplayName, formatShowTime } from "../shared/show-time-format";
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
  show,
}: RehearsalTransportOptions): () => void {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const { durationSeconds } = schedule;
  const bar = requireElement(container, "[data-rehearsal]", HTMLElement);
  const transportButton = requireElement(
    bar,
    "[data-transport]",
    HTMLButtonElement,
  );
  const readout = requireElement(bar, "[data-readout]", HTMLOutputElement);
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

  // Both languages share cue slots; the first chapter includes the silent pre-roll.
  const chapters = cueSlots(schedule, "en").map((slot, index) => {
    const startSeconds = index === 0 ? 0 : slot.atSeconds;
    const sectionContent = document.importNode(sectionTemplate.content, true);
    const button = requireElement(sectionContent, "button", HTMLButtonElement);
    button.textContent = cueDisplayName(slot.cueId);
    const tickContent = document.importNode(tickTemplate.content, true);
    const tick = requireElement(tickContent, "line", SVGLineElement);
    const position = `${toPercent(startSeconds, durationSeconds)}%`;
    tick.setAttribute("x1", position);
    tick.setAttribute("x2", position);
    return { startSeconds, button, tick };
  });

  for (const { language, button } of languageButtons) {
    button.addEventListener("click", () => show.setLanguage(language), {
      signal,
    });
  }
  for (const { startSeconds, button, tick } of chapters) {
    button.addEventListener("click", () => show.seekTo(startSeconds), {
      signal,
    });
    sections.append(button);
    track.append(tick);
  }
  transportButton.addEventListener("click", show.togglePlayback, { signal });
  let scrubSeconds: number | undefined;
  attachScrubbing({
    track,
    durationSeconds,
    show,
    signal,
    onScrubChange: (seconds) => {
      scrubSeconds = seconds;
    },
  });
  let renderedPlaying: boolean | undefined;
  let renderedPlayheadLeft: string | undefined;
  let renderedLanguage: NarrationLanguage | undefined;

  function draw(): void {
    const sample = show.sample();
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
  let animationFrame = requestAnimationFrame(draw);
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
