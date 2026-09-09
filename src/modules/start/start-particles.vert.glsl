/* Fixed local volume samples become world-anchored bodies through uniform poses.
 * Only presentation facts and time change; particle buffers remain immutable. */
uniform float startTime;
uniform float startPreviewTime;
uniform float startSparkle;
uniform mat4 startGoalPose;
uniform float startRadius;
uniform float startArrowAngle;
uniform mat4 startArrowPose;
uniform float startArrowScale;
uniform float startThickness;
uniform mat4 startPreviewPoses[3];
uniform float startPreviewRadii[3];
uniform float startPreviewCrossingAges[3];
uniform float startPreviewCount;
uniform float startMaximumPointSize;
uniform float startFormation;
uniform float startDissolving;
uniform vec2 startReleaseOrigin;
uniform float startArrowFormation;
uniform float startArrowDissolving;
uniform vec2 startArrowReleaseOrigin;
uniform float startArrowPresence;
uniform float startRingPresence;
uniform float startDriftAmplitude;
uniform float startDriftSpeed;
uniform vec3 startWakeDirection;
uniform float startWakeStrength;
uniform float startWakeAge;
attribute vec3 startTarget;
attribute float startRole;
attribute float startPhase;
attribute float startDepth;
attribute float startParticleSize;
attribute float startHaze;
varying float startBrightness;
varying float startShapePresence;
varying float startDistanceFade;
varying float startHazePresence;
varying float startLocalPulse;
varying float startVisibility;

// Exact critically damped unit-mass spring solution: x'' + 2w*x' + w*w*x = 0.
// Initial displacement is the sampled cloud-to-body vector, initial velocity zero.
// Normalized transition time changes w, not the physical response; no integration drift.
float springGather(float progress, float dissolving, vec2 releaseOrigin) {
  float age = clamp(dissolving > 0.5 ? 1.0 - progress / max(0.0001, releaseOrigin.x) : progress, 0.0, 1.0);
  float response = (1.0 - (1.0 + 8.0 * age) * exp(-8.0 * age)) / 0.996980836;
  return dissolving > 0.5 ? releaseOrigin.y * (1.0 - response) : response;
}

vec3 animateStartParticle(vec3 cloudPosition) {
  float time = startTime * startDriftSpeed;
  vec3 drift = vec3(
    sin(time * 0.71 + startPhase),
    cos(time * 0.53 + startPhase * 1.7),
    sin(time * 0.37 + startPhase * 2.3)
  ) * startDriftAmplitude;
  bool arrow = startRole > 0.5 && startRole < 1.5;
  bool preview = startRole > 1.5;
  float formation = springGather(startFormation, startDissolving, startReleaseOrigin);
  float crossingAge = startWakeStrength > 0.0 ? startWakeAge : -1.0;
  float radius = startRadius;
  mat4 pose = startGoalPose;
  startVisibility = startRingPresence;
  if (preview) {
    int index = int(startRole) - 2;
    radius = startPreviewRadii[index];
    pose = startPreviewPoses[index];
    formation = springGather((startPreviewTime - float(index) * 0.25) / 1.8, 0.0, vec2(1.0));
    crossingAge = startPreviewCrossingAges[index];
    startVisibility = float(index) < startPreviewCount ? 0.8 * startRingPresence : 0.0;
  }
  float crossingPulse = crossingAge >= 0.0 ? exp(-crossingAge * 4.0) : 0.0;
  vec3 target;
  if (arrow) {
    formation = springGather(startArrowFormation, startArrowDissolving, startArrowReleaseOrigin);
    startVisibility = startArrowPresence;
    target = startTarget * startArrowScale;
    float cosine = cos(startArrowAngle);
    float sine = sin(startArrowAngle);
    target.xy = mat2(cosine, sine, -sine, cosine) * target.xy;
    pose = startArrowPose;
    target.z += sin(startTime * 0.65) * 0.12;
  } else {
    float expansion = 1.0 + crossingPulse * 0.065;
    target = vec3(startTarget.xy * radius * (1.0 + startThickness + startTarget.z * startThickness) * expansion,
      startDepth * radius * startThickness);
  }
  vec3 localPosition = mix(cloudPosition + drift, target + drift * 0.65, formation);
  vec3 worldPosition = (pose * vec4(localPosition, 1.0)).xyz;
  if (!arrow && crossingAge >= 0.0) {
    // Exact impulse response under linear drag: dv/dt = -drag*v.
    // Per-grain radial/tangential velocity disperses each crossed body independently.
    float travel = (1.0 - exp(-crossingAge * 1.8)) / 1.8;
    vec3 velocity = vec3(startTarget.xy * 1.7, sin(startPhase) * 0.8);
    vec3 forwardVelocity = preview ? (pose * vec4(0.0, 0.0, -1.5, 0.0)).xyz : startWakeDirection * 1.5;
    worldPosition += ((pose * vec4(velocity, 0.0)).xyz + forwardVelocity) * travel;
    startVisibility *= 1.0 - smoothstep(0.2, 1.4, crossingAge);
  }
  startBrightness = (0.5 + 0.5 * sin(startPhase + time * 0.8)) * startSparkle;
  startShapePresence = formation;
  startHazePresence = startHaze;
  startLocalPulse = arrow ? 0.0 : crossingPulse;
  return worldPosition;
}
