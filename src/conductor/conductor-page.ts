/**
 * Purpose: Compose the conductor page around the show it hosts in-process.
 * Context: One window owns the world, the operator UI, and the XR session.
 * Responsibility: Start the level, snapshot it every frame, and wire panels.
 * Boundary: Show time is owned by the show clock; this page only reflects it.
 */

import {
  NARRATION_LANGUAGES,
  type NarrationCueId,
  type NarrationLanguage,
} from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { SHOW_LEVEL, SHOW_LEVEL_PRESETS } from "../levels/level-catalog";
import { type RunningShow, startLevel } from "../levels/level-runtime";
import type { DeploymentConfig } from "../station/deployment-config";
import type { FrameMetrics } from "../test-ui/frame-metrics";
import { type ConductorAction, resolveConductorKey } from "./conductor-keys";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type {
  ConductorPanel,
  ConductorState,
  ShowSnapshot,
} from "./conductor-state";
import { createCueInspector } from "./cue-inspector";
import { createM5Panel } from "./m5-panel";
import { createShowActions, type ShowActions } from "./show-actions";
import { createShowTimeline } from "./show-timeline";
import { createStagePanel } from "./stage-panel";
import { createStatusStrip } from "./status-strip";
import { createTransportPanel } from "./transport-panel";
import "./conductor.css";

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export interface ConductorPageOptions {
  readonly container: Element | null;
  readonly schedule: NarrationSchedule;
  /** The language the session is armed with; the language buttons re-arm it. */
  readonly language: NarrationLanguage;
  /** Facts the station server was deployed with; set fields render read-only. */
  readonly deployment: DeploymentConfig;
}

export async function startConductorPage({
  container,
  schedule,
  language,
  deployment,
}: ConductorPageOptions): Promise<void> {
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

  // The stage mount exists before the level so the world has a home; it gets
  // its place in the layout when the stage panel wraps it below.
  const stageMount = document.createElement("div");
  const level = await startLevel(stageMount, SHOW_LEVEL, {
    show: { schedule, language, levels: SHOW_LEVEL_PRESETS },
    m5ExpectedDeviceId: deployment.m5DeviceId,
  });
  const show = requireShow(level.show);

  const actions = createShowActions(level, show);

  let scrubSeconds: number | undefined;
  let selectedCueId: NarrationCueId | undefined;

  const statusStrip = createStatusStrip(page);
  createStagePanel({ parent: page, stageMount, xr: level.xr, actions });
  const panels: readonly ConductorPanel[] = [
    statusStrip,
    createTransportPanel({ parent: page, schedule, actions }),
    createShowTimeline({
      parent: page,
      schedule,
      actions,
      onScrubChange: (showTimeSeconds) => {
        scrubSeconds = showTimeSeconds;
      },
      onSelectCue: (cueId) => {
        selectedCueId = cueId;
      },
    }),
    createCueInspector(page, schedule),
    createM5Panel({ parent: page, actions, lockedHost: deployment.m5Host }),
  ];

  window.addEventListener("keydown", (event) => {
    // A locked pointer means the operator is flying the preview; the arrow
    // keys then steer the flight and must not also seek the show.
    if (document.pointerLockElement) return;

    const action = resolveConductorKey({
      code: event.code,
      isShiftHeld: event.shiftKey,
      isModifierHeld: event.ctrlKey || event.altKey || event.metaKey,
      isTypingTarget: isTypingTarget(event.target),
    });
    if (!action) return;

    // Also stops the space bar from re-triggering whichever button has focus.
    event.preventDefault();
    applyAction(action, {
      schedule,
      isPlaying: show.clock.sample().isPlaying,
      language: show.readLanguage(),
      actions,
    });
  });

  // Reading the metrics sorts a ring buffer, so the snapshot re-reads them on
  // a beat rather than every frame.
  let metrics: FrameMetrics | undefined;
  let metricsReadAtMilliseconds = 0;

  function readSnapshot(): ShowSnapshot {
    const showTime = show.clock.sample();

    const now = performance.now();
    if (
      now - metricsReadAtMilliseconds >=
      CONDUCTOR_SETTINGS.metricsIntervalMilliseconds
    ) {
      metricsReadAtMilliseconds = now;
      metrics = level.readFrameMetrics();
    }

    return {
      showTimeSeconds: showTime.timeSeconds,
      isPlaying: showTime.isPlaying,
      timeScale: showTime.timeScale,
      language: show.readLanguage(),
      levelName: show.readActiveLevel(),
      audioState: show.readAudioState(),
      framesPerSecond: metrics?.framesPerSecond,
      p95Milliseconds: metrics?.p95Milliseconds,
      m5: level.m5?.readOperatorStatus(),
    };
  }

  function readState(): ConductorState {
    const snapshot = readSnapshot();

    return {
      snapshot,
      // While dragging, the operator's own position wins: a clock sampled a
      // frame behind the pointer would fight it.
      showTimeSeconds: scrubSeconds ?? snapshot.showTimeSeconds,
      selectedCueId,
      isScrubbing: scrubSeconds !== undefined,
    };
  }

  // The page's own loop keeps running during an XR session — only the world's
  // render loop moves to the headset — so every readout stays live while the
  // preview freezes.
  function draw(): void {
    const state = readState();
    for (const panel of panels) {
      panel.update(state);
    }
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

/** A typed guarantee the hoisted closures above can rely on. */
function requireShow(show: RunningShow | undefined): RunningShow {
  if (!show) throw new Error("The conductor page always plays the show");

  return show;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

interface ActionContext {
  readonly schedule: NarrationSchedule;
  readonly isPlaying: boolean;
  readonly language: NarrationLanguage;
  readonly actions: ShowActions;
}

/**
 * One exhaustive switch over the action union — the same shape as the old
 * wire's command dispatch, and kept whole for the same reason.
 */
// fallow-ignore-next-line complexity
function applyAction(
  action: ConductorAction,
  { schedule, isPlaying, language, actions }: ActionContext,
): void {
  switch (action.kind) {
    case "toggleTransport":
      if (isPlaying) actions.pause();
      else actions.play();
      return;
    case "seekBy":
      actions.seekBy(action.offsetSeconds);
      return;
    case "jumpToCue": {
      const cue = schedule.narration[action.cueIndex];
      if (cue) actions.seekTo(cue.atSeconds);
      return;
    }
    case "resetShow":
      actions.resetShow();
      return;
    case "resetFlight":
      actions.resetFlight();
      return;
    case "toggleLanguage": {
      const next = NARRATION_LANGUAGES.find(
        (candidate) => candidate !== language,
      );
      if (next) actions.setLanguage(next);
      return;
    }
  }
}
