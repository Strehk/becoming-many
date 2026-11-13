/**
 * Percent: nothing on the loading screen but the percentage, and the number
 * is made of the White World's own particles. Each change flows the same
 * particles into the new digits. At 100 % the number flies into the title.
 * A click flings particles out of the pointer.
 */

import { runDigits } from "../shared/air-digits.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "10-percent",
  loadSeconds: 8,
  paceSeconds: 3.4,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
});
if (!variant.menu.skipped) runDigits(variant);
