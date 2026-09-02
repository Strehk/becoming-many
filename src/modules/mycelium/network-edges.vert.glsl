/*
 * Purpose: Expand one instanced cord into a wobbling camera-facing ribbon envelope.
 * Context: The web renders every edge of the Connections topology in one draw call.
 * Responsibility: Bend the segmented centerline, collapse cords beyond the reveal, pass varyings.
 * Boundary: The fine filaments, knots, pulses, and the reveal mask stay in the fragment shader.
 *
 * The subdivided base strip encodes position.x as the along-cord progress and
 * position.y as the ribbon side. The ribbon is a widened invisible envelope;
 * the fragment shader draws the visible filaments inside it. Degenerate
 * instances (start equals end) collapse.
 */

attribute vec3 edgeStart;
attribute vec3 edgeEnd;
attribute vec3 edgeColor;
attribute float edgeWeight;
attribute float edgePhase;
attribute float edgeUpload;

uniform float connectionsWebRadius;
uniform float connectionsEdgeBaseWidth;
uniform float connectionsEdgeWidthSpan;
uniform float connectionsWobbleAmplitude;
uniform float connectionsGrowthNearDistance;
uniform float connectionsGrowthFarFraction;
uniform float connectionsClock;
uniform float connectionsEdgeFade;

varying float connectionsEdgeT;
varying float connectionsEdgeSide;
varying float connectionsEdgeLength;
varying float connectionsEdgePhase;
varying float connectionsEdgeWeight;
varying float connectionsEdgeViewDistance;
varying float connectionsEdgeGrowth;
varying vec3 connectionsEdgeColor;

const float TAU = 6.28318530718;

/** Density band a cord fades in across, so approaching grows rather than pops. */
const float APPEAR_BAND = 0.18;

void main() {
  float progress = position.x;
  vec3 along = mix(edgeStart, edgeEnd, progress);
  vec3 cordDelta = edgeEnd - edgeStart;
  float cordLength = length(cordDelta);
  vec3 cordDirection = cordLength > 0.0001
    ? cordDelta / cordLength
    : vec3(0.0, 1.0, 0.0);
  vec3 viewDirection = normalize(cameraPosition - along);
  vec3 ribbonSide = normalize(cross(viewDirection, cordDirection));
  float viewDistance = distance(cameraPosition, along);

  // Two deterministic sine octaves bend the centerline; the sine envelope
  // pins both ends to their anchors so cords still meet their nodes exactly.
  float endPin = sin(3.14159265 * progress);
  float wobble = endPin *
    min(cordLength * 0.08, connectionsWobbleAmplitude) *
    (0.6 * sin(TAU * (progress * 1.7 + edgePhase)) +
      0.4 * sin(TAU * (progress * 3.9 + edgePhase * 2.63)));

  // Proximity growth, the grass field's density rejection read backwards: the
  // topology is seeded once at full density, and what changes as the visitor
  // closes in is how large a share of it is present. Every cord carries a
  // stable threshold and comes out once the local density reaches it, so the
  // mat genuinely thickens with more roots rather than with fatter ones.
  float density = mix(
    connectionsGrowthFarFraction,
    1.0,
    1.0 - smoothstep(connectionsGrowthNearDistance, connectionsWebRadius, viewDistance)
  );
  // Decorrelated from the phase driving the wobble, so a cord's appearance and
  // its meander are not visibly the same draw.
  float appearance = fract(edgePhase * 13.71 + 0.37);
  float growth = smoothstep(appearance - APPEAR_BAND, appearance, density);

  // Ground entering the window grows in rather than appearing. Resident chunks
  // are never rewritten, so nothing already on screen ever runs this ramp.
  float sinceUpload = max(0.0, connectionsClock - edgeUpload);
  growth *= smoothstep(0.0, connectionsEdgeFade, sinceUpload);

  // Collapse the ribbon beyond the web radius, for cords the density has not
  // reached yet, and for degenerate pool rows, so everything unseen costs no
  // fragments.
  float alive = step(0.0001, cordLength) *
    (1.0 - step(connectionsWebRadius, viewDistance)) *
    step(0.0001, growth);
  float halfWidth = alive *
    (connectionsEdgeBaseWidth + edgeWeight * connectionsEdgeWidthSpan) * 0.5;

  connectionsEdgeT = progress;
  connectionsEdgeSide = position.y;
  connectionsEdgeLength = max(cordLength, 0.0001);
  connectionsEdgePhase = edgePhase;
  connectionsEdgeWeight = edgeWeight;
  connectionsEdgeViewDistance = viewDistance;
  connectionsEdgeGrowth = growth;
  connectionsEdgeColor = edgeColor;

  vec3 worldPosition = along +
    ribbonSide * (position.y * halfWidth + wobble * alive);
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
}
