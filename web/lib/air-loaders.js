/**
 * Purpose: The loading spinner, made of the world's own air.
 * Context: It never builds with a percentage: the air gathers within a
 *   second into three tilted, turning rings and keeps turning for as long as
 *   loading takes, one second or twenty. When loading completes, the same
 *   particles write the title.
 * Responsibility: The orbit shape and the loop that recruits a figure for it.
 * Boundary: The title and everything after loading belong to air-title.js;
 *   the stand-in before the world exists is web/early-spinner.js.
 */

import { hash } from "./air-borrow.js";
import { createFigure } from "./air-figure.js";

const TAU = Math.PI * 2;
const size = (view) => Math.min(view.width, view.height);
// About a hundred particles, a little larger than a plain loading ring;
// web/early-spinner.js draws the same radius before the world exists.
const spinRadius = (view) => Math.max(40, Math.min(66, size(view) * 0.072));

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
    // In place (taking over a drawn stand-in) every particle appears at its
    // dot at once; otherwise the air gathers within moments.
    const share = options.instant ? 1 : Math.min(1, (now - started) / 0.4);
    figure.fill(Math.round(count * share), {
      keepVisible: 0.3,
      travel: options.instant ? 0.001 : 0.9,
      centre: { x: 0, y: 0, z: -shape.depth },
    });
  });
  return figure;
}
