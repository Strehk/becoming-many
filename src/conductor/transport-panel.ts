/**
 * Purpose: Give the operator the show's position and the one control that
 *   starts and holds it, sized for a finger and a glance.
 * Context: A conductor holds, jumps, and re-arms the piece while it is running.
 * Responsibility: Render the clock, the status pill, the cue readouts, and the
 *   hold/play and ten-second-nudge buttons.
 * Boundary: The show clock stays the authority; nothing here tracks show time.
 *   Rehearsal speeds and resets live in the technician drawer.
 */

import {
  type NarrationSchedule,
  narrationCueAt,
} from "../dramaturgy/narration-schedule";
import { nextCueAt } from "../dramaturgy/schedule-layout";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import type { ShowActions } from "./show-actions";
import { cueDisplayName, formatShowTime } from "./time-format";

export interface TransportPanelOptions {
  readonly parent: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly actions: ShowActions;
}

export function createTransportPanel({
  parent,
  schedule,
  actions,
}: TransportPanelOptions): ConductorPanel {
  const root = document.createElement("section");
  root.className = "conductor__transport";
  root.setAttribute("aria-label", "Transport");

  const clockBlock = document.createElement("div");
  clockBlock.className = "conductor__clock-block";

  const clock = document.createElement("div");
  clock.className = "conductor__clock";
  const elapsed = document.createElement("output");
  const total = document.createElement("span");
  total.className = "conductor__clock-total";
  total.textContent = ` / ${formatShowTime(schedule.durationSeconds)}`;
  clock.append(elapsed, total);

  const statusLine = document.createElement("div");
  statusLine.className = "conductor__status-line";
  const statusPill = document.createElement("span");
  statusPill.className = "conductor__status-pill";
  const remaining = document.createElement("span");
  remaining.className = "conductor__remaining";
  statusLine.append(statusPill, remaining);

  clockBlock.append(clock, statusLine);

  const cues = document.createElement("div");
  cues.className = "conductor__cues";
  const nowLine = createCueLine(cues, "now");
  const nextLine = createCueLine(cues, "next");

  const controls = document.createElement("div");
  controls.className = "conductor__transport-controls";

  createNudgeButton(controls, "back", () =>
    actions.seekBy(-CONDUCTOR_SETTINGS.touchNudgeSeconds),
  );

  const transportButton = document.createElement("button");
  transportButton.type = "button";
  transportButton.className = "conductor__transport-button";
  const transportIcon = document.createElement("span");
  transportIcon.className = "conductor__transport-icon";
  const transportLabel = document.createElement("span");
  transportButton.append(transportIcon, transportLabel);
  controls.append(transportButton);

  createNudgeButton(controls, "forward", () =>
    actions.seekBy(CONDUCTOR_SETTINGS.touchNudgeSeconds),
  );

  root.append(clockBlock, cues, controls);
  parent.append(root);

  // Mirrors the last drawn state so one button both starts and holds.
  let isShowPlaying = false;
  transportButton.addEventListener("click", () => {
    if (isShowPlaying) actions.pause();
    else actions.play();
  });

  // The icon is parsed markup, so it only redraws when the answer changes.
  let renderedPlaying: boolean | undefined;

  return {
    update(state): void {
      isShowPlaying = state.snapshot.isPlaying;

      if (renderedPlaying !== isShowPlaying) {
        renderedPlaying = isShowPlaying;
        transportButton.dataset.playing = String(isShowPlaying);
        transportIcon.innerHTML = isShowPlaying
          ? PAUSE_ICON_SVG
          : PLAY_ICON_SVG;
        transportLabel.textContent = isShowPlaying ? "Hold" : "Play";
        statusPill.dataset.state = isShowPlaying ? "running" : "held";
      }

      statusPill.textContent = statusText(
        isShowPlaying,
        state.showTimeSeconds >= schedule.durationSeconds,
      );

      writeClock(state.showTimeSeconds);
      writeCues(state.showTimeSeconds);
    },
  };

  function writeClock(showTimeSeconds: number): void {
    elapsed.textContent = formatShowTime(showTimeSeconds);
    remaining.textContent = `${formatShowTime(
      schedule.durationSeconds - showTimeSeconds,
    )} left`;
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

function createCueLine(parent: HTMLElement, labelText: string): CueLine {
  const line = document.createElement("div");

  const label = document.createElement("span");
  label.className = "conductor__cue-label";
  label.textContent = `${labelText} `;

  const name = document.createElement("output");
  name.className = "conductor__cue-name";

  const detail = document.createElement("span");
  detail.className = "conductor__cue-label";

  line.append(label, name, " ", detail);
  parent.append(line);

  return {
    write(nextName, nextDetail): void {
      name.textContent = nextName;
      detail.textContent = nextDetail;
    },
  };
}

function createNudgeButton(
  parent: HTMLElement,
  direction: "back" | "forward",
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "conductor__nudge-button";
  button.addEventListener("click", onClick);

  const icon = document.createElement("span");
  icon.innerHTML = direction === "back" ? BACK_ICON_SVG : FORWARD_ICON_SVG;

  const label = document.createElement("span");
  label.textContent = `${CONDUCTOR_SETTINGS.touchNudgeSeconds} s`;

  button.append(icon, label);
  parent.append(button);
  return button;
}

const PLAY_ICON_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5 L20 12 L7 19.5 Z"></path></svg>`;
const PAUSE_ICON_SVG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1"></rect><rect x="14" y="4" width="5" height="16" rx="1"></rect></svg>`;
const BACK_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>`;
const FORWARD_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>`;
