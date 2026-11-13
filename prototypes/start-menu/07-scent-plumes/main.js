/**
 * Scent Plumes: the finale's scent layer. Plants grow along the ground while
 * loading and start to breathe out their signature colours. Each menu item
 * stands above its own plant; pointing at it makes that plant exhale strongly.
 * The shared wind leans toward the pointer or the phone's tilt.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  COLORS,
  createRenderer,
  PointBatch,
  rgb,
  rng,
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "07-scent-plumes", loadSeconds: 7 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  background: COLORS.haze,
  relief: 0.16,
  glint: 0.3,
});

const random = rng(61);
const ACTIONS = ["start", "settings", "credits"];

// 1. Plants: three menu plants and a row of quieter neighbours
const MAIN = [
  { x: 0.24, shape: "conifer", color: 0x55d1ba, scale: 1 },
  { x: 0.5, shape: "deciduous", color: 0xb185c2, scale: 1.1 },
  { x: 0.76, shape: "bush", color: 0xa865c7, scale: 0.9 },
];
const plants = MAIN.map((plant, index) => ({ ...plant, main: index }));
const ambientColors = [0x6adadd, 0x50be81, 0xb2a17f, ...COLORS.animal];
for (let i = 0; i < 9; i += 1) {
  let x = random();
  if (MAIN.some((plant) => Math.abs(plant.x - x) < 0.08)) x = (x + 0.12) % 1;
  plants.push({
    x,
    shape: ["conifer", "deciduous", "bush"][i % 3],
    color: ambientColors[i % ambientColors.length],
    scale: 0.45 + random() * 0.35,
    main: -1,
  });
}
for (const plant of plants) {
  plant.rgb = rgb(plant.color);
  plant.grow = 0;
  plant.breath = 0;
  plant.spawnDebt = 0;
  // Silhouette grains in plant-local units (height 1, ground at 0).
  plant.body = Array.from({ length: Math.round(220 * plant.scale) }, () => {
    for (;;) {
      const u = random() * 2 - 1;
      const v = random();
      const inside =
        plant.shape === "conifer"
          ? Math.abs(u) < (1 - v) * 0.42 && v > 0.08
          : plant.shape === "deciduous"
            ? (u * u) / 0.2 + ((v - 0.62) * (v - 0.62)) / 0.13 < 1 ||
              (Math.abs(u) < 0.04 && v < 0.4)
            : (u * u) / 0.36 + (v * v) / 0.36 < 1;
      if (inside) return { u, v, size: 2 + random() * 2.4, shade: random() };
    }
  });
}
const labels = [...document.querySelectorAll("[data-plant]")];
labels.forEach((label, index) => {
  label.style.setProperty(
    "--plant",
    `#${MAIN[index].color.toString(16).padStart(6, "0")}`,
  );
});

// 2. Scent particle pool
const CAPACITY = 4200;
const scent = Array.from({ length: CAPACITY }, () => ({ alive: false }));
let cursor = 0;
const dark = rgb(0x171717);
const shade = rgb(0x494949);
const batch = new PointBatch(
  CAPACITY + plants.reduce((sum, plant) => sum + plant.body.length, 0),
);

function emit(plant, ground, unit) {
  const particle = scent[cursor];
  cursor = (cursor + 1) % CAPACITY;
  const angle = random() * Math.PI * 2;
  const radius = 0.35 + random() * 0.65;
  particle.alive = true;
  particle.x =
    plant.x * renderer.width +
    Math.cos(angle) * radius * unit * 0.35 * plant.scale;
  particle.y = ground - (0.2 + random() * 0.8) * unit * plant.scale;
  particle.age = 0;
  particle.life = 6 + random() * 6;
  particle.rise =
    unit *
    (1.1 + random() * 1.6) *
    (plant.main >= 0 ? 1.4 : 1) *
    (1 + plant.breath * 1.2);
  particle.drift = (random() - 0.5) * unit * 0.6;
  particle.phase = random() * Math.PI * 2;
  particle.size = 4 + random() * 5;
  particle.color = plant.rgb;
  particle.glass = random() < 0.25 ? 1 : 0;
}

let hovered = -1;
let wind = 0;
menu.on("hover", (key) => {
  hovered = ACTIONS.indexOf(key);
});

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const portrait = height > width * 1.1;
  const unit = Math.min(height * 0.16, width * (portrait ? 0.2 : 0.12));
  MAIN.forEach((plant, index) => {
    plants[index].x = portrait ? [0.18, 0.5, 0.82][index] : plant.x;
  });
  const ground = height * 0.97;
  const speed = menu.motion;
  const launching = menu.screen === "launch";
  wind = approach(
    wind,
    menu.input.x * unit * 1.4 + (launching ? unit * 2 : 0),
    1.2,
    dt,
  );

  // Labels hover above their plants.
  labels.forEach((label, index) => {
    const plant = plants[index];
    label.style.left = `${plant.x * width}px`;
    label.style.top = `${ground - unit * plant.scale * 1.15}px`;
  });

  batch.reset();
  const rateScale = menu.quality * speed;
  for (const plant of plants) {
    const order = plant.main >= 0 ? plant.main * 0.12 : 0.2 + plant.x * 0.4;
    plant.grow = approach(
      plant.grow,
      Math.min(Math.max((menu.progress - order) * 3, 0), 1),
      4,
      dt,
    );
    plant.breath = approach(
      plant.breath,
      plant.main === hovered && plant.main >= 0 ? 1 : 0,
      3,
      dt,
    );
    const rate =
      (plant.main >= 0 ? 26 : 10) *
      plant.grow *
      (1 + plant.breath * 4 + (launching ? 5 : 0));
    plant.spawnDebt += rate * dt * rateScale;
    while (plant.spawnDebt >= 1) {
      plant.spawnDebt -= 1;
      emit(plant, ground, unit);
    }
    const sway = Math.sin(time * 0.9 + plant.x * 9) * 0.04;
    for (const grain of plant.body) {
      const h = grain.v * unit * plant.scale * plant.grow;
      const x =
        plant.x * width +
        grain.u * unit * plant.scale * plant.grow +
        sway * h +
        (wind * h) / (unit * 12);
      batch.push(
        x,
        ground - h,
        grain.size,
        grain.shade > 0.7 ? shade : dark,
        0.9 * Math.min(plant.grow * 2, 1),
        0,
        0,
      );
    }
  }

  for (const particle of scent) {
    if (!particle.alive) continue;
    particle.age += (dt / particle.life) * speed * (launching ? 2 : 1);
    if (particle.age >= 1) {
      particle.alive = false;
      continue;
    }
    const age = particle.age;
    const x =
      particle.x +
      particle.drift * age +
      wind * age * age +
      Math.sin(time * 0.7 + particle.phase) * 10 * age;
    const y = particle.y - particle.rise * (1 - (1 - age) ** 2);
    const envelope = Math.min(age * 10, 1) * (1 - age) ** 1.2;
    batch.push(
      x,
      y,
      particle.size * (0.8 + age * 0.5),
      particle.color,
      envelope * 0.95,
      0,
      particle.glass,
    );
  }

  renderer.clear();
  renderer.drawPoints(batch);
});
