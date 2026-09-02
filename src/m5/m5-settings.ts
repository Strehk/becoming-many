/**
 * Purpose: Hold every tunable of the M5 polling adapter and its rig profile.
 * Context: The firmware runs normalize → axis-map → calibrate on the device;
 *   the client stages configured here run per station, tuned to the physical
 *   rig — changing one changes the flight behavior.
 * Responsibility: Own the transport, safety, auto-neutralize, and smoothing
 *   numbers in one typed place.
 * Boundary: Flight-model constants (speed, yaw and climb rates) belong to the
 *   flight layer in src/control/m5-flight.ts.
 */

export const M5_SETTINGS = {
  // The firmware samples every 50ms; polling faster only re-reads the same
  // snapshot, slower adds steering latency.
  pollIntervalMilliseconds: 50,
  // No accepted poll for this long means the device is gone: steer nothing.
  staleAfterMilliseconds: 1_000,
  // The deviceId every payload must carry. Empty accepts any device; a set
  // value turns a neighbour rig's frames into an operator-visible warning,
  // never silent steering.
  expectedDeviceId: "",

  // Resuming from quality 0 at or beyond this deflection is an unsafe pose,
  // not intent — a person lies on the machine.
  resumePoseLimit: 0.85,
  // A single-poll change this large is a glitch, not a human movement.
  abruptStepLimit: 0.9,

  // Rig rest pose in -1..1 units. The device calibrates its own zero at the
  // rig, so the parked rig reads true zero; the neutralizer only pins drift.
  restPitch: 0,
  restRoll: 0,
  // How far the pose may wander and still count as resting.
  restTolerance: 0.08,
  // The rest pose must hold this long before pitch/roll are pinned to zero.
  stableDurationMilliseconds: 5_000,
  // A poll gap larger than this means frames were lost; the stability window
  // restarts rather than trusting a stitched-together stillness.
  maxFrameGapMilliseconds: 1_000,

  // Per-poll easing toward the newest pose; 1 would be no smoothing at all.
  smoothingFactor: 0.25,
} as const;
