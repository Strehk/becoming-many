/**
 * Flock: the air gathers into a murmuration that stretches, folds and
 * turns over itself for as long as loading takes. There is no percentage; a line under the figure
 * tells what reality is still being put together. When loading completes,
 * the figure writes the title. The pointer stays a pointer; a click scatters
 * the air around it.
 */

import { flock, runLoader } from "../shared/air-loaders.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "08-flock",
  loadSeconds: 6,
  paceSeconds: 3.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
});
runLoader(variant, flock);
