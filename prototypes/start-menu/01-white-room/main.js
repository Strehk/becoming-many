/**
 * White Room: the Start level's grey air motes drift through White World.
 * Loading lets them appear one by one; hovering lights nearby motes with the
 * tutorial's orange sweep; choosing a way in pulls the field past the viewer.
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

const menu = createMenuFlow({ slug: "01-white-room" });
const renderer = createRenderer(document.querySelector("[data-canvas]"), {
  relief: 0.1,
});

const COUNT = 850;
const random = rng(11);
const motes = Array.from({ length: COUNT }, () => ({
  x: random(),
  y: random(),
  z: 0.25 + random() * 0.75,
  phase: random() * Math.PI * 2,
  order: random(),
  glass: random() < 0.3 ? 1 : 0,
}));
const batch = new PointBatch(COUNT);
const air = rgb(COLORS.air);
const ink = rgb(COLORS.ink);

let warp = 0;
let hoverPoint = null;
let hoverLight = 0;

menu.on("hover", (key) => {
  const node = key
    ? document.querySelector(
        `[data-screen~="${menu.screen}"] [data-mode="${key}"], [data-screen~="${menu.screen}"] [data-action="${key}"]`,
      )
    : null;
  if (node) {
    const rect = node.getBoundingClientRect();
    hoverPoint = [rect.left + rect.width / 2, rect.top + rect.height / 2];
  }
});

renderer.loop((time, dt) => {
  menu.input.update(dt);
  const { width, height } = renderer;
  const visible = Math.floor(COUNT * menu.quality);
  const speed = menu.motion;
  warp = approach(warp, menu.screen === "launch" ? 1 : 0, 1.4, dt);
  hoverLight = approach(hoverLight, menu.hovered ? 1 : 0, 6, dt);

  batch.reset();
  const cx = width / 2;
  const cy = height / 2;
  for (let i = 0; i < visible; i += 1) {
    const mote = motes[i];
    const [fx, fy] = flowField(mote.x * 3, mote.y * 3, time * 0.2 * speed);
    mote.x += (fx * 0.00025 + 0.00008) * mote.z * speed;
    mote.y += (fy * 0.00018 - 0.00012) * mote.z * speed;
    mote.x = (mote.x + 1) % 1;
    mote.y = (mote.y + 1) % 1;

    let x = mote.x * width + menu.input.x * 50 * mote.z;
    let y = mote.y * height + menu.input.y * 36 * mote.z;
    // Launch: the field streams outward as if flying forward.
    const zoom = 1 + warp * warp * 3.5 * mote.z;
    x = cx + (x - cx) * zoom;
    y = cy + (y - cy) * zoom;

    // Loading reveals motes in a random order.
    const appear = Math.min(
      Math.max((menu.progress * 1.15 - mote.order) * 8, 0),
      1,
    );
    let light = 0;
    if (hoverPoint && hoverLight > 0.01) {
      const distance = Math.hypot(x - hoverPoint[0], y - hoverPoint[1]);
      const sweep =
        0.5 + 0.5 * Math.sin(time * 3.2 - distance * 0.03 + mote.phase * 0.3);
      light = Math.max(0, 1 - distance / 220) * sweep * hoverLight;
    }
    const size = (2.2 + mote.z * 5.5) * (1 + warp * mote.z);
    const color = mote.z > 0.95 ? ink : air;
    batch.push(
      x,
      y,
      size,
      color,
      appear * (0.35 + mote.z * 0.6) * (1 - warp * 0.4),
      light,
      mote.glass,
    );
  }
  renderer.clear();
  renderer.drawPoints(batch);
});
