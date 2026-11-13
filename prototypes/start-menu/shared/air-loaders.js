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

/**
 * Recruit the loading figure quickly and keep it wafting until loading ends;
 * the title adopts its members.
 */
export function runLoader(variant, makeShape) {
  const { borrow, menu, title } = variant;
  const figure = createFigure(borrow, { owner: "loading" });
  variant.loading = figure;
  const count = variant.phone ? 420 : 760;
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
