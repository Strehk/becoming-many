/**
 * Purpose: Show the loading spinner from the very first moment.
 * Context: The real spinner is made of the world's own air particles, so it
 *   can only form once the world has loaded, which is exactly what the
 *   visitor waits for. Until then this draws the very same spinner on a plain
 *   canvas: the same orbit (shared/air-loaders.js, orbitSpinner) at the same
 *   moment of its turn, with the same perspective, dot size and ink. When the
 *   world is there, each real particle takes over its own dot in place; the
 *   canvas keeps drawing only the dots no particle holds yet.
 * Responsibility: Draw the stand-in spinner and hand it over dot by dot.
 * Boundary: No imports, so it starts with the first script; the particle
 *   spinner lives in lib/air-loaders.js.
 */

const TAU = Math.PI * 2;
const hash = (index, salt = 0) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};
/** The experience's camera: 50° vertical field of view. */
const TAN_HALF_FOV = Math.tan((50 * Math.PI) / 360);
/** The air particles' ink. */
const INK = "#202126";
/** Dots no particle has taken by then fade out instead. */
const HANDOVER_SECONDS = 2.5;
const FADE_SECONDS = 0.6;

/**
 * The particle size the title uses, and with it the spinner (it stands at
 * the title's depth): lib/air-title.js, titleParticlePixels.
 */
function dotPixels(title) {
  const fontSize = Number.parseFloat(getComputedStyle(title).fontSize) || 64;
  return Math.min(4.4, Math.max(2.2, fontSize * 0.04));
}

/**
 * @param {{ count: number, round: boolean, title: Element }} options
 */
export function startEarlySpinner({ count, round, title }) {
  const canvas = document.createElement("canvas");
  canvas.className = "early-spinner";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const context = canvas.getContext("2d");
  const shownAt = performance.now();
  let frame = 0;
  /** The particle figure taking over, and when it began. */
  let figure = null;
  let handedAt = 0;
  // Dots once taken stay with the particles, even when the title adopts
  // them and the figure empties.
  let taken = 0;

  function draw(now) {
    frame = requestAnimationFrame(draw);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    // Fades in quickly, so a fast load never flashes it.
    let alpha = Math.min(1, Math.max(0, (now - shownAt) / 1000 / 0.4));
    if (figure) {
      taken = Math.max(taken, figure.count);
      const late = (now - handedAt) / 1000 - HANDOVER_SECONDS;
      if (taken >= count || late >= FADE_SECONDS) {
        stop();
        return;
      }
      if (late > 0) alpha *= 1 - late / FADE_SECONDS;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalAlpha = alpha;
    context.fillStyle = INK;
    // orbitSpinner, in screen pixels at the title's depth.
    const t = now / 1000; // The same clock as the particles (view.now).
    const radius =
      Math.max(40, Math.min(66, Math.min(width, height) * 0.072)) * 1.15;
    // The title's depth in pixels: where one metre of depth shifts the view.
    const depth = height / 2 / TAN_HALF_FOV;
    const pixels = dotPixels(title);
    const cx = width / 2;
    const cy = height / 2;
    for (let index = taken; index < count; index += 1) {
      const ring = index % 3;
      const u = hash(index, 6);
      const angle = TAU * (t * 0.55 * (ring % 2 ? -1 : 1) - u * u * 0.75);
      let x = Math.cos(angle) * radius;
      let y = Math.sin(angle) * radius;
      const tilt = 1.1;
      const spin = (ring / 3) * TAU + t * 0.35;
      const z = y * Math.sin(tilt);
      y *= Math.cos(tilt);
      const rx = x * Math.cos(spin) - y * Math.sin(spin);
      const ry = x * Math.sin(spin) + y * Math.cos(spin);
      // Perspective, as the camera draws the particles: nearer is larger.
      const near = depth / (depth - z);
      x = cx + rx * near;
      y = cy - ry * near;
      // A canvas dot's soft edge reads a little larger than a particle's
      // hard one; 0.92 matches them on screen.
      const size = pixels * near * 0.92;
      if (round) {
        context.beginPath();
        context.arc(x, y, size / 2, 0, TAU);
        context.fill();
      } else context.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }
  frame = requestAnimationFrame(draw);

  function stop() {
    cancelAnimationFrame(frame);
    canvas.remove();
  }

  return {
    /**
     * The particles are there: from now on each real particle holds its own
     * dot (figure members are in dot order), and the canvas draws only the
     * dots still free; any left after a moment fade out.
     */
    handOver(particles) {
      if (figure) return;
      figure = particles ?? { count: 0 };
      handedAt = performance.now();
    },
    /** Loading is over: fade out whatever is still drawn here. */
    fadeOut() {
      figure ??= { count: 0 };
      handedAt = Math.min(
        handedAt || Number.POSITIVE_INFINITY,
        performance.now() - HANDOVER_SECONDS * 1000,
      );
    },
    stop,
  };
}
