/**
 * Purpose: Bootstrap the conductor page.
 * Context: This is the one window a station runs; it hosts the show itself.
 * Responsibility: Read the request and start the page against the piece schedule.
 * Boundary: Everything the page does lives in src/conductor.
 */

import { resolveNarrationLanguage } from "../dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../dramaturgy/piece-schedule";
import { loadDeploymentConfig } from "../station/deployment-config";
import { startConductorPage } from "./conductor-page";

// Runtime request, not authored configuration: `?language=<de|en>` arms the
// session's narration language.
const request = new URLSearchParams(window.location.search);

// Deployment facts the station server was started with; empty when nothing
// answers /config. A set fact renders read-only on this page.
const deployment = await loadDeploymentConfig();

await startConductorPage({
  container: document.querySelector(".conductor"),
  schedule: PIECE_SCHEDULE,
  language: resolveNarrationLanguage(request.get("language")),
  deployment,
});
