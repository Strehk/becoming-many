/** Mount the operator UI against existing owner commands and observations. */
import { NARRATION_LANGUAGES } from "../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../dramaturgy/narration-schedule";
import type { Run } from "../levels/level.runtime";
import type { RunningShow } from "../levels/show.runtime";
import type {
  FrameMetrics,
  FrameMetricsSampler,
} from "../test-ui/frame-metrics";
import type { XrSessionState } from "../world/xr-session";
import { resolveConductorKey } from "./conductor-keys";
import { CONDUCTOR_SETTINGS } from "./conductor-settings";
import type { ConductorPanel, ConductorViewState } from "./conductor-state";
import { createM5Panel } from "./m5.panel";
import { createSessionBar } from "./session-bar.panel";
import { createShowTimeline } from "./show-timeline.panel";
import { createStagePanel } from "./stage.panel";
import { createStatusStrip } from "./status-strip.panel";
import { createTechDrawer } from "./tech-drawer.panel";
import { createTransportPanel } from "./transport.panel";
import { createWakeOverlay } from "./wake-overlay.panel";

export interface ConductorPageOptions {
  readonly container: HTMLElement;
  readonly stageMount: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly stationName: string | undefined;
  readonly show: Pick<
    RunningShow,
    | "sample"
    | "play"
    | "pause"
    | "togglePlayback"
    | "seekTo"
    | "seekBy"
    | "setTimeScale"
    | "resetTime"
    | "setLanguage"
    | "readLanguage"
    | "readActiveLevel"
    | "readAudioState"
  >;
  readonly run: Pick<Run, "resetFlight" | "resetShowAndFlight">;
  readonly xr: Run["xr"];
  readonly m5:
    | Pick<NonNullable<Run["m5"]>, "readLatestState" | "readOperatorStatus">
    | undefined;
  readonly frameMetrics: Pick<FrameMetricsSampler, "read">;
  readonly initialM5Host: string;
  readonly isM5HostLocked: boolean;
  readonly onM5HostChange: (host: string) => void;
  readonly reloadPage: () => void;
}

/** The returned cleanup releases only UI listeners, subscriptions and DOM. */
export function mountConductorPage({
  container: page,
  stageMount,
  schedule,
  stationName,
  show,
  run,
  xr,
  m5,
  frameMetrics,
  initialM5Host,
  isM5HostLocked,
  onM5HostChange,
  reloadPage,
}: ConductorPageOptions): () => void {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let animationFrame = 0;
  let unsubscribeXr: (() => void) | undefined;

  try {
    const masthead = document.createElement("header");
    masthead.className = "conductor__masthead";
    masthead.append(createIdentity(stationName));
    page.append(masthead);

    let xrState: XrSessionState = {
      availability: "unknown",
      isSessionActive: false,
    };
    unsubscribeXr = xr.subscribe((state) => {
      xrState = state;
    });
    let scrubSeconds: number | undefined;
    const statusStrip = createStatusStrip({
      tilesParent: masthead,
      bannerParent: page,
    });
    const drawer = createTechDrawer({
      parent: page,
      show,
      run,
      reloadPage,
      signal,
    });
    const panels: readonly ConductorPanel[] = [
      statusStrip,
      createTransportPanel({ parent: page, schedule, show }),
      createShowTimeline({
        parent: page,
        schedule,
        show,
        onScrubChange: (seconds) => {
          scrubSeconds = seconds;
        },
      }),
      createSessionBar({
        parent: page,
        show,
        run,
        xr,
        onToggleTechDrawer: drawer.toggle,
        signal,
      }),
      createStagePanel({ parent: drawer.stageParent, stageMount }),
      createM5Panel({
        parent: drawer.m5Parent,
        m5,
        initialHost: initialM5Host,
        isHostLocked: isM5HostLocked,
        onHostChange: onM5HostChange,
      }),
      drawer.panel,
      createWakeOverlay(page, stationName),
    ];

    window.addEventListener(
      "keydown",
      (event) => {
        if (document.pointerLockElement) return;
        const target = event.target;
        const action = resolveConductorKey({
          code: event.code,
          isShiftHeld: event.shiftKey,
          isModifierHeld: event.ctrlKey || event.altKey || event.metaKey,
          isTypingTarget:
            target instanceof HTMLElement &&
            (target.matches("input, textarea, select") ||
              target.isContentEditable),
        });
        if (!action) return;
        event.preventDefault();
        switch (action.kind) {
          case "toggleTransport":
            show.togglePlayback();
            break;
          case "seekBy":
            show.seekBy(action.offsetSeconds);
            break;
          case "jumpToCue": {
            const cue = schedule.narration[action.cueIndex];
            if (cue) show.seekTo(cue.atSeconds);
            break;
          }
          case "resetShow":
            show.resetTime();
            break;
          case "resetFlight":
            run.resetFlight();
            break;
          case "toggleLanguage": {
            const next = NARRATION_LANGUAGES.find(
              (language) => language !== show.readLanguage(),
            );
            if (next) show.setLanguage(next);
            break;
          }
        }
      },
      { signal },
    );

    let metrics: FrameMetrics | undefined;
    let metricsReadAtMilliseconds = 0;
    function draw(): void {
      const sample = show.sample();
      const now = performance.now();
      if (
        now - metricsReadAtMilliseconds >=
        CONDUCTOR_SETTINGS.metricsIntervalMilliseconds
      ) {
        metricsReadAtMilliseconds = now;
        metrics = frameMetrics.read();
      }
      const state: ConductorViewState = {
        showTimeSeconds: scrubSeconds ?? sample.timeSeconds,
        isPlaying: sample.isPlaying,
        timeScale: sample.timeScale,
        language: show.readLanguage(),
        activeLevel: show.readActiveLevel(),
        audioState: show.readAudioState(),
        framesPerSecond: metrics?.framesPerSecond,
        p95Milliseconds: metrics?.p95Milliseconds,
        m5: m5?.readOperatorStatus(),
        xr: xrState,
      };
      for (const panel of panels) panel.update(state);
      animationFrame = requestAnimationFrame(draw);
    }
    animationFrame = requestAnimationFrame(draw);
    return unmount;
  } catch (error) {
    unmount();
    throw error;
  }

  function unmount(): void {
    lifetime.abort();
    cancelAnimationFrame(animationFrame);
    unsubscribeXr?.();
    page.replaceChildren();
  }
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
