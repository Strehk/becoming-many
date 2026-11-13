/**
 * Circling: the air gathers into a spinner of dust, a dense head and a
 * thinning tail circling for as long as loading takes. There is no percentage; a line under the figure
 * tells what reality is still being put together. When loading completes,
 * the figure writes the title. The pointer stays a pointer; a click scatters
 * the air around it.
 */

import { circling, runLoader } from "../shared/air-loaders.js";
import { startAirVariant } from "../shared/air-variant.js";

const variant = startAirVariant({
  slug: "07-circling",
  loadSeconds: 6,
  paceSeconds: 3.4,
  buildingSeconds: 1.7,
  cursor: "burst",
  plainMarker: true,
});
runLoader(variant, circling);
