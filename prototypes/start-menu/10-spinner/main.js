/**
 * Spinner: loading shows a plain ring without particles and one line about
 * what reality is still putting together. When loading completes, the air
 * gathers into the title and inks into the type. A click flings a few
 * particles out of the pointer.
 */

import { startAirVariant } from "../shared/air-variant.js";

startAirVariant({
  slug: "10-spinner",
  loadSeconds: 6,
  paceSeconds: 2,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
  gather: { stagger: 1.1, travel: 1.9 },
});
