/**
 * Night Index: the finale's scent signatures as soft glowing motes on a dark
 * field, additive like light. The field thickens while loading; hovering an
 * item pulls nearby scent toward its row and lights it with the orange sweep.
 */

import { createMenuFlow } from "../shared/menu-flow.js";
import {
  approach,
  COLORS,
  createRenderer,
  flow as flowField,
  PointBatch,
  rgb,
  rng,
} from "../shared/particles.js";

const menu = createMenuFlow({ slug: "03-night-index" });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  background: 0x0b0918,
  glow: 1,
  blend: "additive",
  relief: 0,
  glint: 0,
  lightSizeBoost: 1.2,
});

const COUNT = 1100;
const random = rng(5);
const palette = [
  ...COLORS.scent,
  ...COLORS.animal,
  COLORS.thermal[2],
  COLORS.thermal[3],
].map(rgb);
const motes = Array.from({ length: COUNT }, () => ({
  x: random(),
  y: random(),
  z: 0.2 + random() * 0.8,
  color: palette[Math.floor(random() * palette.length)],
  order: random(),
  phase: random() * 10,
  pull: 0,
}));
const batch = new PointBatch(COUNT);
let anchor = null;
let focus = 0;
let warp = 0;

menu.on("hover", (key) => {
  anchor = key ? menu.anchor(key) : null;
});

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const visible = Math.floor(COUNT * menu.quality);
  const speed = menu.motion;
  focus = approach(focus, anchor ? 1 : 0, 3, dt);
  warp = approach(warp, menu.screen === "launch" ? 1 : 0, 1.2, dt);

  batch.reset();
  for (let i = 0; i < visible; i += 1) {
    const mote = motes[i];
    const [fx, fy] = flowField(mote.x * 2.4, mote.y * 2.4, time * 0.15 * speed);
    mote.x += fx * 0.0003 * speed * mote.z;
    mote.y += (fy * 0.0002 - 0.0004 * mote.z) * speed * (1 + warp * 6);
    if (mote.y < -0.05) mote.y += 1.1;
    mote.x = (mote.x + 1) % 1;

    let x = mote.x * width + menu.input.x * 60 * mote.z;
    let y = mote.y * height + menu.input.y * 40 * mote.z;
    let light = 0;
    if (anchor && focus > 0.01) {
      // Draw scent into a band at the hovered row, to the right of the label.
      const dy = anchor.y - y;
      const reach = Math.exp(-(dy * dy) / (2 * 140 * 140));
      y += dy * reach * 0.55 * focus;
      x += (anchor.rect.right + 120 - x) * reach * 0.08 * focus;
      light = reach * focus * (0.5 + 0.5 * Math.sin(time * 4 - x * 0.02));
    }
    const appear = Math.min(
      Math.max((menu.progress * 1.2 - mote.order) * 5, 0),
      1,
    );
    const twinkle = 0.65 + 0.35 * Math.sin(time * 1.3 + mote.phase);
    // Keep the label column calm: scent thins out toward the left edge.
    const column = Math.min(Math.max((x / width - 0.08) / 0.5, 0.12), 1);
    const size = (6 + mote.z * 22) * (1 + warp * 0.6);
    batch.push(
      x,
      y,
      size,
      mote.color,
      appear * twinkle * column * (0.16 + mote.z * 0.3),
      light * 0.7,
      0,
    );
  }
  renderer.clear();
  renderer.drawPoints(batch);
});
