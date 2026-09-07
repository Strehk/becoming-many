/**
 * Purpose: Bootstrap standalone development and diagnostic runs.
 * Context: Test traffic must not enlarge or branch the root show entry.
 * Responsibility: Parse level, benchmark, diagnostics, and direct-M5 requests.
 * Boundary: Show rehearsal and Conductor startup live in their own entries.
 */

import "./style.css";
import { createBenchmarkRun } from "./benchmark/benchmark-run";
import { isBenchmarkProfileName } from "./benchmark/benchmark-settings";
import { showHeadsetDiagnostics } from "./dev/headset-diagnostics";
import { LEVEL_CATALOG, resolveLevelName } from "./levels/level-catalog";
import { levelNameFromPath } from "./levels/level-names";
import { type RunningLevel, startLevel } from "./levels/level-runtime";
import { loadDeploymentConfig } from "./station/deployment-config";
import { FrameMetricsSampler } from "./test-ui/frame-metrics";
import { loadTestLevelModules } from "./test-ui/test-level-modules";
import { createTestOverlay } from "./test-ui/test-overlay";
import { mountVrEntryButton } from "./world/vr-entry-button";

const lifetime = new AbortController();
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) lifetime.abort();
});
const request = new URLSearchParams(window.location.search);

// A headset browser has no console, so explicit diagnostics make browser and
// shader failures visible on the development page itself.
if (request.get("diagnostics") !== null) {
  showHeadsetDiagnostics(document.body, lifetime.signal);
}

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
let level: RunningLevel | undefined;
try {
  const deployment = await loadDeploymentConfig();
  const frameMetrics = benchmark ? undefined : new FrameMetricsSampler();
  const preset = LEVEL_CATALOG[levelName];
  const testModules = await loadTestLevelModules(preset);

  level = await startLevel(document.querySelector(".app"), {
    signal: lifetime.signal,
    kind: "static",
    preset,
    benchmark,
    frameMetrics,
    testModules,
    testOverlay: frameMetrics ? createTestOverlay : undefined,
    m5ExpectedDeviceId: deployment.m5DeviceId,
  });
  lifetime.signal.throwIfAborted();

  const unmountVr = mountVrEntryButton(document.body, level.xr);
  lifetime.signal.addEventListener("abort", unmountVr, { once: true });

  const m5Host = request.get("m5") ?? deployment.m5Host;
  if (m5Host) level.m5?.setHost(m5Host);
} catch (error) {
  const wasCancelled =
    lifetime.signal.aborted && error === lifetime.signal.reason;
  lifetime.abort();
  try {
    await level?.unload();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Page startup and cleanup failed",
    );
  }
  if (!wasCancelled) throw error;
}
