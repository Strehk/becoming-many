/*
 * Purpose: Overlay animated magnetic field stripes in one terrain pass.
 * Context: Magnetic perception must preserve any existing ground presentation.
 * Responsibility: Calculate transparent isolines and narrower pulses contained inside them.
 * Boundary: Base ground color, terrain geometry, grass, sky, and physical lighting stay elsewhere.
 */

uniform float magneticTime;
uniform float magneticLineSpacing;
uniform float magneticLineWidth;
uniform float magneticPulseWidth;
uniform float magneticLineOpacity;
uniform float magneticFlowSpeed;
uniform float magneticIntensity;
uniform vec2 magneticFieldDirection;
uniform vec3 magneticLineColor;
uniform vec3 magneticPulseColor;

varying vec3 magneticWorldPosition;

const float TERRAIN_HEIGHT_WARP = 0.9;
const float FLOW_PERIOD_METERS = 48.0;

float magneticBand(float phase) {
  float leadingEdge = smoothstep(0.02, 0.08, phase);
  float trailingEdge = 1.0 - smoothstep(0.38, 0.5, phase);
  return leadingEdge * trailingEdge;
}

vec3 applyMagneticLines(vec3 baseColor) {
  vec2 acrossField = vec2(
    -magneticFieldDirection.y,
    magneticFieldDirection.x
  );
  float along = dot(magneticWorldPosition.xz, magneticFieldDirection);
  float across = dot(magneticWorldPosition.xz, acrossField);
  float stream = (
    across + magneticWorldPosition.y * TERRAIN_HEIGHT_WARP
  ) / magneticLineSpacing;
  float lineId = floor(stream);
  float distanceMeters = abs(fract(stream) - 0.5) * magneticLineSpacing;
  float antialiasWidth = max(fwidth(stream) * magneticLineSpacing * 0.7, 0.01);
  float lineHalfWidth = magneticLineWidth * 0.5;
  float line = 1.0 - smoothstep(
    lineHalfWidth,
    lineHalfWidth + antialiasWidth,
    distanceMeters
  );
  float pulseHalfWidth = magneticPulseWidth * 0.5;
  float pulseCrossSection = 1.0 - smoothstep(
    pulseHalfWidth,
    pulseHalfWidth + antialiasWidth,
    distanceMeters
  );

  float linePhase = fract(
    (along - magneticTime * magneticFlowSpeed) / FLOW_PERIOD_METERS +
      lineId * 0.381966
  );
  float flow = magneticBand(linePhase);
  // The whole sense answers to one intensity: lines and pulses fade
  // together when a dramaturgy driver takes the strength below one.
  float lineStrength = clamp(
    line * magneticLineOpacity * magneticIntensity,
    0.0,
    1.0
  );
  float pulseStrength = clamp(
    line * pulseCrossSection * flow * magneticIntensity,
    0.0,
    1.0
  );

  vec3 lineColor = mix(baseColor, magneticLineColor, lineStrength);
  return mix(lineColor, magneticPulseColor, pulseStrength);
}
