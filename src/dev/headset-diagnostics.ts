/**
 * Purpose: Put errors and GPU facts on screen where no console can be reached.
 * Context: Rehearsal happens in a headset, whose browser offers no developer tools.
 * Responsibility: Mirror failures and one capability report into a readable overlay.
 * Boundary: Nothing here runs unless a run asks for it; the piece itself is untouched.
 */

const MAXIMUM_LINES = 40;

/**
 * Install before anything else starts. A shader that fails to compile, an
 * asset that fails to load, and a promise that rejects all reach the console
 * and nowhere else — on a headset that means they vanish. This mirrors them
 * onto the canvas, together with the capability report that explains most
 * differences between a desktop GPU and a mobile one.
 */
export function showHeadsetDiagnostics(container: HTMLElement): void {
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
  const write = (line: string): void => {
    lines.push(line);
    if (lines.length > MAXIMUM_LINES) lines.shift();
    overlay.textContent = lines.join("\n");
  };

  write(describeGraphics());
  write("");

  window.addEventListener("error", (event) => {
    write(`ERROR ${event.message}`);
    write(`  at ${event.filename}:${event.lineno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    write(`REJECTED ${String(event.reason)}`);
  });

  // Three reports a failed shader compile or link through console.error and
  // then carries on with a broken material, which is exactly the case that
  // shows as an empty world rather than as a crash.
  const originalError = console.error.bind(console);
  console.error = (...values: unknown[]): void => {
    write(`CONSOLE ${values.map(String).join(" ").slice(0, 600)}`);
    originalError(...values);
  };
  const originalWarn = console.warn.bind(console);
  console.warn = (...values: unknown[]): void => {
    write(`WARN ${values.map(String).join(" ").slice(0, 300)}`);
    originalWarn(...values);
  };
}

/** One throwaway context, so the report never depends on the running renderer. */
function describeGraphics(): string {
  const canvas = document.createElement("canvas");
  const gl2 = canvas.getContext("webgl2");
  const gl = gl2 ?? canvas.getContext("webgl");
  if (!gl) return "NO WEBGL CONTEXT AT ALL";

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : "unknown";
  const extensions = gl.getSupportedExtensions() ?? [];

  return [
    // First line on purpose: a query parameter that never arrives explains
    // more empty worlds than any GPU limit does.
    `url: ${window.location.href}`,
    `webgl2: ${gl2 !== null}`,
    `renderer: ${renderer}`,
    `vertex texture units: ${gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)}`,
    `max texture size: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`,
    `float linear: ${extensions.includes("OES_texture_float_linear")}`,
    `half float linear: ${extensions.includes("OES_texture_half_float_linear")}`,
    `xr: ${"xr" in navigator}`,
    `ua: ${navigator.userAgent.slice(0, 160)}`,
  ].join("\n");
}
