/**
 * Particle Trail: the Start level's teal flight path drawn as the loading bar.
 * Its head carries the percentage; once loaded, three small dust-grain rings
 * mark the menu stations along the route. Hovering a station sends the
 * tutorial's orange light sweep up the trail to it.
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
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "04-particle-trail", loadSeconds: 7 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.14,
});

// 1. Route: a Catmull-Rom curve through authored points, sampled by arc length
const CONTROL = [
  [-0.08, 0.86],
  [0.12, 0.8],
  [0.26, 0.56],
  [0.4, 0.66],
  [0.56, 0.5],
  [0.66, 0.3],
  [0.8, 0.42],
  [0.9, 0.62],
  [1.1, 0.58],
];
const STATIONS = [0.38, 0.6, 0.8];
const SAMPLES = 800;
let route = [];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [0, 1].map(
    (k) =>
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
  );
}

function buildRoute(width, height) {
  const raw = [];
  for (let i = 0; i < CONTROL.length - 1; i += 1) {
    const p0 = CONTROL[Math.max(i - 1, 0)];
    const p3 = CONTROL[Math.min(i + 2, CONTROL.length - 1)];
    for (let s = 0; s < 60; s += 1) {
      const [x, y] = catmull(p0, CONTROL[i], CONTROL[i + 1], p3, s / 60);
      raw.push([x * width, y * height]);
    }
  }
  const lengths = [0];
  for (let i = 1; i < raw.length; i += 1) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]),
    );
  }
  const total = lengths[lengths.length - 1];
  route = [];
  let j = 0;
  for (let i = 0; i <= SAMPLES; i += 1) {
    const target = (i / SAMPLES) * total;
    while (j < lengths.length - 2 && lengths[j + 1] < target) j += 1;
    const local =
      (target - lengths[j]) / Math.max(lengths[j + 1] - lengths[j], 0.001);
    const x = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * local;
    const y = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * local;
    const angle = Math.atan2(
      raw[j + 1][1] - raw[j][1],
      raw[j + 1][0] - raw[j][0],
    );
    route.push([x, y, angle]);
  }
}

function sample(u) {
  const index = Math.min(Math.max(Math.round(u * SAMPLES), 0), SAMPLES);
  return route[index];
}

// 2. Particles along the trail, plus three station rings
const COUNT = 5200;
const random = rng(17);
const from = rgb(COLORS.pathFrom);
const to = rgb(COLORS.pathTo);
const gauss = () => (random() + random() + random() - 1.5) / 1.5;
const grains = Array.from({ length: COUNT }, () => ({
  u: random(),
  side: gauss(),
  lift: gauss() * 0.4,
  size: 2 + random() * 3.6,
  color: mixRgb(from, to, random()),
  glass: random() < 0.32 ? 1 : 0,
  phase: random() * Math.PI * 2,
}));
const RING_GRAINS = 90;
const ringGrains = Array.from({ length: RING_GRAINS * 3 }, (_, i) => ({
  station: Math.floor(i / RING_GRAINS),
  angle: random() * Math.PI * 2,
  radius: 1 + gauss() * 0.12,
  size: 2 + random() * 2.5,
  glass: random() < 0.32 ? 1 : 0,
}));
const black = rgb(COLORS.black);
const batch = new PointBatch(COUNT + ringGrains.length);

let reveal = 0;
let hoverStation = -1;
let hoverLight = 0;
let ringsIn = 0;
let flowOffset = 0;
let dim = 0;
const stationButtons = [...document.querySelectorAll("[data-station]")];
const headLabel = document.querySelector("[data-trail-head]");

menu.on("hover", (key) => {
  const index = ["start", "settings", "credits"].indexOf(key);
  if (index >= 0) hoverStation = index;
  else if (!key) hoverStation = -1;
});

let lastSize = "";
renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const size = `${width}x${height}`;
  if (size !== lastSize) {
    buildRoute(width, height);
    lastSize = size;
  }
  const speed = menu.motion;
  reveal = approach(reveal, menu.progress, 5, dt);
  hoverLight = approach(hoverLight, hoverStation >= 0 ? 1 : 0, 4, dt);
  ringsIn = approach(ringsIn, menu.screen === "menu" ? 1 : 0, 3, dt);
  dim = approach(
    dim,
    ["settings", "credits", "modes", "launch"].includes(menu.screen) ? 1 : 0,
    3,
    dt,
  );
  const launching = menu.screen === "launch";
  flowOffset += dt * speed * (launching ? 0.25 : 0.004);

  // DOM: the loading head and the station labels ride the route.
  const head = sample(Math.min(reveal, 0.999));
  headLabel.style.left = `${head[0]}px`;
  headLabel.style.top = `${head[1]}px`;
  stationButtons.forEach((button, index) => {
    const [x, y] = sample(STATIONS[index]);
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.dataset.side = index === 1 ? "above" : "below";
  });

  const visible = Math.floor(COUNT * menu.quality);
  const target = hoverStation >= 0 ? STATIONS[hoverStation] : 0;
  const band = ((time * 0.45) % 1.15) * target;
  const parallaxX = menu.input.x * 18;
  const parallaxY = menu.input.y * 12;

  batch.reset();
  for (let i = 0; i < visible; i += 1) {
    const grain = grains[i];
    const u = (grain.u + flowOffset) % 1;
    if (u > reveal) continue;
    const [x, y, angle] = sample(u);
    const wobble = Math.sin(time * 0.8 * speed + grain.phase) * 1.5;
    const spread = 13 * grain.side + wobble;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const px = x + nx * spread + parallaxX * (1 + grain.lift);
    const py = y + ny * spread + grain.lift * 10 + parallaxY * (1 + grain.lift);
    // Fresh trail fades in just behind the head.
    const fresh = Math.min((reveal - u) * 30, 1);
    let light = 0;
    if (hoverLight > 0.01 && u <= target + 0.02) {
      const wave = (u - band) / 0.035;
      light = Math.exp(-wave * wave) * hoverLight;
    }
    if (!menu.ready) {
      const wave = (u - reveal) / 0.02;
      light = Math.max(light, Math.exp(-wave * wave) * 0.9);
    }
    batch.push(
      px,
      py,
      grain.size,
      grain.color,
      fresh * (0.85 - dim * 0.55),
      light,
      grain.glass,
    );
  }

  if (ringsIn > 0.01) {
    for (const grain of ringGrains) {
      const [x, y, angle] = sample(STATIONS[grain.station]);
      const hovered = grain.station === hoverStation;
      const radius =
        16 * grain.radius * (hovered ? 1.35 : 1) * (0.4 + ringsIn * 0.6);
      // Rings stand across the route, seen slightly from the side.
      const a = grain.angle + time * 0.2 * speed;
      const lx = Math.cos(a) * radius * 0.42;
      const ly = Math.sin(a) * radius;
      const px = x + lx * Math.cos(angle) - ly * Math.sin(angle) + parallaxX;
      const py = y + lx * Math.sin(angle) + ly * Math.cos(angle) + parallaxY;
      const sweep = hovered ? 0.5 + 0.5 * Math.sin(a * 2 - time * 5) : 0;
      batch.push(
        px,
        py,
        grain.size,
        black,
        ringsIn * 0.8,
        sweep * hoverLight,
        grain.glass,
      );
    }
  }

  renderer.clear();
  renderer.drawPoints(batch);
});
