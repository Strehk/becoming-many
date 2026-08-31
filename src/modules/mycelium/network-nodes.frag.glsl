/*
 * Purpose: Paint one node glow as a small bright core inside a soft halo.
 * Context: Hubs must read as points of origin, never as flat plates.
 * Responsibility: Shape the falloff and blend the glow over the carried world.
 * Boundary: Point placement, size cap, and the radius mask stay in the vertex shader.
 */

uniform float connectionsIntensity;

varying float connectionsNodeMask;
varying float connectionsNodeWeight;
varying vec3 connectionsNodeColor;

void main() {
  if (connectionsNodeMask <= 0.0) discard;
  vec2 fromCenter = gl_PointCoord - vec2(0.5);
  float radial = length(fromCenter) * 2.0;

  float core = 1.0 - smoothstep(0.0, 0.4, radial);
  float halo = (1.0 - smoothstep(0.15, 1.0, radial)) * 0.35;
  float glow = (core + halo) * (0.6 + 0.4 * connectionsNodeWeight);
  float alpha = min(glow, 1.0) * connectionsNodeMask * connectionsIntensity;
  if (alpha <= 0.04) discard;

  gl_FragColor = vec4(connectionsNodeColor * (0.7 + 0.9 * core), alpha);
}
