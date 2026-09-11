import { requireElement } from "../ui/shared/dom";

/**
 * Purpose: Bootstrap the complete Becoming Many show for rehearsal.
 * Context: The root page is the audience experience without development routes.
 * Responsibility: Start the show and mount its rehearsal and WebXR controls.
 * Boundary: Standalone levels enter through standalone-level.entry.ts.
 */

import { resolveNarrationLanguage } from "../dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../dramaturgy/piece-schedule";
import { level as connectionsLevel } from "../levels/connections.level";
import { startLevel } from "../levels/level.runtime";
import { LEVEL_CATALOG } from "../levels/level-catalog";
import type { Run } from "../levels/run-contract";
import type { RunningShow } from "../levels/show-contract";
import { level as tutorialLevel } from "../levels/start.level";
import { mountRehearsalTransport } from "../ui/rehearsal/transport.panel";
import { mountVrEntryButton } from "../ui/shared/xr-entry-button";
import { loadDeploymentConfig } from "./deployment-config";

declare global {
  interface Window {
    /**
     * Show console access in Rehearsal and Conductor. Commands and observations
     * use the same owner as UI. Entry clears the reference when its Run ends.
     * Available in production for headset rehearsal.
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
// run arm its narration language. Standalone requests use their own entry.
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
      tutorial: tutorialLevel,
      show: {
        schedule: PIECE_SCHEDULE,
        language: resolveNarrationLanguage(request.get("language")),
        states: LEVEL_CATALOG,
      },
    },
  );
  lifetime.signal.throwIfAborted();

  const unmountTransport = mountRehearsalTransport({
    container: document.body,
    schedule: PIECE_SCHEDULE,
    run: level,
  });
  const unsubscribeShow = level.subscribeShow((show) => {
    window.show = show;
  });
  lifetime.signal.addEventListener(
    "abort",
    () => {
      unsubscribeShow();
      unmountTransport();
      delete window.show;
    },
    { once: true },
  );

  const unmountVr = mountVrEntryButton(document.body, level.xr);
  lifetime.signal.addEventListener("abort", unmountVr, { once: true });

  const m5Host = request.get("m5") ?? deployment.m5Host;
  if (m5Host) level.m5?.setHost(m5Host);
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
