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
import { connectShowStation } from "./station/show-station";
import { resolveStationUrl } from "./station/station-settings";

declare global {
  interface Window {
    /**
     * Rehearsal transport. The console commands the show through it; nothing
     * under `src` reads it back, so removing it changes no behavior. It is
     * gated on `?show` rather than the build mode because rehearsal happens
     * in the headset, against a production build, where the conductor page on
     * another machine is not reachable.
     */
    showClock?: ShowClock;
  }
}

// Runtime request, not authored configuration: `?level=<name>` opens any
// preset, `?benchmark[=<profile>]` replays the fixed measurement route,
// `?show[&language=<de|en>]` plays the piece — the schedule is the world
// authority there, so `?level` is ignored — and `?station[=<ws url>]` lets
// the conductor page command that show.
const request = new URLSearchParams(window.location.search);
const levelName = resolveLevelName(request.get("level"));
const requestedProfile = request.get("benchmark");
const benchmark =
  requestedProfile === null
    ? undefined
    : createBenchmarkRun(
        levelName,
        isBenchmarkProfileName(requestedProfile) ? requestedProfile : "full",
      );

// A benchmark must stay deterministic, so it keeps the requested preset and
// runs no show even when both are asked for.
const show =
  request.has("show") && !benchmark
    ? {
        schedule: PIECE_SCHEDULE,
        language: resolveNarrationLanguage(request.get("language")),
        levels: SHOW_LEVEL_PRESETS,
      }
    : undefined;

const level = await startLevel(
  document.querySelector(".app"),
  show ? SHOW_LEVEL : LEVEL_CATALOG[levelName],
  { benchmark, show },
);

window.showClock = level.show?.clock;

// A station needs a show to conduct, and a benchmark must stay free of both.
if (level.show && request.has("station")) {
  connectShowStation({
    level,
    show: level.show,
    stationUrl: resolveStationUrl(request.get("station")),
  });
}
