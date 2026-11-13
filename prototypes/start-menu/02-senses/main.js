/**
 * Senses: every stage of loading names one of the piece's senses, in the order
 * the show introduces them, and the particles show it: the air thickening, a
 * scent plume, echo rings, motion streams, convection rolls, magnetic field
 * lines, a web of threads. At 100 % the last figure flies into the title.
 */

import {
  bindFlight,
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
  MENU_GLIDE_METERS_PER_SECOND,
} from "../shared/air-world.js";
import { SENSE_FORMATIONS } from "../shared/formations.js";
import { createMenuFlow } from "../shared/menu-flow.js";
import { bindTitle } from "../shared/title-choreography.js";
import { createTitleSwarm } from "../shared/title-swarm.js";

const phone = window.matchMedia("(pointer: coarse)").matches;
const figureCount = phone ? 900 : 1500;
let title;
const menu = createMenuFlow({
  slug: "02-senses",
  loadSeconds: 16,
  minStageSeconds: 2.8,
  beforeReady: () => title.gather({ stagger: 0.9 }),
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

const showSense = (stage) => {
  const figure = SENSE_FORMATIONS[stage];
  if (!figure || menu.progress >= 1) return;
  swarm.form(figure(swarm, figureCount), { stagger: 0.5, travel: 1.3 });
};

if (menu.skipped) menu.on("ready", () => title.setAtOnce());
else {
  menu.on("stage", showSense);
  showSense(0);
}
