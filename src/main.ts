/**
 * Purpose: Bootstrap the Becoming Many application.
 * Context: This is the minimal browser entry point.
 * Responsibility: Select the requested level, start the Level Runtime, and
 *   mount the page's own controls.
 * Boundary: Composition, rendering, and world behavior live elsewhere.
 */

import "./style.css";
import { createBenchmarkRun } from "./benchmark/benchmark-run";
import { isBenchmarkProfileName } from "./benchmark/benchmark-settings";
import { showHeadsetDiagnostics } from "./dev/headset-diagnostics";
import { mountRehearsalTransport } from "./dev/rehearsal-transport";
import { resolveNarrationLanguage } from "./dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "./dramaturgy/piece-schedule";
import type { ShowClock } from "./dramaturgy/show-clock";
import {
  isLevelName,
  LEVEL_CATALOG,
  resolveLevelName,
  SHOW_LEVEL,
  SHOW_LEVEL_PRESETS,
} from "./levels/level-catalog";
import { startLevel } from "./levels/level-runtime";
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

// Runtime request, not authored configuration. The default page plays the
// piece with the schedule as the world authority, started on load and driven
// from the rehearsal transport bar. `?level=<name>` opens one preset for
// development instead — no show — `?benchmark[=<profile>]` replays the fixed
// measurement route, `?language=<de|en>` arms the narration language, and
// `?m5=<host>` polls a tilt controller directly for development.
const request = new URLSearchParams(window.location.search);

// `?diagnostics=1` puts errors and one GPU capability report on screen. A
// headset browser has no console, so a shader that fails to compile there
// shows only as an empty world; this is how that failure becomes readable.
if (request.get("diagnostics") !== null) {
  showHeadsetDiagnostics(document.body);
}

// `/echo` names a level the same way `?level=echo` does. A path survives
// what a query string does not: a headset browser that treats a typed address
// as a search, a link that loses its parameters, a bookmark saved without
// them. Both forms mean a development run; the bare default still plays the
// piece.
const pathLevel = window.location.pathname.replace(/^\/+|\/+$/g, "");
const requestedLevel =
  request.get("level") ?? (isLevelName(pathLevel) ? pathLevel : null);
const levelName = resolveLevelName(requestedLevel);
const requestedProfile = request.get("benchmark");
const benchmark =
  requestedProfile === null
    ? undefined
    : createBenchmarkRun(
        levelName,
        isBenchmarkProfileName(requestedProfile) ? requestedProfile : "full",
      );

// A benchmark must stay deterministic and a requested preset is a
// development run, so only the bare default plays the show.
const show =
  benchmark || requestedLevel !== null
    ? undefined
    : {
        schedule: PIECE_SCHEDULE,
        language: resolveNarrationLanguage(request.get("language")),
        levels: SHOW_LEVEL_PRESETS,
      };

// Deployment facts the station server was started with; empty when nothing
// answers /config. A set fact is deployment authority: it is applied here and
// the matching conductor control turns read-only.
const deployment = await loadDeploymentConfig();

const level = await startLevel(
  document.querySelector(".app"),
  show ? SHOW_LEVEL : LEVEL_CATALOG[levelName],
  { benchmark, show, m5ExpectedDeviceId: deployment.m5DeviceId },
);

window.showClock = level.show?.clock;

if (level.show) {
  // The rehearsal page starts the piece by itself: a run-through begins at
  // the top without anyone reaching for the console, and the transport bar
  // is there to hold, scrub, and jump once it runs. Show time still waits on
  // the audio timebase, which a browser keeps suspended until the first
  // gesture in this window — so the piece opens the moment the page is
  // touched, not silently behind a suspended context.
  level.show.clock.play();

  mountRehearsalTransport({
    container: document.body,
    schedule: PIECE_SCHEDULE,
    clock: level.show.clock,
  });
}

mountVrEntryButton(document.body, level.xr);

// `?m5=<host>` starts polling a tilt controller without a conductor page — a
// development convenience, so the explicit request outranks the deployment
// host; the installation runs the conductor page, which owns the host there.
const m5Host = request.get("m5") ?? deployment.m5Host;
if (m5Host) {
  level.m5?.setHost(m5Host);
}
