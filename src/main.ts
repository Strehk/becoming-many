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
import { LEVEL_CATALOG, resolveLevelName } from "./levels/level-catalog";
import { startLevel } from "./levels/level-runtime";

declare global {
  interface Window {
    /**
     * Rehearsal transport. The console commands the show through it; nothing
     * under `src` reads it back, so removing it changes no behavior. It is
     * gated on `?show` rather than the build mode because rehearsal happens
     * in the headset, against a production build.
     */
    showClock?: ShowClock;
  }
}

// Runtime request, not authored configuration: `?level=<name>` opens any
// preset, `?benchmark[=<profile>]` replays the fixed measurement route, and
// `?show[&language=<de|en>]` plays the narration schedule against the preset.
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

const show = request.has("show")
  ? {
      schedule: PIECE_SCHEDULE,
      language: resolveNarrationLanguage(request.get("language")),
      onClockReady: (clock: ShowClock): void => {
        window.showClock = clock;
      },
    }
  : undefined;

await startLevel(document.querySelector(".app"), LEVEL_CATALOG[levelName], {
  benchmark,
  show,
});
