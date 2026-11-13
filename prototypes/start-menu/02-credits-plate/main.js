/**
 * Credits Plate: the finale's scent signatures rise slowly from below while the
 * text stands like the closing panel. Loading reads as a credit list of stages.
 * Wind follows the pointer; launching lets every scent lift away at once.
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

const menu = createMenuFlow({ slug: "02-credits-plate", loadSeconds: 7 });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.14,
  glint: 0.3,
});

// 1. Loading stages written as credit lines
const stageList = document.querySelector("[data-stage-list]");
function renderStages() {
  const stages = menu.t("stages");
  if (stageList.children.length !== stages.length) {
    stageList.replaceChildren(
      ...stages.map(() => document.createElement("li")),
    );
  }
  const current = Math.min(
    Math.floor(menu.progress * stages.length),
    stages.length - 1,
  );
  stages.forEach((text, index) => {
    const item = stageList.children[index];
    item.textContent = text;
    item.dataset.state =
      menu.ready || index < current
        ? "done"
        : index === current
          ? "current"
          : "pending";
  });
}
menu
  .on("progress", renderStages)
  .on("ready", renderStages)
  .on("settings", renderStages);
renderStages();

// 2. Rising scent motes
const COUNT = 700;
const random = rng(23);
const palette = [...COLORS.scent, ...COLORS.animal].map(rgb);
const motes = Array.from({ length: COUNT }, () => spawn({}, true));
const batch = new PointBatch(COUNT);
let wind = 0;
let lift = 0;

function spawn(mote, anywhere = false) {
  mote.x = random();
  mote.age = anywhere ? random() : 0;
  mote.life = 9 + random() * 10;
  mote.rise = 0.35 + random() * 0.45; // fraction of screen height over a life
  mote.phase = random() * Math.PI * 2;
  mote.sway = 0.01 + random() * 0.03;
  mote.color = palette[Math.floor(random() * palette.length)];
  mote.size = 4.5 + random() * 7;
  mote.order = random();
  mote.glass = random() < 0.25 ? 1 : 0;
  return mote;
}

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const visible = Math.floor(COUNT * menu.quality);
  const launching = menu.screen === "launch";
  wind = approach(wind, menu.input.x * 0.06, 1.5, dt);
  lift = approach(lift, launching ? 1 : 0, 1.2, dt);
  const speed = menu.motion * (1 + lift * 5);

  batch.reset();
  for (let i = 0; i < visible; i += 1) {
    const mote = motes[i];
    mote.age += (dt / mote.life) * speed;
    if (mote.age >= 1) spawn(mote);
    const age = mote.age;
    const x =
      (mote.x + Math.sin(time * 0.4 + mote.phase) * mote.sway + wind * age) *
      width;
    const y = height * (1.02 - age * mote.rise * (1 + lift));
    // Scent thins as it rises: fade in quickly, out slowly.
    const envelope = Math.min(age * 8, 1) * (1 - age) ** 1.4;
    const present = Math.min(
      Math.max((menu.progress * 1.2 - mote.order) * 6, 0),
      1,
    );
    batch.push(
      x,
      y,
      mote.size * (0.7 + age * 0.6),
      mote.color,
      envelope * present * 0.9,
      0,
      mote.glass,
    );
  }
  renderer.clear();
  renderer.drawPoints(batch);
});
