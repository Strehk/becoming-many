/*
 * Purpose: Give animated animals a body heat distribution instead of one flat temperature.
 * Context: Being alive means giving off heat; animals are the strongest signatures.
 * Responsibility: Write the radial view distance and the body's vertical temperature profile.
 * Boundary: Skinning happens before projection; detail, hotspots, and colors stay in the fragment stage.
 *
 * The profile is built from normalized height above the actor's feet, and from
 * nothing else. That is a deliberate limit, not a simplification of a richer
 * model: the actor's world offset turns with its heading, so height is the one
 * body coordinate that survives without the sense having to learn which way a
 * given species faces. It is also the coordinate that carries almost all of
 * the information in a thermal image of a standing quadruped — a warm torso
 * band, a second lobe at the neck and head, legs cooling downward into cold
 * hooves, and ear or antler tips cooling off again at the very top.
 *
 * Dividing by the species' own body height rather than working in metres is
 * what lets one profile fit a 0.25 m rat and a 1.6 m stag: the torso band sits
 * at the same fraction of the body in both.
 */

uniform float thermalActorWarmth;
uniform float thermalActorWarmthRange;
uniform float thermalBodyHeightMeters;
uniform float thermalCoreHeightFraction;
uniform vec2 thermalCoreSpread;
uniform float thermalHeadHeightFraction;
uniform vec2 thermalHeadSpread;
uniform float thermalHeadWarmthShare;
uniform float thermalTipStartFraction;
uniform float thermalTipCoolShare;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying float thermalSurfaceShade;
varying vec3 thermalDetailPosition;
varying float thermalWarmWeight;

void passThermalPerception(vec4 viewPosition) {
  thermalViewDistance = length(viewPosition.xyz);

  // The rest pose, not the skinned position: a heat pattern anchored to the
  // bind pose stays fixed to the body instead of swimming through it as the
  // walk cycle plays. modelMatrix carries the actor's world scale, so the
  // offset is already in metres above the actor's ground origin.
  vec3 bodyOffsetMeters =
    (modelMatrix * vec4(position, 1.0)).xyz - modelMatrix[3].xyz;
  float bodyProgress =
    clamp(bodyOffsetMeters.y / thermalBodyHeightMeters, 0.0, 1.0);

  // The torso: full core temperature through the inner width of the band,
  // cooling to the far end of the range by the outer width. Everything below
  // it is leg, and the falloff itself is what makes a hoof colder than a knee
  // and a knee colder than a haunch, with no step anywhere between them.
  float coreLobe = 1.0 - smoothstep(
    thermalCoreSpread.x,
    thermalCoreSpread.y,
    abs(bodyProgress - thermalCoreHeightFraction)
  );
  // The head and neck hold their own, narrower lobe a little under the core
  // temperature, so they read as a separate warm mass rather than as the top
  // of the torso.
  float headLobe = 1.0 - smoothstep(
    thermalHeadSpread.x,
    thermalHeadSpread.y,
    abs(bodyProgress - thermalHeadHeightFraction)
  );
  float profile = max(coreLobe, headLobe * thermalHeadWarmthShare);
  // Ears, antler tips, and the crown are thin and radiate to the sky, so the
  // topmost slice of the body cools back off.
  profile *= 1.0 - thermalTipCoolShare *
    smoothstep(thermalTipStartFraction, 1.0, bodyProgress);

  // The bind-pose normal rather than the skinned one: three.js builds the
  // skinned normal as a local of main(), out of reach of an injected function.
  // The grazing term is a subtle rim, so a limb's rest orientation is close
  // enough, and it stays consistent with the bind-pose body offset above.
  float structure =
    thermalGrain(bodyOffsetMeters) * thermalGrainWarmth -
    thermalGrazing(normalMatrix * normal, viewPosition.xyz) *
      thermalGrazingCoolness;

  interpolatedThermalWarmth =
    thermalActorWarmth - (1.0 - profile) * thermalActorWarmthRange + structure;
  // Body-anchored, so the fine texture and the hotspots stay on the animal
  // instead of sliding across it as it walks.
  thermalDetailPosition = bodyOffsetMeters;
  thermalWarmWeight = profile;
  thermalSurfaceShade = thermalHemisphericShade(mat3(modelMatrix) * normal);
}
