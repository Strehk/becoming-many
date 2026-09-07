/**
 * Purpose: Bootstrap the complete Becoming Many show for rehearsal.
 * Context: The root page is the audience experience without development routes.
 * Responsibility: Start the show and mount its rehearsal and WebXR controls.
 * Boundary: Standalone levels, benchmarks, and diagnostics enter through test-main.ts.
 */

import "./style.css";
import { mountRehearsalTransport } from "./dev/rehearsal-transport";
import { resolveNarrationLanguage } from "./dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "./dramaturgy/piece-schedule";
import type { ShowClock } from "./dramaturgy/show-clock";
import { SHOW_LEVEL_STATES } from "./dramaturgy/show-levels";
import { level as connectionsLevel } from "./levels/connections.level";
import { type RunningLevel, startLevel } from "./levels/level-runtime";
import { loadDeploymentConfig } from "./station/deployment-config";
import { mountVrEntryButton } from "./world/vr-entry-button";

declare global {
  interface Window {
    /**
     * Rehearsal transport. The console commands the show through it; nothing
     * under `src` reads it back, so removing it changes no behavior. It is
     * set on every default run rather than gated on the build mode because
     * rehearsal happens in the headset, against a production build, without
     * the conductor page's transport at hand.
     */
    showClock?: ShowClock;
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
let level: RunningLevel | undefined;
try {
  const deployment = await loadDeploymentConfig();

  level = await startLevel(document.querySelector(".app"), {
    signal: lifetime.signal,
    kind: "show",
    preset: connectionsLevel,
    show: {
      schedule: PIECE_SCHEDULE,
      language: resolveNarrationLanguage(request.get("language")),
      states: SHOW_LEVEL_STATES,
    },
    m5ExpectedDeviceId: deployment.m5DeviceId,
  });
  lifetime.signal.throwIfAborted();

  window.showClock = level.show?.clock;
  lifetime.signal.addEventListener(
    "abort",
    () => {
      delete window.showClock;
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
    show.clock.play();

    const unmountTransport = mountRehearsalTransport({
      container: document.body,
      schedule: PIECE_SCHEDULE,
      clock: show.clock,
      readLanguage: show.readLanguage,
      setLanguage: show.setLanguage,
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
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = "Unable to start Becoming Many. Please reload.";
    (document.querySelector(".app") ?? document.body).append(alert);
    throw failure;
  }
}
