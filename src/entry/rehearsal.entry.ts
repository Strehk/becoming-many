import { requireElement } from "../ui/shared/dom";

/**
 * Purpose: Bootstrap the complete Becoming Many show for rehearsal.
 * Context: The root page is the audience experience without development routes.
 * Responsibility: Start the show and mount its rehearsal and WebXR controls.
 * Boundary: Standalone levels, benchmarks, and diagnostics enter through test.entry.ts.
 */

import { resolveNarrationLanguage } from "../dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../dramaturgy/piece-schedule";
import { SHOW_LEVEL_STATES } from "../dramaturgy/show-levels";
import { level as connectionsLevel } from "../levels/connections.level";
import { type Run, startLevel } from "../levels/level.runtime";
import type { RunningShow } from "../levels/show.runtime";
import { mountRehearsalTransport } from "../ui/rehearsal/transport.panel";
import { mountVrEntryButton } from "../ui/shared/xr-entry-button";
import { loadDeploymentConfig } from "./deployment-config";

declare global {
  interface Window {
    /**
     * Rehearsal transport. The console commands the show through it; nothing
     * under `src` reads it back, so removing it changes no behavior. It is
     * set on every default run rather than gated on the build mode because
     * rehearsal happens in the headset, against a production build, without
     * the conductor page's transport at hand.
     */
    show?: Pick<
      RunningShow,
      | "sample"
      | "play"
      | "pause"
      | "togglePlayback"
      | "seekTo"
      | "seekBy"
      | "setTimeScale"
      | "resetTime"
      | "readLanguage"
      | "setLanguage"
    >;
  }
}

// Runtime request, not authored configuration: the rehearsal page only lets a
// run arm its narration language. Development requests belong to test.html.
const lifetime = new AbortController();
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) lifetime.abort();
});
const request = new URLSearchParams(window.location.search);

// Deployment facts the station server was started with; empty when nothing
// answers /config. A set fact is deployment authority: it is applied here and
// the matching conductor control turns read-only.
let level: Run | undefined;
try {
  const deployment = await loadDeploymentConfig();

  const viewport = requireElement(document, ".app", HTMLElement);
  const canvas = requireElement(
    viewport,
    ".experience-canvas",
    HTMLCanvasElement,
  );
  level = await startLevel(
    { canvas, viewport },
    {
      signal: lifetime.signal,
      kind: "show",
      preset: connectionsLevel,
      show: {
        schedule: PIECE_SCHEDULE,
        language: resolveNarrationLanguage(request.get("language")),
        states: SHOW_LEVEL_STATES,
      },
      m5ExpectedDeviceId: deployment.m5DeviceId,
    },
  );
  lifetime.signal.throwIfAborted();

  window.show = level.show;
  lifetime.signal.addEventListener(
    "abort",
    () => {
      delete window.show;
    },
    { once: true },
  );

  const show = level.show;
  if (show) {
    // The rehearsal page starts the piece by itself: a run-through begins at
    // the top without anyone reaching for the console, and the transport bar
    // is there to hold, scrub, and jump once it runs. Show time still waits on
    // the audio timebase, which a browser keeps suspended until the first
    // gesture in this window — so the piece opens the moment the page is
    // touched, not silently behind a suspended context.
    show.play();

    const unmountTransport = mountRehearsalTransport({
      container: document.body,
      schedule: PIECE_SCHEDULE,
      show,
    });
    lifetime.signal.addEventListener("abort", unmountTransport, { once: true });
  }

  const unmountVr = mountVrEntryButton(document.body, level.xr);
  lifetime.signal.addEventListener("abort", unmountVr, { once: true });

  if (deployment.m5Host) level.m5?.setHost(deployment.m5Host);
} catch (error) {
  let failure = error;
  lifetime.abort();
  try {
    await level?.unload();
  } catch (cleanupError) {
    failure = new AggregateError(
      [error, cleanupError],
      "Page startup and cleanup failed",
    );
  }
  if (failure !== lifetime.signal.reason) {
    requireElement(document, "[data-startup-error]", HTMLElement).hidden =
      false;
    throw failure;
  }
}
