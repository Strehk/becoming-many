/**
 * Purpose: Bootstrap the conductor page.
 * Context: This is the second window of a station, beside the running show.
 * Responsibility: Read the request and start the page against the piece schedule.
 * Boundary: Everything the page does lives in src/conductor and src/station.
 */

import { resolveNarrationLanguage } from "../dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../dramaturgy/piece-schedule";
import { loadDeploymentConfig } from "../station/deployment-config";
import { resolveStationUrl } from "../station/station-settings";
import { startConductorPage } from "./conductor-page";

// Runtime request, not authored configuration: `?station=<ws url>` conducts a
// station on another machine, and `?language=<de|en>` picks the language the
// timeline is measured against until the show reports its own.
const request = new URLSearchParams(window.location.search);

// Deployment facts the station server was started with; empty when nothing
// answers /config. A set fact renders read-only on this page.
const deployment = await loadDeploymentConfig();

startConductorPage({
  container: document.querySelector(".conductor"),
  schedule: PIECE_SCHEDULE,
  language: resolveNarrationLanguage(request.get("language")),
  stationUrl: resolveStationUrl(request.get("station")),
  deployment,
});
