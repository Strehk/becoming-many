/**
 * Purpose: Give the operator the show's position and the controls to move it.
 * Context: A conductor holds, jumps, and re-arms the piece while it is running.
 * Responsibility: Render the clock and cue readouts, and apply transport actions.
 * Boundary: The show clock stays the authority; nothing here tracks show time.
 */

import { NARRATION_LANGUAGES } from "../dramaturgy/narration-catalog";
import {
  type NarrationSchedule,
  narrationCueAt,
} from "../dramaturgy/narration-schedule";
import { nextCueAt } from "../dramaturgy/schedule-layout";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import { createButton, createConfirmButton } from "./panel-buttons";
import type { ShowActions } from "./show-actions";
import { formatShowTime } from "./time-format";

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

  const clock = document.createElement("div");
  clock.className = "conductor__clock";
  const elapsed = document.createElement("output");
  const total = document.createElement("span");
  total.className = "conductor__clock-total";
  total.textContent = ` / ${formatShowTime(schedule.durationSeconds)}`;
  clock.append(elapsed, total);

  const cues = document.createElement("div");
  cues.className = "conductor__cues";
  const nowLine = createCueLine(cues, "now");
  const nextLine = createCueLine(cues, "next");
  const remaining = document.createElement("div");
  remaining.className = "conductor__cue-label";
  cues.append(remaining);

  const controls = document.createElement("div");
  controls.className = "conductor__actions";

  const transportButton = document.createElement("button");
  transportButton.type = "button";
  transportButton.className = "conductor__transport-button";

  const rates = createGroup(controls, "rate");
  const rateButtons = CONDUCTOR_SETTINGS.timeScales.map((timeScale) =>
    createButton(rates, `${timeScale}×`, () => actions.setTimeScale(timeScale)),
  );

  const languages = createGroup(controls, "language");
  const languageButtons = NARRATION_LANGUAGES.map((language) =>
    createButton(languages, language.toUpperCase(), () =>
      actions.setLanguage(language),
    ),
  );

  controls.append(transportButton);
  createButton(controls, "↺ clock", () => actions.resetShow());
  createButton(controls, "↺ flight", () => actions.resetFlight());
  createConfirmButton(controls, "⟳ reload", () => actions.reloadShow());

  root.append(clock, cues, controls);
  parent.append(root);

  // Mirrors the last drawn state so one button both starts and holds.
  let isShowPlaying = false;
  transportButton.addEventListener("click", () => {
    if (isShowPlaying) actions.pause();
    else actions.play();
  });

  return {
    update(state): void {
      isShowPlaying = state.snapshot.isPlaying;
      transportButton.textContent = isShowPlaying ? "⏸ hold" : "▶ play";

      writeClock(state.showTimeSeconds);
      writeCues(state.showTimeSeconds);
      markPressed(
        rateButtons,
        CONDUCTOR_SETTINGS.timeScales,
        state.snapshot.timeScale,
      );
      markPressed(
        languageButtons,
        NARRATION_LANGUAGES,
        state.snapshot.language,
      );
    },
  };

  function writeClock(showTimeSeconds: number): void {
    elapsed.textContent = formatShowTime(showTimeSeconds);
    remaining.textContent = `remaining ${formatShowTime(
      schedule.durationSeconds - showTimeSeconds,
    )}`;
  }

  function writeCues(showTimeSeconds: number): void {
    const now = narrationCueAt(schedule, showTimeSeconds);
    nowLine.write(now?.cueId ?? "—", "");

    const next = nextCueAt(schedule, showTimeSeconds);
    nextLine.write(
      next?.cueId ?? "—",
      next ? `in ${formatShowTime(next.atSeconds - showTimeSeconds)}` : "",
    );
  }
}

/** Marks whichever button in a group carries the show's current value. */
function markPressed<T>(
  buttons: readonly HTMLButtonElement[],
  values: readonly T[],
  active: T | undefined,
): void {
  buttons.forEach((button, index) => {
    button.setAttribute("aria-pressed", String(values[index] === active));
  });
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

function createGroup(parent: HTMLElement, labelText: string): HTMLElement {
  const group = document.createElement("div");
  group.className = "conductor__group";

  const label = document.createElement("span");
  label.className = "conductor__group-label";
  label.textContent = labelText;

  group.append(label);
  parent.append(group);
  return group;
}
