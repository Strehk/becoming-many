/**
 * Ring: while the piece loads, particles are caught out of the air into a ring
 * that closes clockwise with the percentage. At 100 % the ring breaks and every
 * particle flies into the title; the set type takes over from them.
 */

import {
  bindFlight,
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
  MENU_GLIDE_METERS_PER_SECOND,
} from "../shared/air-world.js";
import { ringFormation } from "../shared/formations.js";
import { createMenuFlow } from "../shared/menu-flow.js";
import { bindTitle } from "../shared/title-choreography.js";
import { createTitleSwarm } from "../shared/title-swarm.js";

const phone = window.matchMedia("(pointer: coarse)").matches;
let title;
const menu = createMenuFlow({
  slug: "01-ring",
  loadSeconds: 10,
  beforeReady: () => title.gather(),
});
const world = createAirWorld(document.querySelector("[data-canvas]"));
bindWorldSettings(world, menu);
bindFlight(world, menu);
bindLaunch(world, menu, { speed: MENU_GLIDE_METERS_PER_SECOND, veil: 0 });

const swarm = createTitleSwarm(world, { capacity: phone ? 1800 : 3200 });
title = bindTitle({
  menu,
  swarm,
  title: document.querySelector("[data-title]"),
});

if (menu.skipped) menu.on("ready", () => title.setAtOnce());
else
  swarm.form(
    ringFormation(swarm, () => menu.progress),
    {
      order: "now",
      travel: 1.2,
    },
  );
