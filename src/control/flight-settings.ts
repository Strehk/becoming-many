/**
 * Purpose: Author the shared ICAROS flight and comfort tuning.
 * Context: Flight behavior must stay consistent across every level and input frame.
 * Responsibility: Hold the editable base rates, bias, clearance, and view assistance.
 * Boundary: Per-level maximum altitude remains level data; this file creates no state.
 */

export const FLIGHT_SETTINGS = {
  glideSpeedMetersPerSecond: 5, // Constant forward speed; lower values make flight gentler.
  climbRateMetersPerSecond: 10, // Vertical speed at full pitch deflection, before descent bias.
  yawRateRadiansPerSecond: 0.8, // Heading change at full roll deflection.
  neutralDescentMetersPerSecond: 1, // Downward drift with neutral pitch; positive values bias descent.
  viewPitchAssistDegrees: 30, // Positive values raise the rendered view above the physical head angle.
  minimumGroundClearanceMeters: 1, // Lowest allowed rig height above local terrain where ground is active.
} as const;
