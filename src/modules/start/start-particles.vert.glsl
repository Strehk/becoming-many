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
uniform float startPreviewCount;
uniform float startCrossingPulse;
uniform float startMaximumPointSize;
uniform float startFormation;
uniform float startSectionPresence;
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

vec3 animateStartParticle(vec3 cloudPosition) {
  float time = startTime * startDriftSpeed;
  vec3 drift = vec3(
    sin(time * 0.71 + startPhase),
    cos(time * 0.53 + startPhase * 1.7),
    sin(time * 0.37 + startPhase * 2.3)
  ) * startDriftAmplitude;
  bool arrow = startRole > 0.5 && startRole < 1.5;
  bool preview = startRole > 1.5;
  float formation = smoothstep(0.0, 1.0, startFormation);
  float radius = startRadius;
  mat4 pose = startGoalPose;
  startVisibility = startSectionPresence;
  if (preview) {
    int index = int(startRole) - 2;
    radius = startPreviewRadii[index];
    pose = startPreviewPoses[index];
    formation = smoothstep(1.0 + float(index) * 0.65, 4.5 + float(index) * 0.65, startPreviewTime);
    startVisibility = float(index) < startPreviewCount ? 0.8 * startSectionPresence : 0.0;
  }
  vec3 target;
  if (arrow) {
    target = startTarget * startArrowScale;
    float cosine = cos(startArrowAngle);
    float sine = sin(startArrowAngle);
    target.xy = mat2(cosine, sine, -sine, cosine) * target.xy;
    pose = startArrowPose;
    target.z += sin(startTime * 0.65) * 0.12;
  } else {
    float expansion = preview ? 1.0 : 1.0 + startCrossingPulse * 0.065;
    target = vec3(startTarget.xy * radius * (1.0 + startThickness + startTarget.z * startThickness) * expansion,
      startDepth * radius * startThickness);
  }
  vec3 localPosition = mix(cloudPosition + drift, target + drift * 0.65, formation);
  vec3 worldPosition = (pose * vec4(localPosition, 1.0)).xyz;
  // Only the counted ring reacts; preview guides and the arrow remain calm.
  if (!preview && !arrow) {
    float age = clamp(startWakeAge / startWakeDuration, 0.0, 1.0);
    float envelope = sin(age * 3.14159265359) * (1.0 - age);
    float influence = 1.0 - smoothstep(0.0, startWakeRadius, length(worldPosition - startWakePosition));
    worldPosition += startWakeDirection * startWakeDistance * startWakeStrength * influence * envelope;
  }
  startBrightness = (0.5 + 0.5 * sin(startPhase + time * 0.8)) * startSparkle;
  startShapePresence = formation;
  startHazePresence = startHaze;
  startLocalPulse = !preview && !arrow ? startCrossingPulse : 0.0;
  return worldPosition;
}
