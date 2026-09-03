/*
 * Purpose: Age, carry, and scatter the scent an animal printed as it passed.
 * Context: Printed particles stay where they were left; only age and wind move them.
 * Responsibility: Turn one print time into a drifting, spreading, thinning particle.
 * Boundary: Printing, positions, colors, and the ring buffer stay in TypeScript.
 */

uniform float scentTime;
uniform float scentIntensity;
uniform float scentSenseFade;
uniform float scentLoopSeconds;
uniform float scentTrailLifetime;
uniform float scentTrailRiseHeight;
uniform float scentDriftAmplitude;

// Metres a print is carried downwind across one whole lifetime, already
// scaled by the current wind strength on the CPU.
uniform vec2 scentWind;

attribute float scentPrintTime;
attribute float scentPhase;
attribute float scentVisible;

const float SCENT_TAU = 6.2831853;
// Matches the plant layer, so both drift on one breath of air.
const float SCENT_DRIFT_RATE = 0.5235988;
const float SCENT_TRAIL_FADE_IN = 0.06;
const float SCENT_TRAIL_HOLD = 0.5;
const float SCENT_MINIMUM_VISIBLE_SCALE = 0.01;
// The spread grows faster than the age, so the far end of a route opens out
// into a fan while the fresh end stays a readable line.
const float SCENT_TRAIL_SPREAD_POWER = 1.6;
// Each print keeps its own direction, so a route frays instead of sliding.
const float SCENT_TRAIL_DIRECTION_SPREAD = 1.0;

float scentSizeScale = 0.0;

vec3 animateScentTrailParticle(vec3 printedPosition) {
  // The looping clock wraps, so the age is the wrapped difference. Lifetimes
  // above the loop length would alias and are rejected on the CPU side.
  float ageSeconds = mod(
    scentTime - scentPrintTime + scentLoopSeconds,
    scentLoopSeconds
  );
  float age = ageSeconds / scentTrailLifetime;

  // Slots never printed, and prints older than one lifetime, never rasterize.
  scentSizeScale = scentVisible * scentIntensity * scentSenseFade
    * step(age, 1.0)
    * smoothstep(0.0, SCENT_TRAIL_FADE_IN, age)
    * (1.0 - smoothstep(SCENT_TRAIL_HOLD, 1.0, age));

  // Every print walks away along its own bearing at its own pace. The older
  // the print, the further it has walked, so the route opens out behind the
  // animal instead of staying one thin thread.
  float ownPhase = scentPhase * SCENT_TAU;
  float spread = pow(age, SCENT_TRAIL_SPREAD_POWER)
    * scentDriftAmplitude
    * SCENT_TRAIL_DIRECTION_SPREAD;
  vec2 bearing = vec2(cos(ownPhase), sin(ownPhase));
  vec2 wander = vec2(
    cos(scentTime * SCENT_DRIFT_RATE + ownPhase),
    sin(scentTime * SCENT_DRIFT_RATE + ownPhase)
  );
  vec2 scatter = spread * (bearing + wander * 0.4);

  // Wind carries the whole route downwind, and carries the old end furthest.
  vec2 carried = scentWind * age;

  vec3 lifeOffset = vec3(
    scatter.x + carried.x,
    age * scentTrailRiseHeight,
    scatter.y + carried.y
  );

  return printedPosition + lifeOffset;
}

vec4 getScentTrailClipPosition(vec4 visibleClipPosition) {
  if (scentSizeScale > SCENT_MINIMUM_VISIBLE_SCALE) return visibleClipPosition;

  // Faded prints stay in the fixed GPU buffer but are moved beyond clip space
  // so an expired or unused slot rasterizes nothing.
  return vec4(2.0, 2.0, 2.0, 1.0);
}

float getScentTrailSizeScale() {
  return scentSizeScale;
}
