/**
 * Purpose: Present performance, graphics, and failure diagnostics in one Test UI.
 * Context: Development and headset browsers need visible diagnostics without a console.
 * Responsibility: Own diagnostic DOM, display cadence, and temporary error hooks.
 * Boundary: It reads existing World facts and never changes runtime behavior.
 */

import type { FrameMetrics } from "../../diagnostics/frame-metrics";
import type { GraphicsInfo, RenderCounters } from "../../world/world-runtime";

import { requireElement } from "../shared/dom";

const DISPLAY_REFRESH_SECONDS = 0.25;
const INTEGER_FORMAT = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});
const MAXIMUM_LINES = 40;
const MAXIMUM_LINE_LENGTH = 600;

export interface DiagnosticsOverlay {
  readonly showGraphics: (info: GraphicsInfo) => void;
  readonly startMetrics: (
    renderCounters: RenderCounters,
    readFrameMetrics: () => FrameMetrics | undefined,
  ) => void;
  readonly unload: () => void;
  readonly update: (deltaSeconds: number) => void;
}

/** Create the shared Test diagnostics surface; error capture is opt-in by URL. */
export function createDiagnosticsOverlay(
  container: HTMLElement,
  captureRuntimeErrors: boolean,
): DiagnosticsOverlay {
  const root = requireElement(container, "[data-diagnostics]", HTMLElement);
  const metrics = requireElement(root, "[data-metrics]", HTMLElement);
  const fps = requireElement(metrics, '[data-metric="fps"]', HTMLOutputElement);
  const p95 = requireElement(metrics, '[data-metric="p95"]', HTMLOutputElement);
  const drawCalls = requireElement(
    metrics,
    '[data-metric="draw-calls"]',
    HTMLOutputElement,
  );
  const triangles = requireElement(
    metrics,
    '[data-metric="triangles"]',
    HTMLOutputElement,
  );
  const log = requireElement(
    root,
    "[data-headset-diagnostics]",
    HTMLPreElement,
  );
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let renderCounters: RenderCounters | undefined;
  let readFrameMetrics: (() => FrameMetrics | undefined) | undefined;
  let elapsedSeconds = 0;
  let firstError: string | undefined;
  const lines: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  if (captureRuntimeErrors) {
    root.hidden = false;
    log.hidden = false;
    write("Renderer not available yet");
    window.addEventListener(
      "error",
      (event) => {
        write(`ERROR ${event.message}`, true);
      },
      { signal },
    );
    window.addEventListener(
      "unhandledrejection",
      (event) => {
        write(`REJECTED ${safeFormat(event.reason)}`, true);
      },
      { signal },
    );
    console.error = (...values: unknown[]) => {
      const message = values.slice(0, MAXIMUM_LINES).map(safeFormat).join(" ");
      write(message, true);
      originalError(message);
    };
    console.warn = (...values: unknown[]) => {
      const message = values.slice(0, MAXIMUM_LINES).map(safeFormat).join(" ");
      write(message);
      originalWarn(message);
    };
  }

  return {
    showGraphics: (info) => {
      if (!captureRuntimeErrors) return;
      for (const [name, value] of Object.entries(info))
        write(`${name}: ${value}`);
    },
    startMetrics: (nextRenderCounters, nextReadFrameMetrics) => {
      renderCounters = nextRenderCounters;
      readFrameMetrics = nextReadFrameMetrics;
      root.hidden = false;
      metrics.hidden = false;
    },
    unload: () => {
      if (signal.aborted) return;
      lifetime.abort();
      if (console.error !== originalError) console.error = originalError;
      if (console.warn !== originalWarn) console.warn = originalWarn;
      root.hidden = true;
      metrics.hidden = true;
      log.hidden = true;
      log.textContent = "";
      renderCounters = undefined;
      readFrameMetrics = undefined;
    },
    update: (deltaSeconds) => {
      if (signal.aborted || !renderCounters || !readFrameMetrics) return;
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

  function write(message: string, fatal = false): void {
    if (signal.aborted) return;
    const line = safeFormat(message);
    if (fatal && !firstError) firstError = line;
    else lines.push(line);
    if (lines.length >= MAXIMUM_LINES) lines.shift();
    log.textContent = [firstError, ...lines].filter(Boolean).join("\n");
  }
}

function safeFormat(value: unknown): string {
  try {
    const text =
      value instanceof Error
        ? value.message
        : value === null ||
            (typeof value !== "object" && typeof value !== "function")
          ? String(value)
          : "[object omitted]";
    return text
      .slice(0, MAXIMUM_LINE_LENGTH)
      .replace(/https?:\/\/[^\s"'<>]+/gi, (address) => {
        const url = new URL(address);
        return `${url.origin}${url.pathname}`;
      })
      .replace(
        /\b[\w-]*(?:password|passwd|token|secret|authorization|api[_-]?key)[\w-]*["']?\s*[:=]\s*[^\r\n]*/gi,
        "[redacted]",
      )
      .replace(/[\r\n]+/g, " ")
      .slice(0, MAXIMUM_LINE_LENGTH);
  } catch {
    return "[unreadable error]";
  }
}
