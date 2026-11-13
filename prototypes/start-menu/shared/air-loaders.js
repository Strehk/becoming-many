/**
 * Purpose: Loading figures that only waft, for 07-09.
 * Context: A figure that builds with the percentage needs a long load to make
 *   sense. These never build: the air gathers within a second and then keeps
 *   moving the way a loading sign does, for as long as loading takes, one
 *   second or twenty. When loading completes, the same particles write the
 *   title.
 * Responsibility: Three shapes (circling, flock, endless) and the loop that
 *   recruits a figure for them.
 * Boundary: The title and everything after loading belong to air-title.js.
 */

import { hash } from "./air-borrow.js";
import { createFigure } from "./air-figure.js";

const TAU = Math.PI * 2;
const size = (view) => Math.min(view.width, view.height);

/** Circling: a spinner of dust, a dense head and a thinning tail. */
export function circling(borrow, depth) {
  return {
    depth,
    at(index, t, out) {
      const view = borrow.view;
      const radius = size(view) * 0.13 * (1 + Math.sin(t * 1.1) * 0.04);
      const u = hash(index, 1);
      // Most particles crowd the head; the tail spreads behind it.
      const behind = u * u * 0.88;
      const angle = TAU * (t * 0.42 - behind) - Math.PI / 2;
      const loose = 0.08 + u * 0.32;
      const r =
        radius *
        (1 +
          (hash(index, 2) - 0.5) * loose +
          Math.sin(angle * 3 + t * 0.8) * 0.05);
      out.x = Math.cos(angle) * r;
      out.y = Math.sin(angle) * r;
      out.depth = (hash(index, 3) - 0.5) * 5 * (0.4 + u);
    },
  };
}

/** Flock: a murmuration that stretches, folds and turns over itself. */
export function flock(borrow, depth) {
  return {
    depth,
    at(index, t, out) {
      const view = borrow.view;
      const s = size(view) * 0.16;
      // A soft ball of places, each particle with its own small wander.
      const a = hash(index, 1) * TAU;
      const b = Math.acos(2 * hash(index, 2) - 1);
      const r = Math.cbrt(hash(index, 3));
      let px = Math.sin(b) * Math.cos(a) * r;
      let py = Math.sin(b) * Math.sin(a) * r;
      const pz = Math.cos(b) * r;
      px += Math.sin(t * (0.6 + hash(index, 4)) + index) * 0.06;
      py += Math.cos(t * (0.5 + hash(index, 5)) + index) * 0.06;
      // The whole flock stretches along a slowly turning axis and folds.
      const turn = t * 0.23;
      const along = 1.7 + Math.sin(t * 0.41) * 0.6;
      const across = 0.55 + Math.cos(t * 0.53) * 0.2;
      const fold = Math.sin(px * 2.6 + t * 1.05) * 0.32;
      const x = px * along;
      const y = py * across + fold;
      out.x =
        (x * Math.cos(turn) - y * Math.sin(turn)) * s +
        Math.sin(t * 0.37) * s * 0.35;
      out.y =
        (x * Math.sin(turn) + y * Math.cos(turn)) * s * 0.8 +
        Math.sin(t * 0.29) * s * 0.18;
      out.depth = pz * 6;
    },
  };
}

/** Endless: a stream running along a figure eight that twists in depth. */
export function endless(borrow, depth) {
  return {
    depth,
    at(index, t, out) {
      const view = borrow.view;
      const width = Math.min(view.width * 0.36, size(view) * 0.42);
      const u = hash(index, 1);
      // Two denser heads chase each other around the loop.
      const crowd =
        u < 0.5 ? (u * 2) ** 2 * 0.5 : 0.5 + ((u - 0.5) * 2) ** 2 * 0.5;
      const phi = TAU * (crowd + t * 0.16);
      const spread = (hash(index, 2) - 0.5) * 2;
      const x = Math.sin(phi);
      const y = Math.sin(phi) * Math.cos(phi);
      // Normal to the curve, for a stream with some body.
      const nx = -Math.cos(2 * phi);
      const ny = Math.cos(phi);
      const norm = Math.hypot(nx, ny) || 1;
      const body = spread * 9 * (0.6 + Math.sin(t * 1.3 + u * 9) * 0.4);
      out.x = x * width + (nx / norm) * body;
      out.y = y * width * 0.9 + (ny / norm) * body;
      out.depth = Math.cos(phi) * 4 + (hash(index, 3) - 0.5) * 1.5;
    },
  };
}

// Spinners made of about a hundred particles, a little larger than a plain
// loading ring (11-13).
const SPIN_SECONDS = 1.6;
const spinRadius = (view) => Math.max(40, Math.min(66, size(view) * 0.072));

/** Ring: the plain spinner's breathing arc, drawn by particles along it. */
export function ringSpinner(borrow, depth) {
  return {
    depth,
    at(index, t, out) {
      const radius = spinRadius(borrow.view);
      const cycle = (t / SPIN_SECONDS) % 1;
      // The arc grows to about two thirds of the ring and shrinks again
      // while the whole turns, like the CSS ring of 10.
      const breath = 0.5 - 0.5 * Math.cos(cycle * TAU);
      const span = 0.05 + 0.62 * breath;
      const start = t * (TAU / SPIN_SECONDS) + cycle * TAU * 0.8;
      const u = hash(index, 1);
      const angle = start - u * span * TAU - Math.PI / 2;
      const r = radius + (hash(index, 2) - 0.5) * 3.6;
      out.x = Math.cos(angle) * r;
      out.y = Math.sin(angle) * r;
      out.depth = (hash(index, 3) - 0.5) * 0.6;
    },
  };
}

/** Dots: a ring of small clusters; the lit one comes forward and turns. */
export function dotsSpinner(borrow, depth) {
  const DOTS = 10;
  return {
    depth,
    at(index, t, out) {
      const radius = spinRadius(borrow.view);
      const dot = index % DOTS;
      const angle = (dot / DOTS) * TAU - Math.PI / 2;
      // A wave runs round the ring; where it is, the cluster swells and
      // leans toward the eye, so its particles grow.
      const phase = (dot / DOTS - t / (SPIN_SECONDS * 0.8)) % 1;
      const lit = Math.max(0, Math.cos(((phase + 1) % 1) * TAU)) ** 4;
      const spread = (1.6 + lit * 3.4) * (radius / 28);
      const a = hash(index, 4) * TAU + t * 2;
      const r = Math.sqrt(hash(index, 5)) * spread;
      out.x = Math.cos(angle) * radius + Math.cos(a) * r;
      out.y = Math.sin(angle) * radius + Math.sin(a) * r;
      out.depth = -lit * depth * 0.32;
    },
  };
}

/** Orbit: three small rings of particles turning in tilted planes. */
export function orbitSpinner(borrow, depth) {
  return {
    depth,
    at(index, t, out) {
      const view = borrow.view;
      const radius = spinRadius(view) * 1.15 * borrow.metersPerPixel(depth);
      const ring = index % 3;
      const u = hash(index, 6);
      // Each ring has a head and a thinning tail, so its turning reads.
      const angle = TAU * (t * 0.55 * (ring % 2 ? -1 : 1) - u * u * 0.75);
      let x = Math.cos(angle) * radius;
      let y = Math.sin(angle) * radius;
      let z = 0;
      // Tilt the ring's plane, each ring by its own angle, all slowly turning.
      const tilt = 1.1;
      const spin = (ring / 3) * TAU + t * 0.35;
      const yz = y * Math.cos(tilt);
      z = y * Math.sin(tilt);
      y = yz;
      const cx = x * Math.cos(spin) - y * Math.sin(spin);
      const cy = x * Math.sin(spin) + y * Math.cos(spin);
      x = cx;
      y = cy;
      out.local = true;
      out.x = x;
      out.y = y;
      out.z = -depth + z;
    },
  };
}

/**
 * Recruit the loading figure quickly and keep it wafting until loading ends;
 * the title adopts its members.
 */
export function runLoader(variant, makeShape, options = {}) {
  const { borrow, menu, title } = variant;
  const figure = createFigure(borrow, { owner: "loading" });
  variant.loading = figure;
  const count = variant.phone
    ? (options.phoneCount ?? 420)
    : (options.count ?? 760);
  const shape = makeShape(borrow, title.shape.depth);
  figure.reshape(shape);
  let loaded = menu.skipped;
  menu.on("loaded", () => {
    loaded = true;
  });
  let started = -1;
  borrow.onUpdate((now) => {
    if (loaded) return;
    if (started < 0) started = now;
    shape.depth = title.shape.depth;
    const share = Math.min(1, (now - started) / 0.4);
    figure.fill(Math.round(count * share), {
      keepVisible: 0.3,
      travel: 0.9,
      centre: { x: 0, y: 0, z: -shape.depth },
    });
  });
  return figure;
}
