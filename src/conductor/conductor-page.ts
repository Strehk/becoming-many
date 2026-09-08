/**
 * Purpose: Compose the conductor page around the show it hosts in-process.
 * Context: One window owns the world, the operator UI, and the XR session.
 *   The surface is touch-first and plain-worded; everything that can break a
 *   live show lives in the technician drawer.
 * Responsibility: Start the level, snapshot it every frame, and wire panels.
 * Boundary: Show time is owned by the show clock; this page only reflects it.
 */

import {
  NARRATION_LANGUAGES,
  type NarrationLanguage,
} from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import { SHOW_LEVEL_STATES } from "../dramaturgy/show-levels";
import { type FrameMetrics, startLevel } from "../levels/level-runtime";
import { SHOW_COMPOSITION } from "../levels/show-composition";
import type { RunningShow } from "../levels/show-runtime";
import type { DeploymentConfig } from "../station/deployment-config";
import { FrameMetricsSampler } from "../test-ui/frame-metrics";
import type { XrSessionState } from "../world/xr-session";
import {
  CONDUCTOR_COPY,
  type ConductorCopy,
  type OperatorLanguage,
} from "./conductor-copy";
import { type ConductorAction, resolveConductorKey } from "./conductor-keys";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type {
  ConductorPanel,
  ConductorState,
  ShowSnapshot,
} from "./conductor-state";
import { createM5Panel } from "./m5-panel";
import {
  loadOperatorLanguage,
  saveOperatorLanguage,
} from "./operator-language";
import { createSessionBar } from "./session-bar";
import { createShowActions, type ShowActions } from "./show-actions";
import { createShowTimeline } from "./show-timeline";
import { createStagePanel } from "./stage-panel";
import { createStatusStrip } from "./status-strip";
import { createTechDrawer } from "./tech-drawer";
import { createTransportPanel } from "./transport-panel";
import { createWakeOverlay } from "./wake-overlay";
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

  if (deployment.stationName) {
    document.title = `${deployment.stationName} — Becoming Many`;
  }

  // A parameter cannot stay narrowed inside the closures below.
  const page = container;

  // The words the page is read in. The visitor's narration language is a
  // separate choice; this one belongs to the station.
  const pageLanguage = createPageLanguage();

  // The masthead names the station and carries the health tiles: the two
  // things a person reads from across the room.
  const masthead = document.createElement("header");
  masthead.className = "conductor__masthead";
  masthead.append(createIdentity(deployment.stationName));
  page.append(masthead);

  // The stage mount exists before the level so the world has a home; it gets
  // its place in the technician drawer when the stage panel wraps it below.
  const stageMount = document.createElement("div");
  const frameMetrics = new FrameMetricsSampler();
  const level = await startLevel(stageMount, {
    kind: "show",
    composition: SHOW_COMPOSITION,
    show: { schedule, language, states: SHOW_LEVEL_STATES },
    frameMetrics,
    m5ExpectedDeviceId: deployment.m5DeviceId,
  });
  const show = requireShow(level.show);

  const actions = createShowActions(level, show);

  // Reading the metrics sorts a ring buffer, so the snapshot re-reads them on
  // a beat rather than every frame.
  let metrics: FrameMetrics | undefined;
  let metricsReadAtMilliseconds = 0;

  // The one page-held copy of the session state, so every panel reads the
  // same instant of it from the snapshot instead of subscribing separately.
  let xrState: XrSessionState = {
    availability: "unknown",
    isSessionActive: false,
  };
  level.xr.subscribe((state) => {
    // The world renders on one loop, and its rate is the monitor's while the
    // preview holds it and the headset's while a session presents. A window
    // spanning that handover would average two different machines, so each
    // edge starts the measurement — and the reading — again.
    if (state.isSessionActive !== xrState.isSessionActive) {
      frameMetrics.reset();
      metrics = undefined;
      metricsReadAtMilliseconds = 0;
    }
    xrState = state;
  });

  let scrubSeconds: number | undefined;

  const statusStrip = createStatusStrip({
    tilesParent: masthead,
    bannerParent: page,
  });

  const drawer = createTechDrawer({
    parent: page,
    actions,
    onSetLanguage: pageLanguage.choose,
  });

  const panels: readonly ConductorPanel[] = [
    statusStrip,
    createSessionBar({
      parent: page,
      actions,
      xr: level.xr,
      onToggleTechDrawer: drawer.toggle,
    }),
    createTransportPanel({ parent: page, schedule, actions }),
    createShowTimeline({
      parent: page,
      schedule,
      actions,
      onScrubChange: (showTimeSeconds) => {
        scrubSeconds = showTimeSeconds;
      },
    }),
    createStagePanel({ parent: drawer.stageParent, stageMount }),
    createM5Panel({
      parent: drawer.m5Parent,
      actions,
      lockedHost: deployment.m5Host,
    }),
    drawer.panel,
    createWakeOverlay(page, deployment.stationName),
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
      xr: xrState,
    };
  }

  function readState(): ConductorState {
    const snapshot = readSnapshot();

    return {
      snapshot,
      copy: pageLanguage.read(),
      // While dragging, the operator's own position wins: a clock sampled a
      // frame behind the pointer would fight it.
      showTimeSeconds: scrubSeconds ?? snapshot.showTimeSeconds,
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

  // Panels are built wordless and take their labels from the first draw, so
  // that draw happens before the browser paints rather than a frame into it.
  draw();
}

interface PageLanguage {
  /** The catalogue the page is currently read in. */
  readonly read: () => ConductorCopy;
  readonly choose: (operatorLanguage: OperatorLanguage) => void;
}

/**
 * The page's own language, applied to the document as well as the panels so
 * assistive technology and hyphenation read the same answer. Only a chosen
 * language is written down: opening the page must not turn the browser's own
 * language into a stored decision a station that later changes it has to undo.
 */
function createPageLanguage(): PageLanguage {
  let copy = CONDUCTOR_COPY[loadOperatorLanguage()];
  apply(copy.language);

  function apply(operatorLanguage: OperatorLanguage): void {
    copy = CONDUCTOR_COPY[operatorLanguage];
    document.documentElement.lang = operatorLanguage;
  }

  return {
    read: () => copy,
    choose(operatorLanguage): void {
      apply(operatorLanguage);
      saveOperatorLanguage(operatorLanguage);
    },
  };
}

/**
 * The piece's name with the station under it, large enough to read across
 * the room. Which of the identical stations this window commands is a
 * deployment fact; without one the line simply stays away.
 */
function createIdentity(stationName: string | undefined): HTMLElement {
  const identity = document.createElement("div");
  identity.className = "conductor__identity";

  const piece = document.createElement("span");
  piece.className = "conductor__identity-piece";
  piece.textContent = "Becoming Many";
  identity.append(piece);

  if (stationName) {
    const station = document.createElement("span");
    station.className = "conductor__identity-station";
    station.textContent = stationName;
    identity.append(station);
  }

  return identity;
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
      if (!next) return;
      // The same re-arm the language buttons perform: hold, then switch —
      // see docs/direction/session-operator.md.
      actions.pause();
      actions.setLanguage(next);
      return;
    }
  }
}
