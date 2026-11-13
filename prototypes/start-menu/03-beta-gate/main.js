/**
 * Beta Gate: the piece's own opening. While loading, the show waits in white
 * behind the real White Veil, with only the title and the beta's start-gate
 * pill. Enter or a click lifts the veil over the show's veilLiftSeconds and
 * the air appears; the menu settles under the title.
 */

import {
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
} from "../shared/air-world.js";
import { createMenuFlow } from "../shared/menu-flow.js";

const menu = createMenuFlow({ slug: "03-beta-gate" });
const world = createAirWorld(document.querySelector("[data-canvas]"), {
  veil: 1,
});
bindWorldSettings(world, menu);
bindLaunch(world, menu, { speed: 0, veil: 0 });

menu.on("screen", (screen) => {
  if (screen === "menu") world.setVeil(0);
});

world.onFrame((dt) => {
  menu.input.update(dt);
  world.setLook(-menu.input.x * 0.05, -menu.input.y * 0.035);
});
