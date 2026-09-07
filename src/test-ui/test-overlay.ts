/**
 * Purpose: Show lightweight whole-system performance metrics during development.
 * Context: The landscape Test Level needs visible browser diagnostics while it runs.
 * Responsibility: Own the KPI DOM and refresh it from frame and renderer counters.
 * Boundary: The overlay is not an immersive WebXR surface or a world content module.
 */

import type { RenderCounters } from "../world/world-runtime";
import type { FrameMetrics } from "./frame-metrics";
import "./test-overlay.css";

const DISPLAY_REFRESH_SECONDS = 0.25;
const INTEGER_FORMAT = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

export interface TestOverlay {
  readonly unload: () => void;
  readonly update: (deltaSeconds: number) => void;
}

export function createTestOverlay(
  container: HTMLElement,
  renderCounters: RenderCounters,
  readFrameMetrics: () => FrameMetrics | undefined,
): TestOverlay {
  const root = document.createElement("aside");
  root.className = "test-overlay";
  root.setAttribute("aria-label", "Performance metrics");

  const fps = createMetricOutput(root, "FPS");
  const p95 = createMetricOutput(root, "P95");
  const drawCalls = createMetricOutput(root, "DRAW CALLS");
  const triangles = createMetricOutput(root, "DREIECKE");
  container.append(root);

  let elapsedSeconds = 0;

  return {
    unload: () => root.remove(),
    update(deltaSeconds): void {
      elapsedSeconds += deltaSeconds;
      if (elapsedSeconds < DISPLAY_REFRESH_SECONDS) return;

      elapsedSeconds %= DISPLAY_REFRESH_SECONDS;
      const snapshot = readFrameMetrics();
      if (!snapshot) return;

      fps.textContent = INTEGER_FORMAT.format(
        Math.round(snapshot.framesPerSecond),
      );
      p95.textContent = `${snapshot.p95Milliseconds.toFixed(1)} ms`;
      drawCalls.textContent = INTEGER_FORMAT.format(renderCounters.calls);
      triangles.textContent = INTEGER_FORMAT.format(renderCounters.triangles);
    },
  };
}

function createMetricOutput(
  root: HTMLElement,
  labelText: string,
): HTMLOutputElement {
  const card = document.createElement("div");
  card.className = "test-overlay__card";

  const label = document.createElement("span");
  label.className = "test-overlay__label";
  label.textContent = labelText;

  const value = document.createElement("output");
  value.className = "test-overlay__value";
  value.textContent = "--";

  card.append(label, value);
  root.append(card);
  return value;
}
