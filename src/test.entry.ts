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
import { type Run, startLevel } from "./levels/level.runtime";
import { LEVEL_CATALOG, resolveLevelName } from "./levels/level-catalog";
import { levelNameFromPath } from "./levels/level-names";
import { loadDeploymentConfig } from "./station/deployment-config";
import { FrameMetricsSampler } from "./test-ui/frame-metrics";
import { loadTestLevelModules } from "./test-ui/test-level-modules";
import { createTestOverlay, type TestOverlay } from "./test-ui/test-overlay";
import { mountVrEntryButton } from "./ui/xr-entry-button";

const lifetime = new AbortController();
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    lifetime.abort();
    diagnostics?.unload();
  }
});
const request = new URLSearchParams(window.location.search);

// A headset browser has no console, so explicit diagnostics make browser and
// shader failures visible on the development page itself.
const diagnostics =
  request.get("diagnostics") !== null
    ? showHeadsetDiagnostics(document.body)
    : undefined;

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
  let overlay: TestOverlay | undefined;
  const container = document.querySelector<HTMLElement>(".app");
  const testModules = await loadTestLevelModules(preset);

  level = await startLevel(container, {
    signal: lifetime.signal,
    kind: "static",
    preset,
    benchmark,
    onFrame: frameMetrics
      ? (deltaSeconds) => {
          frameMetrics.add(deltaSeconds);
          overlay?.update(deltaSeconds);
        }
      : undefined,
    testModules,
    m5ExpectedDeviceId: deployment.m5DeviceId,
  });
  lifetime.signal.throwIfAborted();
  diagnostics?.showGraphics(level.readGraphicsInfo());
  if (frameMetrics && container) {
    overlay = createTestOverlay(container, level.renderCounters, () =>
      frameMetrics.read(),
    );
    lifetime.signal.addEventListener("abort", overlay.unload, { once: true });
  }

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
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = "Unable to start Becoming Many. Please reload.";
    (document.querySelector(".app") ?? document.body).append(alert);
    throw failure;
  }
}
