/**
 * Purpose: Compose the conductor page and keep its panels on one instant.
 * Context: Status arrives ten times a second; the operator watches continuously.
 * Responsibility: Hold the link and the last status, and redraw every frame.
 * Boundary: Show time is owned by the show clock; this page only reflects it.
 */

import {
  NARRATION_LANGUAGES,
  type NarrationCueId,
  type NarrationLanguage,
} from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import type { DeploymentConfig } from "../station/deployment-config";
import { createStationLink } from "../station/station-link";
import type { ShowCommand, ShowStatus } from "../station/station-protocol";
import { type ConductorAction, resolveConductorKey } from "./conductor-keys";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel, ConductorState } from "./conductor-state";
import { createCueInspector } from "./cue-inspector";
import { createM5Panel } from "./m5-panel";
import { projectShowTime } from "./playhead";
import { createShowTimeline } from "./show-timeline";
import { createStatusStrip } from "./status-strip";
import { createTransportPanel } from "./transport-panel";
import "./conductor.css";

const MILLISECONDS_PER_SECOND = 1_000;
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export interface ConductorPageOptions {
  readonly container: Element | null;
  readonly schedule: NarrationSchedule;
  /** The language shown until the show reports its own. */
  readonly language: NarrationLanguage;
  readonly stationUrl: string;
  /** Facts the station server was deployed with; set fields render read-only. */
  readonly deployment: DeploymentConfig;
}

export function startConductorPage({
  container,
  schedule,
  language,
  stationUrl,
  deployment,
}: ConductorPageOptions): void {
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing conductor root: .conductor");
  }

  // The station's name tells a technician which of the identical stations
  // this window commands — in the tab bar and on the page itself.
  if (deployment.stationName) {
    document.title = `${deployment.stationName} — Becoming Many`;
    const stationBadge = document.createElement("div");
    stationBadge.className = "conductor__station-name";
    stationBadge.textContent = deployment.stationName;
    container.append(stationBadge);
  }

  // A parameter cannot stay narrowed inside the closures below.
  const page = container;

  let status: ShowStatus | undefined;
  let statusReceivedMilliseconds = 0;
  let isStationConnected = false;
  let isShowConnected = false;
  let scrubSeconds: number | undefined;
  let selectedCueId: NarrationCueId | undefined;
  let displayedLanguage = language;

  const link = createStationLink({
    role: "conductor",
    stationUrl,
    onMessage: (message) => {
      if (message.kind === "status") {
        status = message;
        statusReceivedMilliseconds = performance.now();
        displayedLanguage = message.language;
        return;
      }
      if (message.kind === "presence" && message.role === "show") {
        isShowConnected = message.isConnected;
        // A closed show window leaves no state worth drawing a playhead from.
        if (!message.isConnected) status = undefined;
      }
    },
    onConnectionChange: (isConnected) => {
      isStationConnected = isConnected;
      if (!isConnected) {
        isShowConnected = false;
        status = undefined;
      }
    },
  });

  const send = link.send;
  const panels: readonly ConductorPanel[] = [
    createStatusStrip(page),
    createTransportPanel({ parent: page, schedule, send }),
    createShowTimeline({
      parent: page,
      schedule,
      send,
      onScrubChange: (showTimeSeconds) => {
        scrubSeconds = showTimeSeconds;
      },
      onSelectCue: (cueId) => {
        selectedCueId = cueId;
      },
    }),
    createCueInspector(page, schedule),
    createM5Panel({ parent: page, send, lockedHost: deployment.m5Host }),
  ];

  window.addEventListener("keydown", (event) => {
    const action = resolveConductorKey({
      code: event.code,
      isShiftHeld: event.shiftKey,
      isModifierHeld: event.ctrlKey || event.altKey || event.metaKey,
      isTypingTarget: isTypingTarget(event.target),
    });
    if (!action) return;

    // Also stops the space bar from re-triggering whichever button has focus.
    event.preventDefault();
    const command = toCommand(action, schedule, status, displayedLanguage);
    if (command) send(command);
  });

  function readState(): ConductorState {
    const elapsedMilliseconds = performance.now() - statusReceivedMilliseconds;
    const isLive =
      isShowConnected &&
      status !== undefined &&
      elapsedMilliseconds < CONDUCTOR_SETTINGS.staleStatusMilliseconds;

    return {
      status,
      isStationConnected,
      isShowConnected,
      isLive,
      // While dragging, the operator's own position wins: an echoed status is
      // always a little behind the pointer and would fight it.
      showTimeSeconds:
        scrubSeconds ??
        (status
          ? projectShowTime(
              status,
              elapsedMilliseconds / MILLISECONDS_PER_SECOND,
              schedule.durationSeconds,
            )
          : 0),
      language: displayedLanguage,
      selectedCueId,
      isScrubbing: scrubSeconds !== undefined,
    };
  }

  function draw(): void {
    const state = readState();
    page.dataset.live = String(state.isLive);
    for (const panel of panels) {
      panel.update(state);
    }
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * One exhaustive switch over the action union — the same shape as the command
 * dispatch on the show side, and kept whole for the same reason.
 */
// fallow-ignore-next-line complexity
function toCommand(
  action: ConductorAction,
  schedule: NarrationSchedule,
  status: ShowStatus | undefined,
  language: NarrationLanguage,
): ShowCommand | undefined {
  switch (action.kind) {
    case "toggleTransport":
      return { kind: status?.isPlaying ? "pause" : "play" };
    case "seekBy":
      return { kind: "seekBy", offsetSeconds: action.offsetSeconds };
    case "jumpToCue": {
      const cue = schedule.narration[action.cueIndex];

      return cue
        ? { kind: "seekTo", showTimeSeconds: cue.atSeconds }
        : undefined;
    }
    case "resetShow":
      return { kind: "resetShow" };
    case "resetFlight":
      return { kind: "resetFlight" };
    case "toggleLanguage": {
      const next = NARRATION_LANGUAGES.find(
        (candidate) => candidate !== language,
      );

      return next ? { kind: "setLanguage", language: next } : undefined;
    }
  }
}
