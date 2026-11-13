/**
 * Gather: while the piece loads, the air around the visitor gathers into a
 * slowly turning globe of particles that builds from its north pole down with
 * the percentage. At 100 % the globe opens and writes the title. The pointer
 * is a small swarm that catches particles out of the space it sweeps.
 */

import { hash } from "../shared/air-borrow.js";
import { createFigure } from "../shared/air-figure.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "04-gather",
  loadSeconds: 9,
  cursor: "swarm",
});
const { borrow, menu, title } = variant;
const figure = createFigure(borrow, { owner: "loading" });
variant.loading = figure;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const TILT = 0.38;
const globe = {
  depth: title.shape.depth,
  count: title.count,
  at(index, t, out) {
    const count = Math.max(globe.count, 1);
    const view = borrow.view;
    const radius =
      Math.min(view.width, view.height) *
      0.19 *
      borrow.metersPerPixel(globe.depth);
    // Fibonacci sphere, filled from the north pole as the members arrive.
    const lat = 1 - (2 * (index + 0.5)) / count;
    const ring = Math.sqrt(1 - lat * lat);
    const angle = index * GOLDEN + t * 0.16;
    const shell = radius * (1 + (hash(index, 1) - 0.5) * 0.07);
    const x = Math.cos(angle) * ring * shell;
    const y = lat * shell;
    const z = Math.sin(angle) * ring * shell;
    out.local = true;
    out.x = x;
    out.y = y * Math.cos(TILT) - z * Math.sin(TILT);
    out.z = -globe.depth + y * Math.sin(TILT) + z * Math.cos(TILT);
  },
};
figure.reshape(globe);

let loaded = menu.skipped;
menu.on("loaded", () => {
  loaded = true;
});
borrow.onUpdate(() => {
  if (loaded) return;
  globe.depth = title.shape.depth;
  globe.count = title.count;
  const wanted = Math.round(globe.count * menu.progress ** 0.85);
  figure.fill(wanted, {
    keepVisible: 0.3,
    travel: 1.2,
    centre: { x: 0, y: 0, z: -globe.depth },
  });
});
