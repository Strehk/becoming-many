/**
 * Purpose: Start one of the air variants (04-06) with everything they share.
 * Context: In these variants every figure, the title and the pointer are made
 *   of the White World's own particles, borrowed and given back.
 * Responsibility: Wire the menu flow, the world, the borrowing, the title and
 *   the pointer; hand the loading figure to the title when loading completes.
 * Boundary: The loading figure itself belongs to each variant's main.js.
 */

import { createAirBorrow } from "./air-borrow.js";
import { createAirBurst } from "./air-burst.js";
import { createAirCursor } from "./air-cursor.js";
import { createAirTitle } from "./air-title.js";
import {
  bindFlight,
  bindLaunch,
  bindWorldSettings,
  createAirWorld,
  MENU_GLIDE_METERS_PER_SECOND,
} from "./air-world.js";
import { createMenuFlow } from "./menu-flow.js";
import { showVersion } from "./version.js";

export function startAirVariant({
  slug,
  loadSeconds,
  cursor,
  paceSeconds = 2.6,
  stageHoldSeconds = 2.2,
  buildingSeconds,
  plainMarker = false,
  gather = { stagger: 1.0, travel: 1.9 },
}) {
  if (plainMarker) document.documentElement.classList.add("plain-marker");
  showVersion();
  const phone = window.matchMedia("(pointer: coarse)").matches;
  const variant = { phone, loading: null };
  const menu = createMenuFlow({
    slug,
    loadSeconds,
    paceSeconds,
    stageHoldSeconds,
    buildingSeconds,
    beforeReady: () =>
      variant.title.gather({ from: variant.loading, ...gather }),
  });
  const world = createAirWorld(document.querySelector("[data-canvas]"));
  bindWorldSettings(world, menu);
  bindFlight(world, menu);
  bindLaunch(world, menu, { speed: MENU_GLIDE_METERS_PER_SECOND, veil: 0 });
  // Created before the first frame renders, so it can read the drift clock.
  const borrow = createAirBorrow(world, { capacity: phone ? 2600 : 4800 });
  const title = createAirTitle({
    menu,
    borrow,
    title: document.querySelector("[data-title]"),
    maxCount: phone ? 950 : 1700,
  });
  // "burst": a normal pointer, and a click scatters the air around it.
  if (cursor === "burst") createAirBurst({ borrow, menu });
  else createAirCursor({ borrow, menu, mode: cursor });
  if (menu.skipped) menu.on("ready", () => title.setAtOnce());
  Object.assign(variant, { menu, world, borrow, title });
  // For measuring in the console and in automated checks.
  window.__air = variant;
  return variant;
}
