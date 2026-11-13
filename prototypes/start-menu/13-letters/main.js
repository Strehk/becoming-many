/**
 * Letters: loading builds the title itself. Its places fill letter by letter, from B to Y. One line under it
 * says what reality is still putting together. When loading completes, the
 * title inks into the set type. A click flings particles out of the pointer.
 */

import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "13-letters",
  loadSeconds: 8,
  paceSeconds: 3.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
  titleScreens: ["loading", "menu", "credits"],
});
const { borrow, menu, title } = variant;
if (!menu.skipped) {
  title.beginGrowing("letters");
  borrow.onUpdate(() => title.growTo(menu.progress));
}
