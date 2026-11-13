/**
 * Beta: the earlier beta menu, as close as possible. The air of White World
 * drifts behind a soft white glow, exactly as the show renders it; the view
 * leans a little with the pointer or the phone.
 */

import {
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
} from "../shared/air-world.js";
import { createMenuFlow } from "../shared/menu-flow.js";

const menu = createMenuFlow({ slug: "01-beta" });
const world = createAirWorld(document.querySelector("[data-canvas]"));
bindWorldSettings(world, menu);
bindLaunch(world, menu);

world.onFrame((dt) => {
  menu.input.update(dt);
  world.setLook(-menu.input.x * 0.05, -menu.input.y * 0.035);
});
