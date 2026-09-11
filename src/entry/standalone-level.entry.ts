import { requireElement } from "../ui/shared/dom";

/**
 * Purpose: Bootstrap standalone development and diagnostic runs.
 * Context: The root page selects this entry without loading it for the complete show.
 * Responsibility: Parse level and direct-M5 requests.
 * Boundary: Show rehearsal and Conductor startup live in their own entries.
 */

import { levelNameFromPath } from "../../shared/level-routes";
import { resolveNarrationLanguage } from "../dramaturgy/narration-catalog";
import { startLevel } from "../levels/level.runtime";
import { LEVEL_CATALOG, resolveLevelName } from "../levels/level-catalog";
import type { Run } from "../levels/run-contract";
import { mountVrEntryButton } from "../ui/shared/xr-entry-button";
import { loadDeploymentConfig } from "./deployment-config";

const lifetime = new AbortController();
const request = new URLSearchParams(window.location.search);
const container = requireElement(document, ".app", HTMLElement);
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) lifetime.abort();
});

const requestedLevel =
  request.get("level") ?? levelNameFromPath(window.location.pathname) ?? null;
const levelName = resolveLevelName(requestedLevel);
let level: Run | undefined;
try {
  const deployment = await loadDeploymentConfig();
  const preset = LEVEL_CATALOG[levelName];
  const canvas = requireElement(
    container,
    ".experience-canvas",
    HTMLCanvasElement,
  );
  level = await startLevel(
    { canvas, viewport: container },
    {
      signal: lifetime.signal,
      kind: "static",
      language: resolveNarrationLanguage(request.get("language")),
      preset,
    },
  );
  lifetime.signal.throwIfAborted();
  const unmountVr = mountVrEntryButton(document.body, level.xr);
  lifetime.signal.addEventListener("abort", unmountVr, { once: true });

  const m5Host = request.get("m5") ?? deployment.m5Host;
  if (m5Host) level.m5?.setHost(m5Host);
} catch (error) {
  let failure = error;
  lifetime.abort();
  try {
    await level?.unload();
  } catch (cleanupError) {
    failure = new AggregateError(
      [error, cleanupError],
      "Page startup and cleanup failed",
    );
  }
  if (failure !== lifetime.signal.reason) {
    requireElement(document, "[data-startup-error]", HTMLElement).hidden =
      false;
    throw failure;
  }
}
