/**
 * Purpose: Bootstrap the Becoming Many application.
 * Context: This is the minimal browser entry point.
 * Responsibility: Select the requested level and start the Level Runtime.
 * Boundary: Composition, rendering, and world behavior live elsewhere.
 */

import "./style.css";
import { createBenchmarkRun } from "./benchmark/benchmark-run";
import { isBenchmarkProfileName } from "./benchmark/benchmark-settings";
import { resolveNarrationLanguage } from "./dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "./dramaturgy/piece-schedule";
import type { ShowClock } from "./dramaturgy/show-clock";
import {
  LEVEL_CATALOG,
  resolveLevelName,
  SHOW_LEVEL,
  SHOW_LEVEL_PRESETS,
} from "./levels/level-catalog";
import { startLevel } from "./levels/level-runtime";
import { loadDeploymentConfig } from "./station/deployment-config";
import { connectShowStation } from "./station/show-station";
import { resolveStationUrl } from "./station/station-settings";
import { createStationWidget } from "./station/station-widget";

declare global {
  interface Window {
    /**
     * Rehearsal transport. The console commands the show through it; nothing
     * under `src` reads it back, so removing it changes no behavior. It is
     * set on every default run rather than gated on the build mode because
     * rehearsal happens in the headset, against a production build, where
     * the conductor page on another machine is not reachable.
     */
    showClock?: ShowClock;
  }
}

// Runtime request, not authored configuration. The default page plays the
// piece: the schedule is the world authority, and the station link connects
// by itself so the conductor page can take the transport whenever a broker
// answers. `?level=<name>` opens one preset for development instead — no
// show, no station — `?benchmark[=<profile>]` replays the fixed measurement
// route, `?language=<de|en>` arms the narration language, and
// `?station=<ws url>` points at a broker running somewhere else, and
// `?m5=<host>` polls a tilt controller directly for development.
const request = new URLSearchParams(window.location.search);
const requestedLevel = request.get("level");
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

// `?m5=<host>` starts polling a tilt controller without broker or conductor —
// a development convenience, so the explicit request outranks the deployment
// host; in an installation without either env the conductor sets the host.
const m5Host = request.get("m5") ?? deployment.m5Host;
if (m5Host) {
  level.m5?.setHost(m5Host);
}

// The station link always accompanies a show and fails soft: with no broker
// answering it retries quietly, the widget says so, and the piece plays
// unchanged. The widget also holds the way to the conductor page.
if (level.show) {
  const widget = createStationWidget(document.body);
  connectShowStation({
    level,
    show: level.show,
    stationUrl: resolveStationUrl(request.get("station")),
    isM5HostLocked: deployment.m5Host !== undefined,
    onConnectionChange: widget.setConnected,
  });
}
