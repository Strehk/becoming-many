/**
 * Ring: a small spinner made of air: the plain loading ring's breathing arc, drawn by about a hundred
 * air particles. One line
 * under it says what reality is still putting together. When loading
 * completes, its particles join the air that writes the title. A click
 * flings a few particles out of the pointer.
 */

import { ringSpinner, runLoader } from "../shared/air-loaders.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "11-ring",
  loadSeconds: 6,
  paceSeconds: 2.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
});
runLoader(variant, ringSpinner, { count: 130, phoneCount: 90 });
