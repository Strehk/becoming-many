/**
 * Purpose: Define the raptor's body, the ring it holds, and the beat it flies at.
 * Context: One bird circling a place, seen from far below and far away.
 * Responsibility: Keep the asset, the ring, the pace, and the beat explicit.
 * Boundary: How the ring is flown lives beside this file; the palette in the level.
 */

export const RAPTOR_DEFINITION = {
  asset: {
    id: "falcon",
    url: "/birds/falcon.glb",
    /** The whole model; the armature carries the wings. */
    objectName: "Armature",
  },
  /** Clip name in the file, and the beat it is played back at. */
  beatClip: "Armature|ArmatureAction",
  /*
   * A soaring bird barely beats: it holds the wing and lets the air work, and
   * a beat comes when the ring loses height. Playing the authored half-second
   * beat at a fifth of its speed is what reads as holding rather than
   * flapping from this distance.
   */
  beatTimeScale: 0.2,
  /** The same beat as a rate and a lift, for the trace the wingtips print. */
  beatHertz: 0.4,
  beatAmplitudeMeters: 0.35,
  /** Wingspan in metres; the model is measured onto it. */
  wingSpanMeters: 2.1,
  /** The ring it holds over its place, and how high above the ground. */
  ringRadiusMeters: 62,
  heightAboveGroundMeters: 70,
  /*
   * Slow enough to read as soaring rather than as a bird in a hurry: one turn
   * of the ring takes about a minute.
   */
  ringSpeedMetersPerSecond: 6.5,
  /** How far the ring rises and falls again over one turn, in metres. */
  ringRiseMeters: 14,
  /** Bank into the turn, in radians; a soaring bird holds a visible tilt. */
  bankRadians: 0.28,
  /**
   * How far a visitor may leave the ring behind before another opens ahead.
   * Beyond this the bird is out of the world anyway, and holding the old
   * place would mean a sky that never carries one again.
   */
  abandonRingMeters: 320,
  /** Where a new ring opens, measured from the visitor who left the last. */
  reopenReachMeters: { minimum: 170, maximum: 260 },
} as const;
