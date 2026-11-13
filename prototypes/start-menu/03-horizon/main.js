/**
 * Horizon: loading draws a horizon of particles from the left edge toward the
 * right, the percentage riding on its tip and the sense being prepared above
 * it. At 100 % the horizon lifts and becomes the title, set flush left.
 */

import {
  bindFlight,
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
  MENU_GLIDE_METERS_PER_SECOND,
} from "../shared/air-world.js";
import { horizonFormation } from "../shared/formations.js";
import { createMenuFlow } from "../shared/menu-flow.js";
import { bindTitle } from "../shared/title-choreography.js";
import { createTitleSwarm } from "../shared/title-swarm.js";

const phone = window.matchMedia("(pointer: coarse)").matches;
let title;
const menu = createMenuFlow({
  slug: "03-horizon",
  loadSeconds: 11,
  beforeReady: () => title.gather({ stagger: 1.3 }),
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

// The horizon spans the same margins the type uses; it lies at --horizon.
const root = document.documentElement;
const cssPixels = (name) => {
  const probe = getComputedStyle(root).getPropertyValue(name).trim();
  const node = document.createElement("div");
  node.style.position = "absolute";
  node.style.width = probe;
  document.body.append(node);
  const value = node.getBoundingClientRect().width;
  node.remove();
  return value;
};

if (menu.skipped) menu.on("ready", () => title.setAtOnce());
else
  swarm.form(
    horizonFormation(swarm, () => menu.progress, {
      count: phone ? 520 : 900,
      left: () => cssPixels("--edge"),
      right: (view) => view.width - cssPixels("--edge"),
      y: () => cssPixels("--horizon"),
    }),
    { order: "now", travel: 1.2 },
  );
