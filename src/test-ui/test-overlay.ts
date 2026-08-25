/**
 * Purpose: Show lightweight whole-system performance metrics during development.
 * Context: The landscape Test Level needs visible browser diagnostics while it runs.
 * Responsibility: Own the KPI DOM and refresh it from frame and renderer counters.
 * Boundary: The overlay is not an immersive WebXR surface or a world content module.
 */

import type { WebGLRenderer } from "three";
import { FrameMetricsSampler } from "./frame-metrics";
import "./test-overlay.css";

const DISPLAY_REFRESH_SECONDS = 0.25;
const INTEGER_FORMAT = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

export interface TestOverlay {
  readonly update: (deltaSeconds: number) => void;
}

interface MetricOutput {
  readonly value: HTMLOutputElement;
}

export function createTestOverlay(
  container: HTMLElement,
  renderer: WebGLRenderer,
): TestOverlay {
  const root = document.createElement("aside");
  root.className = "test-overlay";
  root.setAttribute("aria-label", "Performance metrics");

  const fps = createMetricOutput(root, "FPS");
  const p95 = createMetricOutput(root, "P95");
  const drawCalls = createMetricOutput(root, "DRAW CALLS");
  const triangles = createMetricOutput(root, "DREIECKE");
  container.append(root);

  const frameMetrics = new FrameMetricsSampler();
  let elapsedSeconds = 0;

  return {
    update(deltaSeconds): void {
      frameMetrics.add(deltaSeconds);
      elapsedSeconds += deltaSeconds;
      if (elapsedSeconds < DISPLAY_REFRESH_SECONDS) return;

      elapsedSeconds %= DISPLAY_REFRESH_SECONDS;
      const snapshot = frameMetrics.read();
      if (!snapshot) return;

      fps.value.textContent = INTEGER_FORMAT.format(
        Math.round(snapshot.framesPerSecond),
      );
      p95.value.textContent = `${snapshot.p95Milliseconds.toFixed(1)} ms`;
      drawCalls.value.textContent = INTEGER_FORMAT.format(
        renderer.info.render.calls,
      );
      triangles.value.textContent = INTEGER_FORMAT.format(
        renderer.info.render.triangles,
      );
    },
  };
}

function createMetricOutput(
  root: HTMLElement,
  labelText: string,
): MetricOutput {
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
  return { value };
}
