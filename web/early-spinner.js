/**
 * Purpose: Show the loading spinner from the very first moment.
 * Context: The real spinner is made of the world's own air particles, so it
 *   can only form once the world has loaded, which is exactly what the
 *   visitor waits for. Until then this draws the same orbit (three tilted,
 *   turning rings of small dots with thinning tails) on a plain canvas, in
 *   the same place and size; when the particles arrive it fades out under
 *   them.
 * Responsibility: Draw the stand-in spinner and hand over to the particles.
 * Boundary: No imports, so it starts with the first script; the particle
 *   spinner lives in shared/air-loaders.js (orbitSpinner).
 */

const TAU = Math.PI * 2;
const hash = (index, salt = 0) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * @param {{ count: number, round: boolean, skip: boolean }} options
 */
export function startEarlySpinner({ count, round, skip }) {
  if (skip) return { handOver() {}, stop() {} };
  const canvas = document.createElement("canvas");
  canvas.className = "early-spinner";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const context = canvas.getContext("2d");
  const started = performance.now();
  let frame = 0;
  let fadeFrom = null;
  const FADE_SECONDS = 0.9;

  function draw(now) {
    frame = requestAnimationFrame(draw);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const t = (now - started) / 1000;
    // Fades in quickly, so a fast load never flashes it.
    let alpha = Math.min(1, Math.max(0, (t - 0.15) / 0.5));
    if (fadeFrom !== null) {
      const u = (now - fadeFrom) / 1000 / FADE_SECONDS;
      if (u >= 1) {
        stop();
        return;
      }
      alpha *= 1 - u;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    // The particle spinner's geometry (orbitSpinner), in screen pixels.
    const radius =
      Math.max(40, Math.min(66, Math.min(width, height) * 0.072)) * 1.15;
    const cx = width / 2;
    const cy = height / 2;
    const dot = 2.4;
    context.fillStyle = "#202126";
    for (let index = 0; index < count; index += 1) {
      const ring = index % 3;
      const u = hash(index, 6);
      const angle = TAU * (t * 0.55 * (ring % 2 ? -1 : 1) - u * u * 0.75);
      const x0 = Math.cos(angle) * radius;
      const y0 = Math.sin(angle) * radius;
      const tilt = 1.1;
      const spin = (ring / 3) * TAU + t * 0.35;
      const y1 = y0 * Math.cos(tilt);
      const z = y0 * Math.sin(tilt);
      const x = x0 * Math.cos(spin) - y1 * Math.sin(spin);
      const y = x0 * Math.sin(spin) + y1 * Math.cos(spin);
      // Nearer dots a little darker and larger, as with the real particles.
      const near = 0.5 + 0.5 * (z / radius);
      const size = dot * (0.85 + near * 0.3);
      context.globalAlpha = alpha * (0.45 + near * 0.5) * (1 - u * 0.35);
      if (round) {
        context.beginPath();
        context.arc(cx + x, cy - y, size / 2, 0, TAU);
        context.fill();
      } else context.fillRect(cx + x - size / 2, cy - y - size / 2, size, size);
    }
  }
  frame = requestAnimationFrame(draw);

  function stop() {
    cancelAnimationFrame(frame);
    canvas.remove();
  }

  return {
    /** The particles are forming: fade out under them. */
    handOver() {
      fadeFrom ??= performance.now();
    },
    stop,
  };
}
