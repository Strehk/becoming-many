/**
 * Veil: the show's opening, used as the loading screen. The real White Veil
 * covers everything and thins with the load, so the air of White World
 * appears grain by grain as the piece becomes ready. The camera barely moves;
 * the menu stays small at the foot so the air keeps the screen.
 */

import {
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
} from "../shared/air-world.js";
import { createMenuFlow } from "../shared/menu-flow.js";

const DRIFT_SPEED = 0.4;

const menu = createMenuFlow({ slug: "05-veil", loadSeconds: 7.5 });
const world = createAirWorld(document.querySelector("[data-canvas]"), {
  veil: 1,
});
bindWorldSettings(world, menu);
bindLaunch(world, menu, { speed: DRIFT_SPEED, veil: 0 });

menu.on("progress", (progress) => {
  if (menu.screen === "loading") world.setVeil(1 - progress * 0.92, 0.6);
});
menu.on("ready", () => world.setVeil(0, 1.5));
menu.on("screen", (screen) => {
  if (screen === "menu") world.setSpeed(DRIFT_SPEED);
});

world.onFrame((dt) => {
  menu.input.update(dt);
  world.setLook(-menu.input.x * 0.06, -menu.input.y * 0.04);
});
