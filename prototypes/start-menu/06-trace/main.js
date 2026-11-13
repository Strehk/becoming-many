/**
 * Trace: loading draws a line of particles from the left margin toward the
 * right, the percentage riding on its tip. At 100 % the line lifts and writes
 * the title, flush left, from left to right. The pointer is a dense tip that
 * leaves a trace of particles in the space, and a hovered entry is underlined
 * with air.
 */

import { hash } from "../shared/air-borrow.js";
import { createFigure } from "../shared/air-figure.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "06-trace",
  loadSeconds: 9,
  cursor: "trail",
  gather: { stagger: 1.2, travel: 1.8 },
});
const { borrow, menu, title } = variant;
const figure = createFigure(borrow, { owner: "loading" });
variant.loading = figure;

// The line spans the type's margins at --horizon.
const root = document.documentElement;
const cssPixels = (name) => {
  const node = document.createElement("div");
  node.style.position = "absolute";
  node.style.width = getComputedStyle(root).getPropertyValue(name).trim();
  document.body.append(node);
  const value = node.getBoundingClientRect().width;
  node.remove();
  return value;
};
let edge = cssPixels("--edge");
let horizon = cssPixels("--horizon");
window.addEventListener("resize", () => {
  edge = cssPixels("--edge");
  horizon = cssPixels("--horizon");
});

const line = {
  depth: title.shape.depth,
  count: title.count,
  at(index, t, out) {
    const view = borrow.view;
    const share = index / Math.max(line.count - 1, 1);
    const pixels = title.pixels;
    // A band of loose dust, densest along its middle, not a ruled stroke.
    const spread = (hash(index, 1) + hash(index, 2) + hash(index, 3) - 1.5) * 2;
    out.x =
      edge +
      share * (view.width - 2 * edge) -
      view.width / 2 +
      (hash(index, 4) - 0.5) * pixels * 3;
    out.y =
      horizon -
      view.height / 2 +
      spread * pixels * 3.2 +
      Math.sin(share * 14 - t * 0.9) * pixels * 1.2;
    out.depth = (hash(index, 5) - 0.5) * 4;
  },
};
figure.reshape(line);

let loaded = menu.skipped;
menu.on("loaded", () => {
  loaded = true;
});
const tip = { x: 0, y: 0, z: 0 };
borrow.onUpdate(() => {
  if (loaded) return;
  line.depth = title.shape.depth;
  line.count = title.count;
  const view = borrow.view;
  // Recruit around where the line is about to grow.
  borrow.localAt(
    edge + menu.progress * (view.width - 2 * edge),
    horizon,
    line.depth,
    tip,
  );
  figure.fill(Math.round(line.count * menu.progress), {
    keepVisible: 0.3,
    travel: 0.9,
    centre: tip,
  });
});
