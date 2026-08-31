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

varying float connectionsNodeMask;
varying float connectionsNodeWeight;
varying vec3 connectionsNodeColor;

const float MAX_NODE_PIXELS = 42.0;

void main() {
  vec4 viewPosition = viewMatrix * vec4(position, 1.0);
  float viewDistance = length(viewPosition.xyz);
  connectionsNodeMask = 1.0 -
    smoothstep(
      connectionsWebRadius - connectionsWebFadeBand,
      connectionsWebRadius,
      viewDistance
    );
  connectionsNodeWeight = nodeWeight;
  connectionsNodeColor = nodeColor;

  // The pixel cap keeps close fly-bys from inflating a glow into a plate.
  float sizeMeters = connectionsNodeBaseSize * (0.5 + nodeWeight);
  gl_PointSize = min(
    connectionsNodeMask * sizeMeters * connectionsNodePixelScale /
      max(viewDistance, 0.0001),
    MAX_NODE_PIXELS
  );
  gl_Position = projectionMatrix * viewPosition;
}
