/**
 * Purpose: Give the operator the show's position and the controls to move it.
 * Context: A conductor holds, jumps, and re-arms the piece while it is running.
 * Responsibility: Render the clock and cue readouts, and send transport commands.
 * Boundary: The show clock stays the authority; nothing here tracks show time.
 */

import { NARRATION_LANGUAGES } from "../dramaturgy/narration-catalog";
import {
  type NarrationSchedule,
  narrationCueAt,
} from "../dramaturgy/narration-schedule";
import { nextCueAt } from "../dramaturgy/schedule-layout";
import type { ShowCommand } from "../station/station-protocol";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel } from "./conductor-state";
import { formatShowTime } from "./time-format";

export interface TransportPanelOptions {
  readonly parent: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly send: (command: ShowCommand) => void;
}

export function createTransportPanel({
  parent,
  schedule,
  send,
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

  const actions = document.createElement("div");
  actions.className = "conductor__actions";

  const transportButton = document.createElement("button");
  transportButton.type = "button";
  transportButton.className = "conductor__transport-button";

  const rates = createGroup(actions, "rate");
  const rateButtons = CONDUCTOR_SETTINGS.timeScales.map((timeScale) =>
    createGroupButton(rates, `${timeScale}×`, () =>
      send({ kind: "setTimeScale", timeScale }),
    ),
  );

  const languages = createGroup(actions, "language");
  const languageButtons = NARRATION_LANGUAGES.map((language) =>
    createGroupButton(languages, language.toUpperCase(), () =>
      send({ kind: "setLanguage", language }),
    ),
  );

  actions.append(transportButton);
  const resetShowButton = createButton(actions, "↺ clock", () =>
    send({ kind: "resetShow" }),
  );
  const resetFlightButton = createButton(actions, "↺ flight", () =>
    send({ kind: "resetFlight" }),
  );
  const reloadButton = createConfirmButton(actions, "⟳ reload", () =>
    send({ kind: "reloadShow" }),
  );

  root.append(clock, cues, actions);
  parent.append(root);

  // Mirrors the last reported state so one button both starts and holds.
  let isShowPlaying = false;
  transportButton.addEventListener("click", () => {
    send({ kind: isShowPlaying ? "pause" : "play" });
  });

  const everyButton = [
    transportButton,
    resetShowButton,
    resetFlightButton,
    reloadButton,
    ...rateButtons,
    ...languageButtons,
  ];

  return {
    update(state): void {
      isShowPlaying = state.status?.isPlaying === true;
      transportButton.textContent = isShowPlaying ? "⏸ hold" : "▶ play";

      writeClock(state.showTimeSeconds);
      writeCues(state.showTimeSeconds);
      markPressed(
        rateButtons,
        CONDUCTOR_SETTINGS.timeScales,
        state.status?.timeScale,
      );
      markPressed(languageButtons, NARRATION_LANGUAGES, state.language);

      // A dead link must not offer controls that would silently do nothing.
      for (const button of everyButton) {
        button.disabled = !state.isLive;
      }
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

function createButton(
  parent: HTMLElement,
  labelText: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = labelText;
  button.addEventListener("click", onClick);
  parent.append(button);

  return button;
}

function createGroupButton(
  group: HTMLElement,
  labelText: string,
  onClick: () => void,
): HTMLButtonElement {
  return createButton(group, labelText, onClick);
}

/**
 * Reloading the show window drops the visitor out of VR and needs a physical
 * click on that window to come back, so it asks twice. A blocking
 * `window.confirm` is the wrong tool: it would freeze this page's own clock.
 */
function createConfirmButton(
  parent: HTMLElement,
  labelText: string,
  onConfirm: () => void,
): HTMLButtonElement {
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;

  function disarm(button: HTMLButtonElement): void {
    clearTimeout(disarmTimer);
    button.dataset.armed = "false";
    button.textContent = labelText;
  }

  const button = createButton(parent, labelText, () => {
    if (button.dataset.armed === "true") {
      disarm(button);
      onConfirm();
      return;
    }

    button.dataset.armed = "true";
    button.textContent = "confirm?";
    disarmTimer = setTimeout(
      () => disarm(button),
      CONDUCTOR_SETTINGS.reloadConfirmMilliseconds,
    );
  });

  return button;
}
