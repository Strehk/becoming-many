/*
 * Purpose: Size one web node glow by its class weight and the web radius mask.
 * Context: Node glows mark the deterministic source anchors of the web.
 * Responsibility: Attenuate point size with distance and collapse masked nodes.
 * Boundary: The circular glow falloff stays in the fragment shader.
 */

attribute vec3 nodeColor;
attribute float nodeWeight;

uniform float connectionsWebRadius;
uniform float connectionsWebFadeBand;
uniform float connectionsNodeBaseSize;
uniform float connectionsNodePixelScale;
uniform float connectionsGrowthNearDistance;
uniform float connectionsGrowthFarFraction;

varying float connectionsNodeMask;
varying float connectionsNodeWeight;
varying vec3 connectionsNodeColor;

const float MAX_NODE_PIXELS = 42.0;

/** Density band a node fades in across, matching the cords it anchors. */
const float APPEAR_BAND = 0.18;

/** Stable 0..1 draw for one node, so the same node always appears at the same reach. */
float nodeAppearance(vec3 worldPosition) {
  return fract(
    sin(dot(floor(worldPosition * 4.0), vec3(12.9898, 78.233, 37.719))) *
      43758.5453
  );
}

void main() {
  vec4 viewPosition = viewMatrix * vec4(position, 1.0);
  float viewDistance = length(viewPosition.xyz);
  // Rows no chunk has filled carry a negative weight and collapse here, which
  // is how a fixed pool cut into per-chunk ranges stays cheap while partly
  // empty.
  connectionsNodeMask = step(0.0, nodeWeight);
  connectionsNodeMask *= 1.0 -
    smoothstep(
      connectionsWebRadius - connectionsWebFadeBand,
      connectionsWebRadius,
      viewDistance
    );
  connectionsNodeWeight = nodeWeight;
  connectionsNodeColor = nodeColor;

  // Nodes appear with the cords they anchor: the same proximity density, the
  // same stable per-element threshold, so approaching thickens one mat rather
  // than growing a web through a fixed field of dots.
  float density = mix(
    connectionsGrowthFarFraction,
    1.0,
    1.0 - smoothstep(connectionsGrowthNearDistance, connectionsWebRadius, viewDistance)
  );
  float growth = smoothstep(
    nodeAppearance(position) - APPEAR_BAND,
    nodeAppearance(position),
    density
  );
  connectionsNodeMask *= growth;

  // The pixel cap keeps close fly-bys from inflating a glow into a plate.
  float sizeMeters = connectionsNodeBaseSize * (0.5 + nodeWeight);
  gl_PointSize = min(
    connectionsNodeMask * sizeMeters * connectionsNodePixelScale /
      max(viewDistance, 0.0001),
    MAX_NODE_PIXELS
  );
  gl_Position = projectionMatrix * viewPosition;
}
