/**
 * Dust Letters: BECOMING MANY condenses out of the Start level's air motes as
 * the experience loads. The pointer pushes the grains aside and they spring
 * back like the tutorial's particle elements. Choosing to begin lets the title
 * come apart into the finale's many colours; going back gathers it again.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  COLORS,
  createRenderer,
  mixRgb,
  PointBatch,
  rgb,
  rng,
  sampleText,
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "06-dust-letters", loadSeconds: 7 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.12,
});

const CAPACITY = 6000;
const random = rng(29);
const ink = rgb(COLORS.ink);
const air = rgb(COLORS.air);
const finale = [
  ...COLORS.scent,
  ...COLORS.animal,
  COLORS.thermal[3],
  COLORS.thermal[5],
  COLORS.pulse,
].map(rgb);
const grains = Array.from({ length: CAPACITY }, () => ({
  x: random() * window.innerWidth,
  y: random() * window.innerHeight,
  vx: 0,
  vy: 0,
  homeX: 0,
  homeY: 0,
  freeX: random(),
  freeY: random(),
  phase: random() * Math.PI * 2,
  threshold: random(),
  size: 1.8 + random() * 2.2,
  finale: finale[Math.floor(random() * finale.length)],
  glass: random() < 0.32 ? 1 : 0,
  mix: 0,
}));
const batch = new PointBatch(CAPACITY);
let homes = 0;

async function layoutTitle() {
  const width = renderer.width;
  const height = renderer.height;
  const narrow = width < 720;
  const lines = narrow ? ["BECOMING", "MANY"] : ["BECOMING MANY"];
  const size = narrow
    ? Math.min(width * 0.155, 120)
    : Math.min(width * 0.088, 150);
  const step = Math.max(3, Math.round(size / 34));
  const centerY = height * (narrow ? 0.36 : 0.42);
  const points = [];
  for (const [index, line] of lines.entries()) {
    const sampled = await sampleText(line, {
      width,
      height: size * 1.3,
      size,
      step,
    });
    const offsetY =
      centerY -
      (size * 1.3) / 2 +
      (index - (lines.length - 1) / 2) * size * 1.02;
    for (const [x, y] of sampled) points.push([x, y + offsetY]);
  }
  // Shuffle so any prefix of the list still covers every letter.
  for (let i = points.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  homes = Math.min(points.length, CAPACITY);
  grains.forEach((grain, i) => {
    const [x, y] = points[i % points.length];
    grain.homeX = x + (random() - 0.5) * step * 0.8;
    grain.homeY = y + (random() - 0.5) * step * 0.8;
    // Grains scale with the sampling step so the letters read as solid dust.
    grain.size = step * (0.75 + random() * 0.6);
  });
}

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(layoutTitle, 200);
});
layoutTitle();

let scatter = 0;
renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const speed = menu.motion;
  const dispersed = menu.screen === "modes" || menu.screen === "launch";
  const quiet = menu.screen === "settings" || menu.screen === "credits";
  scatter = approach(scatter, dispersed ? 1 : 0, 1.6, dt);
  const visible = Math.min(Math.floor(CAPACITY * menu.quality), homes + 700);
  const pointerX = menu.input.px;
  const pointerY = menu.input.py;
  const launchBoost = menu.screen === "launch" ? 2.5 : 1;

  batch.reset();
  for (let i = 0; i < visible; i += 1) {
    const grain = grains[i];
    const formed =
      homes > 0 && i < homes && menu.progress >= grain.threshold && !dispersed;
    let tx;
    let ty;
    if (formed) {
      tx = grain.homeX + menu.input.x * 10;
      ty = grain.homeY + menu.input.y * 8;
    } else {
      // Free drift; when dispersed, a slow swirl around the centre.
      const swirl = time * 0.05 * speed * launchBoost + grain.phase;
      tx = (grain.freeX + Math.sin(swirl) * 0.04 * (1 + scatter)) * width;
      ty =
        (grain.freeY + Math.cos(swirl * 0.8) * 0.04 * (1 + scatter)) * height;
    }
    // Spring toward the target, plus a push away from the pointer.
    const spring = formed ? 16 : 1.2;
    grain.vx += (tx - grain.x) * spring * dt;
    grain.vy += (ty - grain.y) * spring * dt;
    if (menu.input.pointerActive) {
      const dx = grain.x - pointerX;
      const dy = grain.y - pointerY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < 110 * 110) {
        const push = (1 - Math.sqrt(distanceSq) / 110) * 1600 * dt;
        const distance = Math.sqrt(distanceSq) || 1;
        grain.vx += (dx / distance) * push;
        grain.vy += (dy / distance) * push;
      }
    }
    const damping = Math.exp(-(formed ? 7 : 2.2) * dt);
    grain.vx *= damping;
    grain.vy *= damping;
    grain.x += grain.vx * dt * speed;
    grain.y += grain.vy * dt * speed;

    grain.mix = approach(
      grain.mix,
      dispersed ? 1 : 0,
      1.5 + grain.threshold,
      dt,
    );
    const base = formed ? ink : air;
    const color = mixRgb(base, grain.finale, grain.mix);
    const motion = Math.min(Math.hypot(grain.vx, grain.vy) / 600, 1);
    const alpha = (formed ? 0.92 : 0.45) * (quiet ? 0.35 : 1);
    batch.push(
      grain.x,
      grain.y,
      grain.size * (1 + grain.mix * 0.8),
      color,
      alpha,
      motion * 0.6,
      grain.glass,
    );
  }
  renderer.clear();
  renderer.drawPoints(batch);
});
