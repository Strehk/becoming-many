/**
 * Denser: loading builds the title itself. Its places fill at random, so the word
 * grows denser and denser out of a few dots. One line under it
 * says what reality is still putting together. When loading completes, the
 * title inks into the set type. A click flings particles out of the pointer.
 */

import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "11-denser",
  loadSeconds: 8,
  paceSeconds: 3.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
});
const { borrow, menu, title } = variant;
if (!menu.skipped) {
  title.beginGrowing("random");
  borrow.onUpdate(() => title.growTo(menu.progress));
}
