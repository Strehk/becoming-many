/*
 * Purpose: Apply Scent Particle rise, drift, wind, and lifecycle fade in the vertex stage.
 * Context: Scent clouds animate without CPU uploads from one looping time uniform.
 * Responsibility: Offset points along their life cycle and scale faded points to nothing.
 * Boundary: Emitter placement, colors, point shape, and lifecycle stay in TypeScript.
 */

uniform float scentTime;
uniform float scentIntensity;
uniform float scentSenseFade;
uniform float scentRiseDuration;
uniform float scentDriftAmplitude;

// Metres a particle is carried downwind across one whole life, already
// scaled by the current wind strength on the CPU.
uniform vec2 scentWind;

attribute float scentPhase;
attribute float scentVisible;

// How far this particle's own plant lifts its scent. A bush that released
// its scent as high as a pine would leave the plant it belongs to.
attribute float scentRise;

const float SCENT_TAU = 6.2831853;
// 5 * TAU / 60 keeps the drift seamless at the 60-second time-uniform wrap;
// only whole turns per wrap do. Down from seven: the churn was reading as
// weather blowing through the air rather than as scent hanging in it.
const float SCENT_DRIFT_RATE = 0.5235988;
const float SCENT_DRIFT_PHASE_SCALE = 1.7;
/*
 * A particle is carried and drifts by its age, so a long fade-in only ever
 * shows the scent once it has already left the plant, and the plant's upwind
 * side stayed empty. Fading in fast and out slow keeps the near air around
 * the plant occupied while the far end of the plume still thins out.
 */
const float SCENT_FADE_IN_PORTION = 0.08;
const float SCENT_FADE_OUT_PORTION = 0.3;
const float SCENT_MINIMUM_VISIBLE_SCALE = 0.01;
// Spread of the per-particle drift amplitude around the authored value.
const float SCENT_AMPLITUDE_SPREAD = 0.55;
/*
 * The life phase also decides the age, so particles visible at one moment
 * hold a narrow band of phases. Reusing it directly as a drift phase would
 * hand every visible particle nearly the same drift again. Scrambling it
 * spreads that band across the whole turn, which is what decorrelates the
 * drift from the life cycle without paying for a second attribute.
 */
const float SCENT_PHASE_SCRAMBLE = 13.37;
const float SCENT_PHASE_OFFSET = 0.37;
/*
 * A second, faster turn per particle, so no two neighbours trace one circle.
 * The rate has to stay a whole multiple of the drift rate, or the drift no
 * longer closes at the 60-second wrap. Carrying most of the drift on the fast
 * turn is what reads as turbulence rather than as one wide swirl: the same
 * travel, taken in smaller and quicker steps.
 */
const float SCENT_DRIFT_DETAIL_RATE = 3.0;
const float SCENT_DRIFT_DETAIL_SHARE = 0.62;
/*
 * The drift opens out with age rather than holding one amplitude for the
 * whole life. A particle leaves its plant tight and loosens as it travels,
 * which is the difference between a cloud that churns in place and one that
 * disperses. Near one the opening is even across the life; higher, the drift
 * stays small for most of it and only lets go near the end, which held the
 * air around the plant too still.
 */
const float SCENT_DRIFT_SPREAD_POWER = 1.05;

float scentSizeScale = 0.0;

vec3 animateScentParticle(vec3 restingPosition) {
  float age = fract(scentTime / scentRiseDuration + scentPhase);

  // Particles of emitters without a source-zone anchor never rasterize.
  scentSizeScale = scentVisible * scentIntensity * scentSenseFade
    * smoothstep(0.0, SCENT_FADE_IN_PORTION, age)
    * (1.0 - smoothstep(1.0 - SCENT_FADE_OUT_PORTION, 1.0, age));

  // The drift phase is the particle's own, not its position's. Deriving it
  // from the resting place alone gave every particle of one plant nearly the
  // same phase, so the cloud slid about as a rigid block instead of churning.
  float scrambled = fract(scentPhase * SCENT_PHASE_SCRAMBLE + SCENT_PHASE_OFFSET);
  float ownPhase = scrambled * SCENT_TAU;
  float placePhase = dot(restingPosition, vec3(0.083, 0.059, 0.101));
  float driftPhase = ownPhase + placePhase;
  float amplitude = scentDriftAmplitude
    * (1.0 + (scrambled - 0.5) * SCENT_AMPLITUDE_SPREAD);

  vec2 slowTurn = vec2(
    cos(scentTime * SCENT_DRIFT_RATE + driftPhase),
    sin(scentTime * SCENT_DRIFT_RATE + driftPhase * SCENT_DRIFT_PHASE_SCALE)
  );
  vec2 fastTurn = vec2(
    cos(scentTime * SCENT_DRIFT_RATE * SCENT_DRIFT_DETAIL_RATE - ownPhase),
    sin(scentTime * SCENT_DRIFT_RATE * SCENT_DRIFT_DETAIL_RATE + ownPhase)
  );
  vec2 drift = amplitude
    * pow(age, SCENT_DRIFT_SPREAD_POWER)
    * mix(slowTurn, fastTurn, SCENT_DRIFT_DETAIL_SHARE);

  // Wind grows with age: the scent leaves its plant the longer it has been
  // in the air, so a stand reads as plants with plumes rather than as fog.
  vec2 carried = scentWind * age;

  vec3 lifeOffset = vec3(
    drift.x + carried.x,
    age * scentRise,
    drift.y + carried.y
  );

  return restingPosition + lifeOffset;
}

vec4 getScentParticleClipPosition(vec4 visibleClipPosition) {
  if (scentSizeScale > SCENT_MINIMUM_VISIBLE_SCALE) return visibleClipPosition;

  // Fully faded points stay in the fixed GPU buffer but are moved beyond
  // clip space so intensity zero rasterizes nothing.
  return vec4(2.0, 2.0, 2.0, 1.0);
}

float getScentParticleSizeScale() {
  return scentSizeScale;
}
