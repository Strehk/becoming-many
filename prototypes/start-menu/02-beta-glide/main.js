/**
 * Beta Glide: the menu is read while already moving. The camera glides
 * through the real White World air, gathering speed as the piece loads; the
 * pointer or the phone's tilt turns the view a little.
 */

import {
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
} from "../shared/air-world.js";
import { createMenuFlow } from "../shared/menu-flow.js";

const MENU_SPEED = 1.4;
const READING_SPEED = 0.5;

const menu = createMenuFlow({ slug: "02-beta-glide" });
const world = createAirWorld(document.querySelector("[data-canvas]"));
bindWorldSettings(world, menu);
bindLaunch(world, menu, { speed: MENU_SPEED, veil: 0 });

menu.on("progress", (progress) => {
  if (menu.screen === "loading") world.setSpeed(progress * MENU_SPEED);
});
menu.on("screen", (screen) => {
  if (screen === "menu") world.setSpeed(MENU_SPEED);
  if (["settings", "credits", "modes"].includes(screen))
    world.setSpeed(READING_SPEED);
});

world.onFrame((dt) => {
  menu.input.update(dt);
  world.setLook(-menu.input.x * 0.12, -menu.input.y * 0.08);
});
