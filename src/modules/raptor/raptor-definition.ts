/**
 * Purpose: Define the single raptor circling high over the landscape.
 * Context: One bird, seen from far below; everything about it is authored here.
 * Responsibility: Keep the asset, the ring it flies, its pace, and its beat explicit.
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
  /** Wingspan in metres; the model is measured onto it. */
  wingSpanMeters: 2.1,
  /** The ring it holds around the traveller, and how high above the ground. */
  ringRadiusMeters: 95,
  heightAboveGroundMeters: 70,
  /*
   * Slow enough to read as soaring rather than as a bird in a hurry: one turn
   * of the ring takes about a minute and a half.
   */
  ringSpeedMetersPerSecond: 6.5,
  /** How far the ring's centre drifts after the traveller each second. */
  centreFollowRate: 0.35,
  /** How far the ring rises and falls again over one turn, in metres. */
  ringRiseMeters: 14,
  /** Bank into the turn, in radians; a soaring bird holds a visible tilt. */
  bankRadians: 0.28,
} as const;
