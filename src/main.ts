/**
 * Purpose: Bootstrap the Becoming Many application.
 * Context: This is the minimal browser entry point.
 * Responsibility: Select the requested level and start the Level Runtime.
 * Boundary: Composition, rendering, and world behavior live elsewhere.
 */

import "./style.css";
import { createBenchmarkRun } from "./benchmark/benchmark-run";
import { isBenchmarkProfileName } from "./benchmark/benchmark-settings";
import { LEVEL_CATALOG, resolveLevelName } from "./levels/level-catalog";
import { startLevel } from "./levels/level-runtime";

// Runtime request, not authored configuration: `?level=<name>` opens any
// preset and `?benchmark[=<profile>]` replays the fixed measurement route.
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

await startLevel(document.querySelector(".app"), LEVEL_CATALOG[levelName], {
  benchmark,
});
