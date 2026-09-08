/** Shared glider rates and terrain-relative minimum rig clearance. */
export const FLIGHT_SETTINGS = {
  glideSpeedMetersPerSecond: 5, // Constant forward speed; lower values make flight gentler.
  climbRateMetersPerSecond: 10, // Vertical speed at full pitch deflection, before descent bias.
  yawRateRadiansPerSecond: 0.8, // Heading change at full roll deflection.
  neutralDescentMetersPerSecond: 1, // Downward drift with neutral pitch; positive values bias descent.
  minimumGroundClearanceMeters: 1, // Lowest allowed rig height above local terrain where ground is active.
} as const;
