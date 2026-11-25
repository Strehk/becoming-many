/**
 * Purpose: Select the rehearsal page's complete-show or standalone-level startup.
 * Context: The rehearsal page at /dev (and /<level> links) replaces a separate standalone
 *   document; the root page is the web release's menu.
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
