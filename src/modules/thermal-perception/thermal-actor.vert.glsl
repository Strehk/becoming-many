/*
 * Purpose: Give animated animals a body heat distribution instead of one flat temperature.
 * Context: Being alive means giving off heat; animals are the strongest signatures.
 * Responsibility: Write the radial view distance and the body's vertical temperature profile.
 * Boundary: Skinning happens before projection; detail, hotspots, and colors stay in the fragment stage.
 *
 * The profile is built from two body coordinates, and from nothing else:
 * normalized height above the actor's feet, and distance from the body's own
 * vertical axis. That is a deliberate limit. The actor's world offset turns
 * with its heading, so a forward or a sideways coordinate would need the sense
 * to learn which way each species faces — but height and the distance from the
 * axis it turns about both survive any heading untouched.
 *
 * Between them they carry almost all of a thermal image of a standing
 * quadruped. Height gives the warm torso band, the second lobe at neck and
 * head, legs cooling downward into cold hooves, and ear or antler tips cooling
 * off again at the very top. Distance from the axis gives what height alone
 * cannot: heat that sits in the trunk's inner volume and falls off outward
 * through the flanks to nose and tail, instead of one horizontal slab of body
 * reading equally hot end to end.
 *
 * Both are read as fractions of the species' own body height rather than in
 * metres, which is what lets one profile fit a 0.25 m rat and a 1.6 m stag:
 * the torso sits at the same fraction of the body in both.
 */

uniform float thermalActorWarmth;
uniform float thermalActorWarmthRange;
uniform float thermalBodyHeightMeters;
uniform float thermalCoreHeightFraction;
uniform vec2 thermalCoreSpread;
uniform vec2 thermalCoreRadiusSpread;
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

/*
 * One lobe of the body's heat, in whichever body coordinate it is measured:
 * full strength inside the inner width, falling smoothly to nothing by the
 * outer one. Every term of the profile is this same shape, so the field the
 * lobes build has no corner anywhere — the gradient across a body is the point
 * of the profile, and a corner in it would read as a seam between two patches
 * of temperature.
 */
float thermalBodyLobe(float bodyDistance, vec2 spread) {
  return 1.0 - smoothstep(spread.x, spread.y, bodyDistance);
}

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
  // Distance from the body's vertical axis, in body heights. Rotating the
  // actor turns the offset around that axis and leaves this untouched.
  float bodyRadius = length(bodyOffsetMeters.xz) / thermalBodyHeightMeters;

  /*
   * The torso, and the hottest thing in the world: a compact volume around the
   * body's centre rather than a band across a height. The height term is what
   * makes a hoof colder than a knee and a knee colder than a haunch; the radial
   * term is what keeps the heat in the deep trunk and lets it fall away through
   * the flanks toward nose and tail. Both reach full core temperature only over
   * a narrow inner width, so the peak is a place on the animal rather than a
   * plateau across half of it.
   */
  float coreLobe =
    thermalBodyLobe(
      abs(bodyProgress - thermalCoreHeightFraction),
      thermalCoreSpread
    ) *
    thermalBodyLobe(bodyRadius, thermalCoreRadiusSpread);
  /*
   * The head and neck hold their own, narrower lobe a little under the core
   * temperature, so they read as a separate warm mass rather than as the top of
   * the torso. It carries no radial term: a head is at the far end of a body,
   * which is exactly where the core's radial falloff has already given up, and
   * a muzzle is genuinely one of the hottest things on an animal. What keeps
   * antlers and ear tips out of it is the tip term below, which is a height.
   */
  float headLobe = thermalBodyLobe(
    abs(bodyProgress - thermalHeadHeightFraction),
    thermalHeadSpread
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
