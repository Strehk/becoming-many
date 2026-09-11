/**
 * Purpose: Select the root page's complete-show or standalone-level startup.
 * Context: One experience page replaces a separate standalone document.
 * Responsibility: Route URL requests without loading standalone tooling for a show.
 * Boundary: The selected entry owns its own lifecycle and browser resources.
 */

import { levelNameFromPath } from "../../shared/level-routes";

const request = new URLSearchParams(window.location.search);
const selectedLevel =
  request.get("level") ?? levelNameFromPath(window.location.pathname);
const startsStandaloneLevel =
  selectedLevel !== undefined && selectedLevel !== "start";

await (startsStandaloneLevel
  ? import("./standalone-level.entry")
  : import("./rehearsal.entry"));
