/**
 * Orbit: a small spinner made of air: three small rings of air particles turning in tilted
 * planes, each with a head and a thinning tail. One line
 * under it says what reality is still putting together. When loading
 * completes, its particles join the air that writes the title. A click
 * flings a few particles out of the pointer.
 */

import { orbitSpinner, runLoader } from "../shared/air-loaders.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "13-orbit",
  loadSeconds: 6,
  paceSeconds: 2.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
});
runLoader(variant, orbitSpinner, { count: 210, phoneCount: 140 });
