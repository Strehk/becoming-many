/**
 * Purpose: Author the connections web the Connections level shares with the show.
 * Context: The last rung of the ladder; the show's union ends here.
 * Responsibility: Own the one copy of these values.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { ConnectionsParameters } from "../../modules/mycelium/mycelium";

export const CONNECTIONS: ConnectionsParameters = {
  intensity: 1,
  webRadiusMeters: 30,
  pulseSpeedMetersPerSecond: 1.5,
  sources: {
    vegetation: {
      nodeColor: 0xa5bdc3,
      weight: 1,
    },
    scentEmitters: {
      nodeColor: 0xd06780,
      weight: 1,
    },
    rocks: {
      nodeColor: 0x292e55,
      weight: 0.25,
    },
    soil: {
      nodeColor: 0xf2e3d3,
      weight: 0.2,
    },
  },
  colors: {
    depthColor: 0x683b5a,
    pulseColor: 0xe39e54,
  },
};
