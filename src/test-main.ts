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
import { startLevel } from "./levels/level-runtime";
import { loadDeploymentConfig } from "./station/deployment-config";
import { FrameMetricsSampler } from "./test-ui/frame-metrics";
import { loadTestLevelModules } from "./test-ui/test-level-modules";
import { createTestOverlay } from "./test-ui/test-overlay";
import { mountVrEntryButton } from "./world/vr-entry-button";

const request = new URLSearchParams(window.location.search);

// A headset browser has no console, so explicit diagnostics make browser and
// shader failures visible on the development page itself.
if (request.get("diagnostics") !== null) {
  showHeadsetDiagnostics(document.body);
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
const deployment = await loadDeploymentConfig();
const frameMetrics = benchmark ? undefined : new FrameMetricsSampler();
const preset = LEVEL_CATALOG[levelName];
const testModules = await loadTestLevelModules(preset);

const level = await startLevel(document.querySelector(".app"), {
  kind: "static",
  preset,
  benchmark,
  frameMetrics,
  testModules,
  testOverlay: frameMetrics ? createTestOverlay : undefined,
  m5ExpectedDeviceId: deployment.m5DeviceId,
});

mountVrEntryButton(document.body, level.xr);

const m5Host = request.get("m5") ?? deployment.m5Host;
if (m5Host) level.m5?.setHost(m5Host);
