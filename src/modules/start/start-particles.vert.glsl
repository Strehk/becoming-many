/* Fixed local volume samples become world-anchored bodies through uniform poses.
 * Only presentation facts and time change; particle buffers remain immutable. */
uniform float startTime;
uniform float startPreviewTime;
uniform float startSparkle;
uniform mat4 startGoalPose;
uniform float startRadius;
uniform mat4 startArrowPose;
uniform float startArrowScale;
uniform mat4 startRetiringArrowPose;
uniform float startRetiringArrowFormation;
uniform float startRetiringArrowPresence;
uniform float startRetiringArrowDissolving;
uniform vec2 startRetiringArrowReleaseOrigin;
uniform float startThickness;
uniform mat4 startPreviewPoses[START_MAXIMUM_PREVIEWS];
uniform float startPreviewRadii[START_MAXIMUM_PREVIEWS];
uniform float startPreviewCrossingAges[START_MAXIMUM_PREVIEWS];
uniform float startPreviewCount;
uniform float startMaximumPointSize;
uniform float startMaximumHazePointSize;
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
varying float startArrowAccentStrength;

// Exact critically damped unit-mass spring solution: x'' + 2w*x' + w*w*x = 0.
// Initial displacement is the sampled cloud-to-body vector, initial velocity zero.
// Normalized transition time changes w, not the physical response; no integration drift.
float springGather(float progress, float dissolving, vec2 releaseOrigin) {
  float age = clamp(dissolving > 0.5 ? 1.0 - progress / max(0.0001, releaseOrigin.x) : progress, 0.0, 1.0);
  float response = (1.0 - (1.0 + 8.0 * age) * exp(-8.0 * age)) / 0.996980836;
  return dissolving > 0.5 ? releaseOrigin.y * (1.0 - response) : response;
}

struct StartBody {
  float formation;
  float crossingAge;
  float radius;
  mat4 pose;
  bool arrow;
  bool preview;
};

StartBody readStartBody() {
  bool retiring = startRole > 4.5;
  StartBody body = StartBody(springGather(startFormation, startDissolving, startReleaseOrigin),
    startWakeAge, startRadius, startGoalPose, (startRole > 0.5 && startRole < 1.5) || retiring,
    startRole > 1.5 && startRole < 4.5);
  startVisibility = startRingPresence;
  if (body.preview) {
    int index = int(startRole) - 2;
    body.radius = startPreviewRadii[index];
    body.pose = startPreviewPoses[index];
    body.formation = springGather((startPreviewTime - float(index) * 0.25) / 1.8, 0.0, vec2(1.0));
    body.crossingAge = startPreviewCrossingAges[index];
    startVisibility = float(index) < startPreviewCount ? 0.8 * startRingPresence : 0.0;
  }
  if (body.arrow) {
    body.formation = retiring
      ? springGather(startRetiringArrowFormation, startRetiringArrowDissolving, startRetiringArrowReleaseOrigin)
      : springGather(startArrowFormation, startArrowDissolving, startArrowReleaseOrigin);
    body.pose = retiring ? startRetiringArrowPose : startArrowPose;
    startVisibility = retiring ? startRetiringArrowPresence : startArrowPresence;
  }
  return body;
}

vec3 readStartTarget(StartBody body, float crossingPulse) {
  if (body.arrow) {
    vec3 target = startTarget * startArrowScale;
    target.z += sin(startTime * START_ARROW_DRIFT_SPEED) * START_ARROW_DRIFT_AMPLITUDE;
    return target;
  }
  float expansion = 1.0 + crossingPulse * START_CROSSING_EXPANSION;
  return vec3(startTarget.xy * body.radius * (1.0 + startThickness + startTarget.z * startThickness) * expansion,
    startDepth * body.radius * startThickness);
}

// A slow world-space breeze binds neighbours together. Small seeded eddies
// decorrelate their paths; release opens the air without a second simulation.
vec3 driftStartParticle(vec3 worldPosition, float time, float formation) {
  float placePhase = dot(worldPosition, vec3(0.083, 0.059, 0.101));
  float ownPhase = fract(startPhase * 2.128 + 0.37) * 6.2831853;
  vec3 breeze = vec3(sin(time * 0.31 + placePhase),
    cos(time * 0.23 + placePhase * 0.7) * 0.5,
    cos(time * 0.29 + placePhase));
  vec3 eddy = vec3(cos(time * 0.73 + ownPhase),
    sin(time * 0.61 + ownPhase * 1.7), sin(time * 0.83 - ownPhase));
  return worldPosition + (breeze * 0.7 + eddy * 0.3) * startDriftAmplitude
    * mix(1.6, 0.45, formation);
}

vec3 disperseStartParticle(vec3 worldPosition, StartBody body) {
  if (body.arrow || !(body.crossingAge >= 0.0)) return worldPosition;
  // Exact impulse response under linear drag: dv/dt = -drag*v.
  // Per-grain radial/tangential velocity disperses each crossed body independently.
  float travel = (1.0 - exp(-body.crossingAge * START_WAKE_DRAG)) / START_WAKE_DRAG;
  vec3 velocity = vec3(startTarget.xy * 1.7, sin(startPhase) * 0.8);
  vec3 forwardVelocity = body.preview ? (body.pose * vec4(0.0, 0.0, -START_WAKE_SPEED, 0.0)).xyz : startWakeDirection * START_WAKE_SPEED;
  startVisibility *= 1.0 - smoothstep(0.35, 2.2, body.crossingAge);
  return worldPosition + ((body.pose * vec4(velocity, 0.0)).xyz + forwardVelocity) * travel;
}

vec3 animateStartParticle(vec3 cloudPosition) {
  StartBody body = readStartBody();
  float time = startTime * startDriftSpeed;
  float crossingPulse = body.crossingAge >= 0.0 ? exp(-body.crossingAge * START_CROSSING_PULSE_DECAY) : 0.0;
  vec3 localPosition = mix(cloudPosition, readStartTarget(body, crossingPulse), body.formation);
  vec3 worldPosition = (body.pose * vec4(localPosition, 1.0)).xyz;
  worldPosition = driftStartParticle(worldPosition, time, body.formation);
  worldPosition = disperseStartParticle(worldPosition, body);
  startArrowAccentStrength = body.arrow ? body.formation : 0.0;
  startBrightness = (0.5 + 0.5 * sin(startPhase + time * 0.8)) * startSparkle;
  startShapePresence = body.formation;
  startHazePresence = startHaze;
  startLocalPulse = body.arrow ? 0.0 : crossingPulse;
  return worldPosition;
}
