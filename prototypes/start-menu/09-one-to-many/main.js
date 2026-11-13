/**
 * One to Many: loading is a single black grain that keeps dividing. Every new
 * grain is born from its parent and settles into a sunflower spiral, each
 * generation in a further colour of the finale. Holding the centre gathers the
 * swarm; on release into the mode choice it splits into one cluster per way in.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  createRenderer,
  PointBatch,
  rgb,
  rng,
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "09-one-to-many", loadSeconds: 7.5 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.16,
  glint: 0.5,
});

const MAX = 3000;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
// From the first black grain outward through the finale's palette.
const GENERATIONS = [
  0x000000, 0x202126, 0x292e55, 0x072b7d, 0x1c6c8b, 0x55d1ba, 0x50be81,
  0xfcce43, 0xfb5f16, 0xd5198a, 0xa865c7, 0xfda39d,
].map(rgb);
const random = rng(97);
const grains = Array.from({ length: MAX }, (_, index) => {
  const generation = Math.floor(Math.log2(index + 1));
  return {
    parent: index === 0 ? -1 : (index - 1) >> 1,
    generation,
    color: GENERATIONS[Math.min(generation, GENERATIONS.length - 1)],
    size: Math.max(3.4, 26 / (1 + generation * 0.9)),
    born: false,
    x: 0,
    y: 0,
    cluster: index % 3,
    clusterIndex: Math.floor(index / 3),
    glass: random() < 0.3 ? 1 : 0,
    jitter: random() * Math.PI * 2,
  };
});
const batch = new PointBatch(MAX);
const MODES = ["desktop", "vr", "gyro"];

let hold = 0;
let gather = 0;
let launch = 0;
let spin = 0;
let hoveredMode = -1;
menu.on("hold", (value) => {
  hold = value;
});
menu.on("hover", (key) => {
  hoveredMode = MODES.indexOf(key);
});

function modeCenters() {
  return MODES.map((mode) => {
    const node = document.querySelector(
      `[data-screen~="modes"] [data-mode="${mode}"], [data-mode="${mode}"]`,
    );
    if (!node) return [renderer.width / 2, renderer.height / 2];
    const rect = node.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  });
}

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const speed = menu.motion;
  const capacity = Math.floor(MAX * menu.quality);
  // Doubling: the count grows exponentially with loading progress.
  const alive = Math.min(
    capacity,
    Math.floor(2 ** (menu.progress * Math.log2(capacity))),
  );
  const split = menu.screen === "modes" || menu.screen === "launch";
  const quiet = menu.screen === "settings" || menu.screen === "credits";
  gather = approach(gather, hold, 8, dt);
  launch = approach(launch, menu.screen === "launch" ? 1 : 0, 1.3, dt);
  spin += dt * speed * (0.06 + gather * 0.8);

  const radius =
    Math.min(width, height) * (quiet ? 0.48 : 0.36) * (1 - gather * 0.55);
  const cx = width / 2 + menu.input.x * 26;
  const cy = height / 2 + menu.input.y * 20;
  const centers = split ? modeCenters() : null;
  const chosen = MODES.indexOf(menu.launch.mode);
  const clusterRadius = Math.min(width, height) * 0.11;

  batch.reset();
  for (let i = 0; i < alive; i += 1) {
    const grain = grains[i];
    if (!grain.born) {
      const parent = grain.parent >= 0 ? grains[grain.parent] : null;
      grain.x = parent ? parent.x : cx;
      grain.y = parent ? parent.y : cy;
      grain.born = true;
    }
    let tx;
    let ty;
    let alpha = quiet ? 0.3 : 0.92;
    let light = gather * 0.6;
    if (split) {
      const k = grain.cluster;
      const local = grain.clusterIndex;
      const total = alive / 3;
      const hovered = k === hoveredMode;
      const isChosen = menu.screen === "launch" && k === chosen;
      const r =
        clusterRadius *
        Math.sqrt(local / Math.max(total, 1)) *
        (hovered ? 1.25 : 1) *
        (isChosen ? 1 + launch * 9 : 1);
      const a = local * GOLDEN + spin * (hovered ? 6 : 1) * (k % 2 ? 1 : -1);
      tx = centers[k][0] + Math.cos(a) * r;
      ty = centers[k][1] + Math.sin(a) * r;
      if (menu.screen === "launch" && !isChosen) alpha *= 1 - launch;
      if (isChosen) alpha *= 1 - launch * 0.5;
      light = hovered ? 0.5 + 0.5 * Math.sin(time * 4 + local * 0.05) : 0;
    } else {
      const r = radius * Math.sqrt(i / Math.max(alive, 1));
      const a = i * GOLDEN + spin;
      const breathe = 1 + Math.sin(time * 1.2 + grain.jitter) * 0.015;
      tx = cx + Math.cos(a) * r * breathe;
      ty = cy + Math.sin(a) * r * breathe;
    }
    grain.x = approach(grain.x, tx, split ? 3.2 : 4.5, dt);
    grain.y = approach(grain.y, ty, split ? 3.2 : 4.5, dt);
    // Grains shrink as their number grows, so the swarm keeps one weight.
    const crowd = Math.max(0.8, 1 - Math.log2(Math.max(alive, 1)) / 20);
    batch.push(
      grain.x,
      grain.y,
      grain.size * crowd,
      grain.color,
      alpha,
      light,
      grain.glass,
    );
  }
  renderer.clear();
  renderer.drawPoints(batch);
});
