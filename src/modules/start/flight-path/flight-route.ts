import type { FlightRoute } from "./particle-contract";

// 1. Route settings
const SETTINGS = {
  leadMeters: 9,
  straightMeters: 5,
  turnRadiusMeters: 20,
  turnRadians: Math.PI / 3,
};

// 2. Centerline geometry
/** A straight approach joins a left circular arc with a continuous tangent. */
export function createFlightRoute(): FlightRoute {
  return {
    lengthMeters:
      SETTINGS.straightMeters +
      SETTINGS.turnRadiusMeters * SETTINGS.turnRadians,
    sample: (distance, target) => {
      const turnDistance = Math.max(0, distance - SETTINGS.straightMeters);
      const angle = turnDistance / SETTINGS.turnRadiusMeters;
      target.set(
        -SETTINGS.turnRadiusMeters * (1 - Math.cos(angle)),
        0,
        -SETTINGS.leadMeters -
          Math.min(distance, SETTINGS.straightMeters) -
          SETTINGS.turnRadiusMeters * Math.sin(angle),
      );
    },
  };
}
