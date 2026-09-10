/** Shared flight response, path limits and terrain clearance. */
export const FLIGHT_SETTINGS = {
  desktopTiltReturnPerSecond: 4, // Released keys return from full tilt in 0.25 seconds.
  glideSpeedMetersPerSecond: 5, // Speed along the flight path, independent of tilt.
  maximumPitchRadians: Math.PI / 4, // Full tilt follows the firmware's 45-degree physical range.
  yawRateRadiansPerSecond: 0.8, // Heading change at full roll deflection.
  minimumGroundClearanceMeters: 1, // Lowest allowed rig height above local terrain where ground is active.
} as const;
