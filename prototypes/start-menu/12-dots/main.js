/**
 * Dots: a small spinner made of air: a ring of ten small clusters of air particles; the lit
 * one swells and leans toward the eye as it runs round. One line
 * under it says what reality is still putting together. When loading
 * completes, its particles join the air that writes the title. A click
 * flings a few particles out of the pointer.
 */

import { dotsSpinner, runLoader } from "../shared/air-loaders.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "12-dots",
  loadSeconds: 6,
  paceSeconds: 2.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
});
runLoader(variant, dotsSpinner, { count: 170, phoneCount: 110 });
