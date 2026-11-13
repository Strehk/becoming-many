/**
 * Rings: black dust grains from the tutorial. While loading, scattered grains
 * settle one by one into a single ring around the percentage. The ring then
 * divides into three menu rings; pointing at one sends the orange light around
 * it, and choosing one flies you through it before the next screen appears.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  COLORS,
  createRenderer,
  easeOut,
  PointBatch,
  rgb,
  rng,
} from "../shared/particles.js";

const fly = { ring: -1, t: 0, resolve: null };
const ACTIONS = ["start", "settings", "credits"];

const menu = createMenuFlow({
  slug: "05-rings",
  loadSeconds: 7,
  beforeAction(action) {
    const ring = ACTIONS.indexOf(action);
    if (menu.screen !== "menu" || ring < 0) return Promise.resolve();
    return new Promise((resolve) => {
      fly.ring = ring;
      fly.t = 0;
      fly.resolve = resolve;
    });
  },
});
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.14,
  glint: 0.6,
});

const COUNT = 2600;
const random = rng(43);
const gauss = () => (random() + random() + random() - 1.5) / 1.5;
const grains = Array.from({ length: COUNT }, (_, index) => ({
  angle: random() * Math.PI * 2,
  radial: gauss(),
  size: 2 + random() * 2.8,
  glass: random() < 0.32 ? 1 : 0,
  threshold: random() * 0.98,
  ring: index % 3,
  freeX: random(),
  freeY: random(),
  phase: random() * Math.PI * 2,
  x: random() * window.innerWidth,
  y: random() * window.innerHeight,
  rate: 2 + random() * 3,
}));
const black = rgb(COLORS.black);
const air = rgb(COLORS.air);
const batch = new PointBatch(COUNT);
const labels = [...document.querySelectorAll("[data-ring]")];

let hovered = -1;
let hoverLight = 0;
let spread = 0;
let launch = 0;

menu.on("hover", (key) => {
  hovered = ACTIONS.indexOf(key);
});

function menuLayout(width, height) {
  const portrait = height > width * 1.1;
  return [0, 1, 2].map((k) =>
    portrait
      ? {
          x: width / 2,
          y: height * (0.32 + k * 0.22),
          r: Math.min(width * 0.26, height * 0.095),
        }
      : {
          x: width * (0.25 + k * 0.25),
          y: height * 0.56,
          r: Math.min(width * 0.1, height * 0.2),
        },
  );
}

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const speed = menu.motion;
  const minSide = Math.min(width, height);
  const layout = menuLayout(width, height);
  const inMenu = menu.screen === "menu";
  spread = approach(spread, inMenu ? 1 : 0, 2.2, dt);
  hoverLight = approach(hoverLight, hovered >= 0 ? 1 : 0, 5, dt);
  launch = approach(launch, menu.screen === "launch" ? 1 : 0, 1.4, dt);

  if (fly.ring >= 0) {
    fly.t = Math.min(fly.t + dt / 0.75, 1);
    if (fly.t >= 1) {
      fly.resolve?.();
      fly.ring = -1;
      fly.resolve = null;
    }
  }
  const flyEase = fly.ring >= 0 ? easeOut(fly.t) : 0;

  labels.forEach((label, k) => {
    label.style.left = `${layout[k].x}px`;
    label.style.top = `${layout[k].y}px`;
  });

  // The ring plane turns with the pointer, so the circles read as hoops in space.
  const tiltX = 1 - Math.abs(menu.input.x) * 0.45;
  const tiltY = 1 - Math.abs(menu.input.y) * 0.3;
  const bandAngle = time * 1.6 * speed;
  const visible = Math.floor(COUNT * menu.quality);

  batch.reset();
  for (let i = 0; i < visible; i += 1) {
    const grain = grains[i];
    const angle = grain.angle + time * 0.05 * speed * (grain.ring % 2 ? 1 : -1);
    let tx;
    let ty;
    let alpha = 0.85;
    let light = 0;
    let size = grain.size;

    // Single ring: loading and every non-menu screen.
    const bigR =
      minSide * (menu.screen === "loading" ? 0.3 : 0.4) * (1 + launch * 2.2);
    const bx =
      width / 2 +
      Math.cos(angle) * (bigR + grain.radial * minSide * 0.022) * tiltX;
    const by =
      height / 2 +
      Math.sin(angle) * (bigR + grain.radial * minSide * 0.022) * tiltY;
    // Three rings: menu.
    const slot = layout[grain.ring];
    const isFly = grain.ring === fly.ring;
    const ringR =
      slot.r *
      (grain.ring === hovered ? 1.1 : 1) *
      (isFly ? 1 + flyEase * flyEase * 9 : 1);
    const mx =
      slot.x + Math.cos(angle) * (ringR + grain.radial * slot.r * 0.09) * tiltX;
    const my =
      slot.y + Math.sin(angle) * (ringR + grain.radial * slot.r * 0.09) * tiltY;

    tx = bx + (mx - bx) * spread;
    ty = by + (my - by) * spread;

    if (menu.screen === "loading" && menu.progress < grain.threshold) {
      // Not yet arrived: drift as an air mote.
      tx = (grain.freeX + Math.sin(time * 0.1 + grain.phase) * 0.02) * width;
      ty = (grain.freeY + Math.cos(time * 0.08 + grain.phase) * 0.02) * height;
      alpha = 0.35;
      size *= 0.8;
    } else if (!inMenu && menu.screen !== "loading") {
      alpha = 0.22 * (1 - launch * 0.6);
    }
    if (isFly) {
      alpha *= 1 - flyEase;
      size *= 1 + flyEase * 2;
    } else if (fly.ring >= 0) {
      alpha *= 1 - flyEase;
    }

    // Orange light circling the pointed ring, or the loaded ring.
    const sweepActive =
      (inMenu && grain.ring === hovered) ||
      (menu.screen === "loading" && menu.ready);
    if (sweepActive) {
      let delta = (angle - bandAngle) % (Math.PI * 2);
      if (delta < -Math.PI) delta += Math.PI * 2;
      if (delta > Math.PI) delta -= Math.PI * 2;
      light = Math.exp(-(delta * delta) / 0.18) * (inMenu ? hoverLight : 0.9);
    }

    grain.x = approach(grain.x, tx, grain.rate * (fly.ring >= 0 ? 4 : 1), dt);
    grain.y = approach(grain.y, ty, grain.rate * (fly.ring >= 0 ? 4 : 1), dt);
    const depth = 1 + 0.25 * Math.sin(angle) * (1 - tiltY + 0.2);
    const color = alpha < 0.4 && menu.screen === "loading" ? air : black;
    batch.push(
      grain.x,
      grain.y,
      size * depth,
      color,
      alpha,
      light,
      grain.glass,
    );
  }
  renderer.clear();
  renderer.drawPoints(batch);
});
