/**
 * Flight: the menu is already the tutorial. You glide along a teal particle
 * route through black dust-grain rings while air motes stream past. Loading
 * raises the speed; the pointer or the phone's tilt steers; launching
 * accelerates into White World.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  COLORS,
  createRenderer,
  mixRgb,
  PointBatch,
  rgb,
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "10-flight", loadSeconds: 7 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.14,
  glint: 0.6,
});

const hash = (n) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const pathX = (z) => Math.sin(z * 0.045) * 3.2 + Math.sin(z * 0.017 + 2) * 2;
const pathY = (z) => Math.sin(z * 0.031 + 1) * 1.1;

const NEAR = 0.6;
const FAR = 90;
const RING_SPACING = 26;
const RING_GRAINS = 260;
const air = rgb(COLORS.air);
const black = rgb(COLORS.black);
const tealFrom = rgb(COLORS.pathFrom);
const tealTo = rgb(COLORS.pathTo);
const batch = new PointBatch(9000);

let camZ = 0;
let velocity = 2;
let camX = 0;
let camY = 0;
let dim = 0;

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const focal = Math.min(width, height) * 0.9;
  const cx = width / 2;
  const cy = height / 2;
  const motionScale = menu.motion;
  const quality = menu.quality;

  const target =
    menu.screen === "loading"
      ? 2 + menu.progress * 7
      : menu.screen === "launch"
        ? 34
        : menu.screen === "menu"
          ? 6
          : 2.5;
  velocity = approach(
    velocity,
    target * motionScale,
    menu.screen === "launch" ? 0.8 : 1.5,
    dt,
  );
  camZ += velocity * dt;
  // Follow the route a little ahead, then add the steering offset.
  camX = approach(camX, pathX(camZ + 3) + menu.input.x * 1.8, 2, dt);
  camY = approach(camY, pathY(camZ + 3) + menu.input.y * 1.1, 2, dt);

  dim = approach(
    dim,
    ["settings", "credits", "modes", "launch"].includes(menu.screen) ? 1 : 0,
    3,
    dt,
  );
  batch.reset();
  const project = (x, y, z, size, color, alpha, light = 0, glass = 0) => {
    const rel = z - camZ;
    if (rel < NEAR || rel > FAR) return;
    const sx = cx + ((x - camX) / rel) * focal;
    const sy = cy + ((y - camY) / rel) * focal;
    if (sx < -60 || sx > width + 60 || sy < -60 || sy > height + 60) return;
    const fog = Math.min((FAR - rel) / 25, 1) * Math.min((rel - NEAR) / 1.5, 1);
    batch.push(
      sx,
      sy,
      Math.min((size / rel) * focal, 40),
      color,
      alpha * fog * (1 - dim * 0.6),
      light,
      glass,
    );
  };

  // 1. Air motes: a deterministic field around the route, one per world slot.
  const moteStep = 0.06 / quality;
  const firstMote = Math.ceil(camZ / moteStep);
  for (let k = firstMote; k * moteStep < camZ + FAR; k += 1) {
    const z = k * moteStep;
    const x = pathX(z) + (hash(k) - 0.5) * 22;
    const y = pathY(z) + (hash(k + 0.5) - 0.5) * 13;
    project(
      x,
      y,
      z,
      0.03 + hash(k + 0.25) * 0.03,
      air,
      0.75,
      0,
      hash(k + 0.75) < 0.3 ? 1 : 0,
    );
  }

  // 2. The teal route itself.
  const trailStep = 0.05 / quality;
  const firstTrail = Math.ceil(camZ / trailStep);
  for (let k = firstTrail; k * trailStep < camZ + FAR * 0.7; k += 1) {
    const z = k * trailStep;
    const spread = 0.35;
    const x = pathX(z) + (hash(k * 1.3) + hash(k * 2.1) - 1) * spread;
    const y =
      pathY(z) + 0.9 + (hash(k * 1.7) + hash(k * 2.9) - 1) * spread * 0.6;
    const color = mixRgb(tealFrom, tealTo, hash(k * 3.1));
    project(
      x,
      y,
      z,
      0.022 + hash(k * 4.3) * 0.025,
      color,
      0.85,
      0,
      hash(k * 5.7) < 0.32 ? 1 : 0,
    );
  }

  // 3. Rings standing on the route; the orange sweep runs when one is close.
  const firstRing = Math.ceil(camZ / RING_SPACING);
  for (let r = firstRing; r * RING_SPACING < camZ + FAR; r += 1) {
    const z = r * RING_SPACING;
    const rel = z - camZ;
    const near = Math.max(0, 1 - rel / 22);
    const sweepAngle = time * 3;
    const ringX = pathX(z);
    const ringY = pathY(z) + 0.9;
    const grains = Math.floor(RING_GRAINS * Math.max(quality, 0.5));
    for (let i = 0; i < grains; i += 1) {
      const angle = (i / grains) * Math.PI * 2 + hash(r * 100 + i) * 0.05;
      const radius =
        1.5 + (hash(r * 7 + i * 1.1) + hash(r * 3 + i * 2.3) - 1) * 0.12;
      const depth = (hash(r * 11 + i * 0.7) - 0.5) * 0.25;
      let delta = (angle - sweepAngle) % (Math.PI * 2);
      if (delta < -Math.PI) delta += Math.PI * 2;
      if (delta > Math.PI) delta -= Math.PI * 2;
      const light = Math.exp(-(delta * delta) / 0.2) * near;
      project(
        ringX + Math.cos(angle) * radius,
        ringY + Math.sin(angle) * radius,
        z + depth,
        0.05 + hash(i * 9.1 + r) * 0.035,
        black,
        0.85,
        light,
        hash(i * 3.3 + r) < 0.32 ? 1 : 0,
      );
    }
  }

  renderer.clear();
  renderer.drawPoints(batch);
});
