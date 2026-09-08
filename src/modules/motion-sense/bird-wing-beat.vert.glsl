/*
 * Purpose: Beat the wings of every instanced bird body in the vertex stage.
 * Context: One pool of birds shares one geometry; a skeleton each is not affordable.
 * Responsibility: Swing wing vertices about the flight axis by this bird's beat.
 * Boundary: Where a bird is and how fast it beats is written by the flock simulation.
 */

uniform float birdWingBeatRadians;
uniform float birdWingRootShare;

// Signed place across the wings, −1 at the left tip and 1 at the right.
attribute float birdWingSpan;
// This bird's beat, between −1 and 1, written once per instance per frame.
attribute float birdBeat;

vec3 applyBirdWingBeat(vec3 restingPosition) {
  // The fuselage holds still and the swing grows out of the wing root, so a
  // wing bends where a wing bends instead of the whole bird tilting.
  float reach = smoothstep(birdWingRootShare, 1.0, abs(birdWingSpan));
  float angle = birdBeat * birdWingBeatRadians * reach * sign(birdWingSpan);

  float turnCos = cos(angle);
  float turnSin = sin(angle);

  // Turn about the flight axis: the wing keeps its span and gains its lift.
  return vec3(
    restingPosition.x * turnCos - restingPosition.y * turnSin,
    restingPosition.x * turnSin + restingPosition.y * turnCos,
    restingPosition.z
  );
}
