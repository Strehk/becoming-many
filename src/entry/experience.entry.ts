/**
 * Purpose: Select the root page's complete-show or standalone-level startup.
 * Context: One experience page replaces a separate Test HTML document.
 * Responsibility: Route URL requests without loading standalone tooling for a show.
 * Boundary: The selected entry owns its own lifecycle and browser resources.
 */

import { levelNameFromPath } from "../../shared/level-routes";

const request = new URLSearchParams(window.location.search);
const standaloneParameters = ["benchmark", "diagnostics", "level", "m5"];
const startsStandaloneLevel =
  levelNameFromPath(window.location.pathname) !== undefined ||
  standaloneParameters.some((name) => request.has(name));

await (startsStandaloneLevel
  ? import("./standalone-level.entry")
  : import("./rehearsal.entry"));
