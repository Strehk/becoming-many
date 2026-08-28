/*
 * Purpose: Clip a fly point primitive to a circular speck shape.
 * Context: Flies read as small round insects instead of square points.
 * Responsibility: Discard only point fragments outside the circle.
 * Boundary: Color, swarm simulation, and material lifecycle stay elsewhere.
 */

void discardOutsideFlySwarmCircle() {
  vec2 centerOffset = gl_PointCoord - vec2(0.5);
  if (dot(centerOffset, centerOffset) > 0.25) discard;
}
