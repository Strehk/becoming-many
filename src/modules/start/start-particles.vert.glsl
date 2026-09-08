/* Start owns fixed particle buffers; its externally supplied formation and wake
 * facts animate the same visible particles without CPU simulation or uploads. */
uniform float startTime;
uniform mat4 startGoalPose;
uniform float startRadius;
uniform float startArrowAngle;
uniform vec3 startArrowOffset;
uniform float startArrowScale;
uniform float startFormation;
uniform float startCompletion;
uniform float startDriftAmplitude;
uniform float startDriftSpeed;
uniform vec3 startWakePosition;
uniform vec3 startWakeDirection;
uniform float startWakeStrength;
uniform float startWakeAge;
uniform float startWakeRadius;
uniform float startWakeDuration;
uniform float startWakeDistance;
attribute vec3 startTarget;
attribute float startArrowParticle;
attribute float startPhase;
varying float startBrightnessPhase;
varying float startShapePresence;

vec3 animateStartParticle(vec3 cloudPosition) {
  float time = startTime * startDriftSpeed;
  vec3 drift = vec3(
    sin(time * 0.71 + startPhase),
    cos(time * 0.53 + startPhase * 1.7),
    sin(time * 0.37 + startPhase * 2.3)
  ) * startDriftAmplitude;
  float formation = smoothstep(0.0, 1.0, startFormation);
  float shapeScale = startArrowParticle > 0.5
    ? startArrowScale
    : startRadius;
  vec3 target = startTarget * shapeScale;
  if (startArrowParticle > 0.5) {
    float cosine = cos(startArrowAngle);
    float sine = sin(startArrowAngle);
    target.xy = mat2(cosine, sine, -sine, cosine) * target.xy;
    target += startArrowOffset;
  }
  vec3 localPosition = mix(cloudPosition + drift, target + drift * 0.025, formation);
  vec3 worldPosition = (startGoalPose * vec4(localPosition, 1.0)).xyz;

  // One crossing has finite support and smoothly returns to unperturbed drift.
  // The initial displacement is zero, so starting a wake never snaps particles.
  float age = clamp(startWakeAge / startWakeDuration, 0.0, 1.0);
  float envelope = sin(age * 3.14159265359) * (1.0 - age);
  float distanceFromCrossing = length(worldPosition - startWakePosition);
  float influence = 1.0 - smoothstep(0.0, startWakeRadius, distanceFromCrossing);
  worldPosition += startWakeDirection * startWakeDistance * startWakeStrength * influence * envelope;
  startBrightnessPhase = startPhase + time * 0.8;
  startShapePresence = formation;
  return worldPosition;
}
