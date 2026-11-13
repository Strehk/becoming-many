/**
 * Senses in the air: the air in front of the visitor gathers, then takes the
 * shape of each sense as loading names it: scent plume, echo rings, motion
 * streams, convection, field lines, a web. A quick load names fewer senses.
 * At 100 % the figure writes the title. The pointer is a ring of particles,
 * and the dust parts around it; a click sends a sonar pulse through it.
 */

import { createFigure } from "../shared/air-figure.js";
import { startAirVariant } from "../shared/air-variant.js";
import { SENSE_FORMATIONS } from "../shared/formations.js";

const variant = startAirVariant({
  slug: "05-senses-air",
  loadSeconds: 15,
  cursor: "wake",
  stageHoldSeconds: 2.4,
});
const { borrow, menu, title } = variant;
const figure = createFigure(borrow, { owner: "loading" });
variant.loading = figure;

// The sense figures speak in CSS pixels from the centre, like the old swarm.
const adapter = {
  get view() {
    return borrow.view;
  },
  get pixelSize() {
    return title.pixels;
  },
};
let loaded = menu.skipped;
const show = (stage) => {
  const make = SENSE_FORMATIONS[stage];
  if (!make || loaded) return;
  const shape = make(adapter, title.count);
  shape.depth = title.shape.depth;
  figure.reshape(shape, { stagger: 0.45, travel: 1.3, bend: 0.18 });
};
show(0);
menu.on("stage", show);
menu.on("loaded", () => {
  loaded = true;
});

// The air gathers first: the figure fills within its opening seconds.
let started = -1;
borrow.onUpdate((now) => {
  if (loaded) return;
  if (started < 0) started = now;
  const share = Math.min(1, (now - started) / 1.8);
  figure.fill(Math.round(title.count * share), {
    keepVisible: 0.3,
    travel: 1.6,
    centre: { x: 0, y: 0, z: -title.shape.depth },
  });
});
