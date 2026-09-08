/**
 * Purpose: Show lightweight whole-system performance metrics during development.
 * Context: The landscape Test Level needs visible browser diagnostics while it runs.
 * Responsibility: Own the KPI DOM and refresh it from frame and renderer counters.
 * Boundary: The overlay is not an immersive WebXR surface or a world content module.
 */

import type { FrameMetrics } from "../../diagnostics/frame-metrics";
import type { RenderCounters } from "../../world/world-runtime";

import { requireElement } from "../shared/dom";

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
  const root = requireElement(container, "[data-metrics]", HTMLElement);
  const fps = requireElement(root, '[data-metric="fps"]', HTMLOutputElement);
  const p95 = requireElement(root, '[data-metric="p95"]', HTMLOutputElement);
  const drawCalls = requireElement(
    root,
    '[data-metric="draw-calls"]',
    HTMLOutputElement,
  );
  const triangles = requireElement(
    root,
    '[data-metric="triangles"]',
    HTMLOutputElement,
  );
  root.hidden = false;
  let unloaded = false;

  let elapsedSeconds = 0;

  return {
    unload: () => {
      unloaded = true;
      root.hidden = true;
    },
    update(deltaSeconds): void {
      if (unloaded) return;
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
