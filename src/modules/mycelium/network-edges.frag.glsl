/*
 * Purpose: Draw several fine meandering filaments and knots inside one cord envelope.
 * Context: One real edge reads as a strand bundle with intermediate junctions,
 * so the web looks far denser than its actual node and edge counts.
 * Responsibility: Place the filaments, knots, and pulses; blend them over the carried world.
 * Boundary: Envelope placement, wobble, and collapse stay in the vertex shader.
 */

uniform float connectionsIntensity;
uniform float connectionsTime;
uniform float connectionsWebRadius;
uniform float connectionsWebFadeBand;
uniform float connectionsPulseSpeed;
uniform float connectionsPulseLength;
uniform float connectionsFilamentWidth;
uniform float connectionsKnotSpacing;
uniform vec3 connectionsDepthColor;
uniform vec3 connectionsPulseColor;

varying float connectionsEdgeT;
varying float connectionsEdgeSide;
varying float connectionsEdgeLength;
varying float connectionsEdgePhase;
varying float connectionsEdgeWeight;
varying float connectionsEdgeViewDistance;
varying float connectionsEdgeGrowth;
varying vec3 connectionsEdgeColor;

const float TAU = 6.28318530718;
const int FILAMENTS_PER_CORD = 3;

void main() {
  float webMask = 1.0 -
    smoothstep(
      connectionsWebRadius - connectionsWebFadeBand,
      connectionsWebRadius,
      connectionsEdgeViewDistance
    );
  if (webMask <= 0.0) discard;

  // Each filament meanders across the envelope at its own spatial frequency
  // and converges onto the centerline at both anchors, so the bundle splits
  // mid-cord and rejoins at its nodes. When a strand falls below pixel
  // resolution it dims by its coverage ratio instead of widening, so far
  // and grazing cords dissolve rather than fattening.
  float pinch = sin(3.14159265 * connectionsEdgeT);
  float resolvedHalfWidth =
    max(connectionsFilamentWidth, fwidth(connectionsEdgeSide) * 0.75);
  float coverage = connectionsFilamentWidth / resolvedHalfWidth;
  // Every present cord carries its full bundle: proximity decides how many
  // cords are out, not how detailed each one is, so a cord that is there is
  // there at full strength.
  float strand = 0.0;
  for (int filament = 0; filament < FILAMENTS_PER_CORD; filament += 1) {
    float offset = float(filament);
    float center = 0.75 * pinch *
      sin(TAU * (
        connectionsEdgeT * (connectionsEdgeLength / (1.5 + offset)) +
        connectionsEdgePhase +
        offset * 0.31
      ));
    float distanceToFilament = abs(connectionsEdgeSide - center);
    strand = max(
      strand,
      1.0 - smoothstep(
        resolvedHalfWidth * 0.5,
        resolvedHalfWidth,
        distanceToFilament
      )
    );
  }
  strand *= coverage;
  float alpha = strand * webMask * connectionsEdgeGrowth * connectionsIntensity;
  if (alpha <= 0.02) discard;

  // Cords sag toward the deep underground tone at their midpoint. Against the
  // carried world's pale haze this is what makes a strand legible at all, so
  // it dips harder than the sparse web's tint did.
  float depthDip = 4.0 * connectionsEdgeT * (1.0 - connectionsEdgeT);
  vec3 cord = mix(connectionsEdgeColor, connectionsDepthColor, depthDip * 0.55);

  float travel = fract(
    connectionsEdgeT -
      connectionsTime * connectionsPulseSpeed / connectionsEdgeLength +
      connectionsEdgePhase
  );
  float pulse = 1.0 - smoothstep(0.0, connectionsPulseLength, travel);

  // Hallucinated in-between junctions: periodic bright knots along the cord
  // stand in for nodes that do not exist in the topology.
  float knotCount = max(1.0, floor(connectionsEdgeLength / connectionsKnotSpacing));
  float knot = pinch *
    pow(
      max(0.0, sin(TAU * (connectionsEdgeT * knotCount + connectionsEdgePhase))),
      24.0
    );

  vec3 lit = mix(
    cord,
    connectionsPulseColor,
    max(pulse * (0.5 + 0.5 * connectionsEdgeWeight), knot * 0.6)
  );

  gl_FragColor = vec4(lit, alpha);
}
