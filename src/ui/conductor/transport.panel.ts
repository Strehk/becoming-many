import {
  type NarrationSchedule,
  narrationCueAt,
} from "../../dramaturgy/narration-schedule";
import { nextCueAt } from "../../dramaturgy/schedule-layout";
import type { RunningShow } from "../../levels/show.runtime";
import { requireElement, writeText } from "../shared/dom";
import { cueDisplayName, formatShowTime } from "../shared/show-time-format";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import type { ConductorPanel } from "./view-state";

export interface TransportPanelOptions {
  readonly parent: HTMLElement;
  readonly signal: AbortSignal;
  readonly schedule: NarrationSchedule;
  readonly show: Pick<RunningShow, "seekBy" | "togglePlayback">;
}

export function createTransportPanel({
  parent,
  signal,
  schedule,
  show,
}: TransportPanelOptions): ConductorPanel {
  const root = requireElement(parent, ".conductor__transport", HTMLElement);
  const elapsed = requireElement(root, "[data-elapsed]", HTMLOutputElement);
  const total = requireElement(root, ".conductor__clock-total", HTMLElement);
  total.textContent = ` / ${formatShowTime(schedule.durationSeconds)}`;
  const remaining = requireElement(root, ".conductor__remaining", HTMLElement);
  const statusPill = requireElement(
    root,
    ".conductor__status-pill",
    HTMLElement,
  );
  const nowLine = bindCueLine(root, "now");
  const nextLine = bindCueLine(root, "next");
  const transportButton = requireElement(
    root,
    ".conductor__transport-button",
    HTMLButtonElement,
  );
  const transportLabel = requireElement(
    transportButton,
    "[data-transport-label]",
    HTMLElement,
  );
  const playIcon = requireElement(
    transportButton,
    "[data-play-icon]",
    HTMLElement,
  );
  const pauseIcon = requireElement(
    transportButton,
    "[data-pause-icon]",
    HTMLElement,
  );
  for (const direction of ["back", "forward"] as const) {
    const button = requireElement(
      root,
      `[data-nudge="${direction}"]`,
      HTMLButtonElement,
    );
    requireElement(button, "[data-nudge-label]", HTMLElement).textContent =
      `${CONDUCTOR_SETTINGS.touchNudgeSeconds} s`;
    button.addEventListener(
      "click",
      () =>
        show.seekBy(
          (direction === "back" ? -1 : 1) *
            CONDUCTOR_SETTINGS.touchNudgeSeconds,
        ),
      { signal },
    );
  }
  transportButton.addEventListener("click", show.togglePlayback, { signal });
  let renderedPlaying: boolean | undefined;

  return {
    update(state): void {
      const isShowPlaying = state.isPlaying;

      if (renderedPlaying !== isShowPlaying) {
        renderedPlaying = isShowPlaying;
        transportButton.dataset.playing = String(isShowPlaying);
        playIcon.hidden = isShowPlaying;
        pauseIcon.hidden = !isShowPlaying;
        transportLabel.textContent = isShowPlaying ? "Hold" : "Play";
        statusPill.dataset.state = isShowPlaying ? "running" : "held";
      }

      writeText(
        statusPill,
        statusText(
          isShowPlaying,
          state.showTimeSeconds >= schedule.durationSeconds,
        ),
      );

      writeClock(state.showTimeSeconds);
      writeCues(state.showTimeSeconds);
    },
  };

  function writeClock(showTimeSeconds: number): void {
    writeText(elapsed, formatShowTime(showTimeSeconds));
    writeText(
      remaining,
      `${formatShowTime(schedule.durationSeconds - showTimeSeconds)} left`,
    );
  }

  function writeCues(showTimeSeconds: number): void {
    // Before the first word the first chapter is already underway: the
    // pre-roll belongs to it as far as an operator is concerned.
    const now =
      narrationCueAt(schedule, showTimeSeconds) ?? schedule.narration[0];
    nowLine.write(now ? cueDisplayName(now.cueId) : "—", "");

    const next = nextCueAt(schedule, showTimeSeconds);
    if (!next) {
      nextLine.write("—", "");
      return;
    }

    nextLine.write(
      cueDisplayName(next.cueId),
      `in ${formatShowTime(next.atSeconds - showTimeSeconds)}`,
    );
  }
}

/** The pill in one sentence: playing wins, then a run-out reads as done. */
function statusText(isPlaying: boolean, isAtEnd: boolean): string {
  if (isPlaying) return "Running";

  return isAtEnd ? "Finished" : "On hold";
}

interface CueLine {
  readonly write: (name: string, detail: string) => void;
}

function bindCueLine(parent: HTMLElement, label: string): CueLine {
  const line = requireElement(parent, `[data-cue="${label}"]`, HTMLElement);
  const name = requireElement(line, "output", HTMLOutputElement);
  const detail = requireElement(line, "[data-detail]", HTMLElement);
  return {
    write(nextName, nextDetail): void {
      writeText(name, nextName);
      writeText(detail, nextDetail);
    },
  };
}
