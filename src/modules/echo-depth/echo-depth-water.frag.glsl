/*
 * Purpose: Hold the river's water out of the depth ramp as one authored tone.
 * Context: A level may show water as itself while every dry surface stays depth.
 * Responsibility: Swap the ramp color for the water tone across the water surface.
 * Boundary: The ramp shape lives in echo-depth.frag; the measure arrives as a varying.
 */

uniform vec3 echoWaterColor;

varying float echoWaterMeasure;

/*
 * The measure is positive only where the surface holds water, so its zero
 * crossing is the shoreline and one step is the whole test — no branch. An
 * unbound attribute reads zero, which the epsilon keeps on the dry side.
 */
const float ECHO_WATER_EPSILON = 0.0001;

vec3 applyEchoDepthWithWater(vec3 baseColor) {
  float rampProgress = getEchoRampProgress();
  // Water dissolves across the same last ramp segment as everything else, so a
  // distant river fades into the haze instead of staying a saturated thread at
  // the horizon.
  vec3 waterTone = mix(
    echoWaterColor,
    echoHazeColor,
    smoothstep(echoRampStops.z, 1.0, rampProgress)
  );
  vec3 sensed = mix(
    getEchoRampColor(rampProgress),
    waterTone,
    step(ECHO_WATER_EPSILON, echoWaterMeasure)
  );

  return mix(baseColor, sensed, echoIntensity);
}
