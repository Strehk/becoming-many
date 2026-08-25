/*
 * Purpose: Clip a Scent Particle point primitive to a circular puff shape.
 * Context: Scent signatures read as soft round clouds instead of square points.
 * Responsibility: Discard only point fragments outside the circle.
 * Boundary: Color, animation, fading, and material lifecycle stay elsewhere.
 */

void discardOutsideScentParticleCircle() {
  vec2 centerOffset = gl_PointCoord - vec2(0.5);
  if (dot(centerOffset, centerOffset) > 0.25) discard;
}
