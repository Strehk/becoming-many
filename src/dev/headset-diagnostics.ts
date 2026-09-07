/**
 * Purpose: Put errors and GPU facts on screen where no console can be reached.
 * Context: Rehearsal happens in a headset, whose browser offers no developer tools.
 * Responsibility: Mirror failures and one capability report into a readable overlay.
 * Boundary: Nothing here runs unless a run asks for it; the piece itself is untouched.
 */

import type { GraphicsInfo } from "../world/world-runtime";

const MAXIMUM_LINES = 40;
const MAXIMUM_LINE_LENGTH = 600;

/** Install before startup; keep failures visible until the entry ends diagnostics. */
export function showHeadsetDiagnostics(container: HTMLElement): {
  readonly showGraphics: (info: GraphicsInfo) => void;
  readonly unload: () => void;
} {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const overlay = document.createElement("pre");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "margin:0",
    "padding:12px",
    "overflow:auto",
    "z-index:2147483647",
    "font:12px/1.35 ui-monospace,monospace",
    "color:#0b0b0b",
    "background:rgba(255,255,255,0.92)",
    "white-space:pre-wrap",
    "pointer-events:auto",
  ].join(";");
  container.appendChild(overlay);

  const lines: string[] = [];
  let firstError: string | undefined;
  const write = (message: string, fatal = false): void => {
    if (signal.aborted) return;
    const line = safeFormat(message);
    if (fatal && !firstError) firstError = line;
    else lines.push(line);
    if (lines.length >= MAXIMUM_LINES) lines.shift();
    overlay.textContent = [firstError, ...lines].filter(Boolean).join("\n");
  };

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

  const originalError = console.error;
  const originalWarn = console.warn;
  const reportError = (...values: unknown[]): void => {
    const message = values.slice(0, MAXIMUM_LINES).map(safeFormat).join(" ");
    write(message, true);
    originalError(message);
  };
  const reportWarning = (...values: unknown[]): void => {
    const message = values.slice(0, MAXIMUM_LINES).map(safeFormat).join(" ");
    write(message);
    originalWarn(message);
  };
  console.error = reportError;
  console.warn = reportWarning;
  return {
    showGraphics: (info) => {
      for (const [name, value] of Object.entries(info))
        write(`${name}: ${value}`);
    },
    unload,
  };

  function unload(): void {
    if (signal.aborted) return;
    lifetime.abort();
    if (console.error === reportError) console.error = originalError;
    if (console.warn === reportWarning) console.warn = originalWarn;
    overlay.remove();
  }
}

/** Avoid object traversal and user-defined stringification in failure reporting. */
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
