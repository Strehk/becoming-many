/**
 * Closing Panel: the menu stands where the piece ends, set like the closing
 * credits over the returning White World air. Loading reads as a credit list
 * of stages that turn black as they complete.
 */

import {
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
} from "../shared/air-world.js";
import { createMenuFlow } from "../shared/menu-flow.js";

const menu = createMenuFlow({ slug: "04-closing-panel", loadSeconds: 7 });
const world = createAirWorld(document.querySelector("[data-canvas]"));
bindWorldSettings(world, menu);
bindLaunch(world, menu);

const stageList = document.querySelector("[data-stage-list]");
function renderStages() {
  const stages = menu.t("stages");
  if (stageList.children.length !== stages.length) {
    stageList.replaceChildren(
      ...stages.map(() => document.createElement("li")),
    );
  }
  const current = Math.min(
    Math.floor(menu.progress * stages.length),
    stages.length - 1,
  );
  stages.forEach((text, index) => {
    const item = stageList.children[index];
    item.textContent = text;
    item.dataset.state =
      menu.ready || index < current
        ? "done"
        : index === current
          ? "current"
          : "pending";
  });
}
menu
  .on("progress", renderStages)
  .on("ready", renderStages)
  .on("settings", renderStages);
renderStages();

world.onFrame((dt) => {
  menu.input.update(dt);
  world.setLook(-menu.input.x * 0.04, -menu.input.y * 0.03);
});
