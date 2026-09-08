import { requireElement } from "../ui/shared/dom";

/**
 * Purpose: Bootstrap standalone development and diagnostic runs.
 * Context: Test traffic must not enlarge or branch the root show entry.
 * Responsibility: Parse level, benchmark, diagnostics, and direct-M5 requests.
 * Boundary: Show rehearsal and Conductor startup live in their own entries.
 */

import { levelNameFromPath } from "../../shared/level-routes";
import { createBenchmarkRun } from "../benchmark/benchmark-run";
import { isBenchmarkProfileName } from "../benchmark/benchmark-settings";
import { FrameMetricsSampler } from "../diagnostics/frame-metrics";
import { type Run, startLevel } from "../levels/level.runtime";
import { LEVEL_CATALOG, resolveLevelName } from "../levels/level-catalog";
import { mountVrEntryButton } from "../ui/shared/xr-entry-button";
import { createDiagnosticsOverlay } from "../ui/test/diagnostics-overlay.panel";
import { loadDeploymentConfig } from "./deployment-config";
import { loadTestLevelModules } from "./test-level-modules";

const lifetime = new AbortController();
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    lifetime.abort();
    diagnostics?.unload();
  }
});
const request = new URLSearchParams(window.location.search);
const container = requireElement(document, ".app", HTMLElement);
const diagnostics = createDiagnosticsOverlay(
  container,
  request.get("diagnostics") !== null,
);

// A headset browser has no console, so explicit diagnostics make browser and
// shader failures visible on the development page itself.
const requestedLevel =
  request.get("level") ?? levelNameFromPath(window.location.pathname) ?? null;
const levelName = resolveLevelName(requestedLevel);
const requestedProfile = request.get("benchmark");
const benchmark =
  requestedProfile === null
    ? undefined
    : createBenchmarkRun(
        levelName,
        isBenchmarkProfileName(requestedProfile) ? requestedProfile : "full",
      );
let level: Run | undefined;
try {
  const deployment = await loadDeploymentConfig();
  const preset = LEVEL_CATALOG[levelName];
  const frameMetrics =
    !benchmark && preset.testUi ? new FrameMetricsSampler() : undefined;
  const canvas = requireElement(
    container,
    ".experience-canvas",
    HTMLCanvasElement,
  );
  const testModules = await loadTestLevelModules(preset);

  level = await startLevel(
    { canvas, viewport: container },
    {
      signal: lifetime.signal,
      kind: "static",
      preset,
      benchmark,
      onFrame: frameMetrics
        ? (deltaSeconds) => {
            frameMetrics.add(deltaSeconds);
            diagnostics.update(deltaSeconds);
          }
        : undefined,
      testModules,
      m5ExpectedDeviceId: deployment.m5DeviceId,
    },
  );
  lifetime.signal.throwIfAborted();
  diagnostics.showGraphics(level.readGraphicsInfo());
  if (frameMetrics) {
    diagnostics.startMetrics(level.renderCounters, () => frameMetrics.read());
  }
  lifetime.signal.addEventListener("abort", diagnostics.unload, { once: true });

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
