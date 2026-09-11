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

import { NARRATION_LANGUAGES } from "../../dramaturgy/narration-catalog";
import type { NarrationSchedule } from "../../dramaturgy/narration-schedule";
import type { Run } from "../../levels/run-contract";
import type { RunningShow } from "../../levels/show-contract";
import type { XrSessionState } from "../../world/xr-contract";
import { requireElement } from "../shared/dom";
import type { TimelineRun } from "../shared/tutorial-timeline";
import {
  type ConductorAction,
  resolveConductorKey,
} from "./keyboard-shortcuts";
import { createLanguagePanel } from "./language.panel";
import { createM5Panel } from "./m5.panel";
import { CONDUCTOR_SETTINGS } from "./operator-settings";
import { createShowTimeline } from "./show-timeline.panel";
import { createStatusStrip } from "./status-strip.panel";
import { createTechDrawer } from "./technician-drawer.panel";
import { createTransportPanel } from "./transport.panel";
import type { ConductorPanel, ConductorViewState } from "./view-state";
import { createWakeOverlay } from "./wake-overlay.panel";

export interface ConductorPageOptions {
  readonly container: HTMLElement;
  readonly schedule: NarrationSchedule;
  readonly stationName: string | undefined;
  readonly show?: Pick<
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
  readonly run: Pick<
    Run,
    "resetFlight" | "resetShowAndFlight" | "readPlayback" | "togglePlayback"
  > &
    Partial<
      Pick<Run, "show" | "readTutorial" | "skipTutorial" | "readAudioState">
    >;
  readonly xr: Run["xr"];
  readonly m5: Pick<NonNullable<Run["m5"]>, "readObservation"> | undefined;
  readonly initialM5Host: string;
  readonly isM5HostLocked: boolean;
  readonly onM5HostChange: (host: string) => void;
  readonly reloadPage: () => void;
}

/** The returned cleanup releases UI listeners, subscriptions, timers and gestures. */
export function mountConductorPage({
  container: page,
  schedule,
  stationName,
  show: initialShow,
  run,
  xr,
  m5,
  initialM5Host,
  isM5HostLocked,
  onM5HostChange,
  reloadPage,
}: ConductorPageOptions): () => void {
  const readShow = () => run.show ?? initialShow;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let observationTimer: ReturnType<typeof setInterval> | undefined;
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
          event.target.closest(
            ".conductor__drawer, .conductor__tech-button, .conductor__stop-button, [data-tutorial]",
          )
        )
          return;
        startHeadset();
      },
      { signal },
    );
    let scrubSeconds: number | undefined;
    const statusStrip = createStatusStrip({
      tilesParent: masthead,
    });
    const drawer = createTechDrawer({
      parent: page,
      trigger: requireElement(
        page,
        ".conductor__tech-button",
        HTMLButtonElement,
      ),
      readShow,
      run,
      reloadPage,
      xr,
      signal,
    });
    const panels: readonly ConductorPanel[] = [
      statusStrip,
      createTransportPanel({ parent: page, run, signal }),
      createShowTimeline({
        parent: page,
        schedule,
        run:
          run.readTutorial && run.skipTutorial
            ? (run as TimelineRun)
            : undefined,
        readShow,
        signal,
        onScrubChange: (seconds) => {
          scrubSeconds = seconds;
        },
      }),
      createLanguagePanel({
        parent: page,
        readShow,
        signal,
      }),
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

    function acceptsShortcut(event: KeyboardEvent): boolean {
      if (event.defaultPrevented || document.pointerLockElement) return false;
      if (page.querySelector(".conductor__drawer[open]")) return false;
      const target = event.target;
      return !(
        event.code === "Space" &&
        target instanceof Element &&
        target.closest("button, a[href], summary")
      );
    }

    function executeAction(action: ConductorAction): void {
      if (action.kind === "toggleTransport") {
        startHeadset();
        run.togglePlayback();
        return;
      }
      if (action.kind === "resetShow") {
        run.resetShowAndFlight();
        return;
      }
      if (action.kind === "resetFlight") {
        run.resetFlight();
        return;
      }
      const show = readShow();
      if (action.kind === "jumpToCue") {
        const cue = schedule.narration[action.cueIndex];
        if (!cue) return;
        if (show) show.seekTo(cue.atSeconds);
        else run.skipTutorial?.(cue.atSeconds);
        return;
      }
      if (!show) return;
      executeShowAction(action, show);
    }

    function executeShowAction(
      action: Exclude<
        ConductorAction,
        { kind: "resetFlight" | "jumpToCue" | "toggleTransport" | "resetShow" }
      >,
      show: NonNullable<ReturnType<typeof readShow>>,
    ): void {
      switch (action.kind) {
        case "seekBy":
          show.seekBy(action.offsetSeconds);
          break;
        case "toggleLanguage": {
          const next = NARRATION_LANGUAGES.find(
            (language) => language !== show.readLanguage(),
          );
          if (next) show.setLanguage(next);
          break;
        }
      }
    }

    function handleShortcut(event: KeyboardEvent): void {
      if (!acceptsShortcut(event)) return;
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
      executeAction(action);
    }
    window.addEventListener("keydown", handleShortcut, { signal });

    function draw(): void {
      const show = readShow();
      const sample = show?.sample() ?? {
        timeSeconds: 0,
        isPlaying: false,
        timeScale: 1,
      };
      const state: ConductorViewState = {
        showTimeSeconds: scrubSeconds ?? sample.timeSeconds,
        isPlaying: run.readPlayback() === "playing",
        playback: run.readPlayback(),
        timeScale: sample.timeScale,
        language: show?.readLanguage() ?? "en",
        activeLevel: show?.readActiveLevel() ?? "tutorial",
        audioState:
          run.readAudioState?.() ?? show?.readAudioState() ?? "suspended",
        m5: m5?.readObservation(),
        xr: xrState,
      };
      for (const panel of panels) panel.update(state);
    }
    draw();
    // Operator observations must not depend on the desktop animation clock during XR.
    observationTimer = setInterval(
      draw,
      CONDUCTOR_SETTINGS.observationIntervalMilliseconds,
    );
    page.inert = false;
    return unmount;
  } catch (error) {
    unmount();
    throw error;
  }

  function unmount(): void {
    page.inert = true;
    lifetime.abort();
    clearInterval(observationTimer);
    unsubscribeXr?.();
  }
}
