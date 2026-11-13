/**
 * Depth: every menu entry is placed at a real distance in the White World
 * air and projected through the show's camera, so particles drift in front of
 * and behind the words. Moving the pointer or tilting the phone shifts the
 * head and the depths separate. Choosing an entry glides into it.
 */

import { Vector3 } from "three";
import {
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
} from "../shared/air-world.js";
import { createMenuFlow } from "../shared/menu-flow.js";

/** Metres from where the menu was entered: x right, y up, z ahead (negative). */
const LANDSCAPE_ANCHORS = {
  title: [0, 1.3, -7.5],
  start: [-1.7, -0.1, -4.6],
  settings: [0.3, -0.8, -6.6],
  credits: [2.2, 0.2, -9.2],
  loading: [0, 0, -6],
};
/** A phone held upright sees a narrow slice; the entries stack instead. */
const PORTRAIT_ANCHORS = {
  title: [0, 2.2, -8],
  start: [-0.35, 0.3, -4.6],
  settings: [0.3, -0.7, -6.4],
  credits: [-0.25, -1.9, -8.6],
  loading: [0, 0, -6],
};
const REFERENCE_DEPTH = 6; // A label at this distance is drawn at its CSS size.
const GLIDE_IN_SPEED = 9;

const menu = createMenuFlow({
  slug: "06-depth",
  beforeAction(action) {
    if (
      menu.screen !== "menu" ||
      !["start", "settings", "credits"].includes(action)
    ) {
      return Promise.resolve();
    }
    world.setSpeed(GLIDE_IN_SPEED);
    world.setVeil(0.75, 0.7);
    return new Promise((resolve) => window.setTimeout(resolve, 750));
  },
});
const world = createAirWorld(document.querySelector("[data-canvas]"));
bindWorldSettings(world, menu);
bindLaunch(world, menu);

const origin = new Vector3();
const point = new Vector3();
const view = new Vector3();
let arrival = 1;

menu.on("screen", (screen) => {
  if (screen === "launch") return;
  world.setSpeed(0);
  world.setVeil(0, 1.2);
  if (screen === "menu") {
    origin.copy(world.camera.position);
    arrival = 0;
  }
});

const nodes = [...document.querySelectorAll("[data-anchor]")];
world.onFrame((dt) => {
  menu.input.update(dt);
  world.setOffset(menu.input.x * 0.9, -menu.input.y * 0.55);
  arrival = Math.min(arrival + dt / 1.4, 1);
  const settle = 1 - (1 - arrival) ** 3;
  const { camera } = world;
  const width = window.innerWidth;
  const height = window.innerHeight;

  for (const node of nodes) {
    const key = node.dataset.anchor;
    const anchors = width < height ? PORTRAIT_ANCHORS : LANDSCAPE_ANCHORS;
    const [x, y, z] = anchors[key];
    let depth = z;
    if (key === "loading") depth = -14 + menu.progress * 8;
    else depth = z * (1 + (1 - settle) * 3) + (menu.hovered === key ? 0.8 : 0);
    point.set(origin.x + x, origin.y + y, origin.z + depth);
    view.copy(point).applyMatrix4(camera.matrixWorldInverse);
    const distance = -view.z;
    if (distance <= 0.2) {
      node.style.opacity = "0";
      continue;
    }
    point.project(camera);
    const sx = ((point.x + 1) / 2) * width;
    const sy = ((1 - point.y) / 2) * height;
    const scale = Math.min(Math.max(REFERENCE_DEPTH / distance, 0.25), 2.4);
    node.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${scale})`;
    // Far words thin like the air does with distance.
    node.style.opacity = String(
      Math.min(Math.max(1.35 - distance / 14, 0.2), 1),
    );
  }
});
