/** Mount the operator UI against existing owner commands and observations. */

import alarmClockIcon from "lucide-static/icons/alarm-clock.svg?no-inline";
import glassesIcon from "lucide-static/icons/glasses.svg?no-inline";
import imageIcon from "lucide-static/icons/image.svg?no-inline";
import pauseIcon from "lucide-static/icons/pause.svg?no-inline";
import playIcon from "lucide-static/icons/play.svg?no-inline";
import smartphoneIcon from "lucide-static/icons/smartphone.svg?no-inline";
import squareIcon from "lucide-static/icons/square.svg?no-inline";
import volume2Icon from "lucide-static/icons/volume-2.svg?no-inline";
import wrenchIcon from "lucide-static/icons/wrench.svg?no-inline";
import xIcon from "lucide-static/icons/x.svg?no-inline";

import type {
  FrameMetrics,
  FrameMetricsSampler,
} from "../../diagnostics/frame-metrics";
import { NARRATION_LANGUAGES } from "../../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import type { Run } from "../../levels/level.runtime";
import type { RunningShow } from "../../levels/show.runtime";
import type { XrSessionState } from "../../world/xr-session";
import { requireElement } from "../shared/dom";
import { resolveConductorKey } from "./keyboard-shortcuts";
import { createLanguagePanel } from "./language.panel";
import { createM5Panel } from "./m5.panel";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import { createShowTimeline } from "./show-timeline.panel";
import { createStagePanel } from "./stage.panel";
import { createStatusStrip } from "./status-strip.panel";
import { createTechDrawer } from "./technician-drawer.panel";
import { createTransportPanel } from "./transport.panel";
import type { ConductorPanel, ConductorViewState } from "./view-state";
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
    | "readTutorial"
    | "continueToExperience"
  >;
  readonly run: Pick<Run, "resetFlight" | "resetShowAndFlight">;
  readonly xr: Run["xr"];
  readonly m5: Pick<NonNullable<Run["m5"]>, "readObservation"> | undefined;
  readonly frameMetrics: Pick<FrameMetricsSampler, "read">;
  readonly initialM5Host: string;
  readonly isM5HostLocked: boolean;
  readonly onM5HostChange: (host: string) => void;
  readonly reloadPage: () => void;
}

/** The returned cleanup releases UI listeners, subscriptions, timers and gestures. */
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
    // Vite resolves imported SVG URLs consistently in development and production.
    for (const [name, url] of Object.entries({
      "alarm-clock": alarmClockIcon,
      headset: glassesIcon,
      image: imageIcon,
      pause: pauseIcon,
      play: playIcon,
      smartphone: smartphoneIcon,
      square: squareIcon,
      "volume-2": volume2Icon,
      wrench: wrenchIcon,
      x: xIcon,
    })) {
      for (const icon of page.querySelectorAll(`use[data-icon="${name}"]`)) {
        icon.setAttribute("href", url);
      }
    }
    const masthead = requireElement(page, ".conductor__masthead", HTMLElement);
    let xrState: XrSessionState = {
      availability: "unknown",
      isSessionActive: false,
    };
    unsubscribeXr = xr.subscribe((state) => {
      xrState = state;
    });
    // Immersive XR requires user activation; normal operation enables it by default.
    function startHeadset(): void {
      if (xrState.availability !== "available" || xrState.isSessionActive)
        return;
      void xr
        .start()
        .catch((reason: unknown) =>
          console.warn("The headset session request failed.", reason),
        );
    }
    page.addEventListener(
      "click",
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(".conductor__drawer, .conductor__tech-button")
        )
          return;
        startHeadset();
      },
      { signal },
    );
    let scrubSeconds: number | undefined;
    const statusStrip = createStatusStrip({
      tilesParent: masthead,
      bannerParent: page,
    });
    const drawer = createTechDrawer({
      parent: page,
      trigger: requireElement(
        page,
        ".conductor__tech-button",
        HTMLButtonElement,
      ),
      show,
      run,
      reloadPage,
      xr,
      signal,
    });
    const panels: readonly ConductorPanel[] = [
      statusStrip,
      createTransportPanel({ parent: page, show, run, signal }),
      createShowTimeline({
        parent: page,
        schedule,
        show,
        signal,
        onScrubChange: (seconds) => {
          scrubSeconds = seconds;
        },
      }),
      createLanguagePanel({
        parent: page,
        show,
        signal,
      }),
      createStagePanel({ parent: page, stageMount }),
      createM5Panel({
        parent: drawer.m5Parent,
        initialHost: initialM5Host,
        isHostLocked: isM5HostLocked,
        onHostChange: onM5HostChange,
        signal,
      }),
      drawer.panel,
      createWakeOverlay(page, stationName),
    ];

    window.addEventListener(
      "keydown",
      (event) => {
        if (
          event.defaultPrevented ||
          document.pointerLockElement ||
          page.querySelector(".conductor__drawer[open]")
        )
          return;
        const target = event.target;
        if (
          event.code === "Space" &&
          target instanceof Element &&
          target.closest("button, a[href], summary")
        )
          return;
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
        if (
          show.readTutorial() &&
          (action.kind === "seekBy" ||
            action.kind === "jumpToCue" ||
            action.kind === "resetShow")
        )
          return;
        event.preventDefault();
        switch (action.kind) {
          case "toggleTransport":
            startHeadset();
            show.togglePlayback();
            break;
          case "seekBy":
            show.seekBy(action.offsetSeconds);
            break;
          case "jumpToCue": {
            const cue = schedule.narration[action.cueIndex];
            if (cue)
              show.seekTo(show.sample().mainStartSeconds + cue.atSeconds);
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
        mainStartSeconds: sample.mainStartSeconds,
        isPlaying: sample.isPlaying,
        timeScale: sample.timeScale,
        language: show.readLanguage(),
        activeLevel: show.readActiveLevel(),
        audioState: show.readAudioState(),
        framesPerSecond: metrics?.framesPerSecond,
        p95Milliseconds: metrics?.p95Milliseconds,
        m5: m5?.readObservation(),
        xr: xrState,
        tutorial: show.readTutorial(),
      };
      for (const panel of panels) panel.update(state);
      animationFrame = requestAnimationFrame(draw);
    }
    draw();
    page.inert = false;
    return unmount;
  } catch (error) {
    unmount();
    throw error;
  }

  function unmount(): void {
    page.inert = true;
    lifetime.abort();
    cancelAnimationFrame(animationFrame);
    unsubscribeXr?.();
  }
}
