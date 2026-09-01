/*
 * Purpose: Build, place, light, and cull one grass blade entirely in the vertex stage.
 * Context: The field is geometry-bound, so every instruction here is paid a million times a frame.
 * Responsibility: Derive world position, height, bend, wind, and color from one instance value.
 * Boundary: The ground height and the zone cover arrive sampled; the fragment stage only writes.
 *
 * The three.js chunk includes are this module's material-effect hook. A sense
 * injects its declarations after <common> and its call after
 * <project_vertex>, exactly as it does in the built-in passes, so the field
 * answers to Echo Depth and Thermal Perception without either module knowing
 * that this grass is not an ordinary surface.
 */

#include <common>

/*
 * One blade is one instance. The template geometry carries only
 * `position.x` (side: -1 / +1, 0 at the tip), `position.y` (height 0..1), and
 * `position.z` (which strip of the cross tuft). Everything else — world
 * position, facing, height, bend, wind, color, and the whole lighting — is
 * derived here from a hash of the world position.
 *
 * Per instance exactly one vec3 leaves memory: the low-discrepancy grid cell
 * inside the chunk and the blade's rank. Because the instances follow a
 * low-discrepancy sequence, every subset "rank < f" is spread evenly over the
 * chunk, so f can come continuously from the distance without leaving holes.
 */
attribute vec3 aGrassCell;

uniform float uGrassTime;
uniform float uGrassChunkSize;

uniform float uGrassBladeHeight;
uniform float uGrassBladeWidth;
uniform float uGrassMinAngular;
uniform float uGrassCurve;

uniform vec2 uGrassWindDirection;
uniform float uGrassWindStrength;
uniform float uGrassWindSpeed;
uniform float uGrassWindScale;

uniform float uGrassFadeStart;
uniform float uGrassFadeEnd;

uniform float uGrassDensityGain;
uniform float uGrassDensityRef;
uniform float uGrassRankScale;
uniform float uGrassDissolve;
uniform float uGrassJitter;
uniform float uGrassDensity0;

uniform vec4 uGrassFrustum[4];
uniform float uGrassCullRadius;

uniform sampler2D uGrassHeightField;
/** World XZ of the centre of texel zero, metres per texel, texels per side. */
uniform vec4 uGrassHeightPlacement;
/** Lowest ground height and the span the normalized channel covers. */
uniform vec2 uGrassHeightRange;

uniform vec3 uGrassSunDirection;
uniform vec3 uGrassSunColor;
uniform vec3 uGrassSkyColor;
uniform vec3 uGrassRootColor;
uniform vec3 uGrassTipColor;
uniform vec3 uGrassFogColor;
uniform float uGrassFogDensity;
uniform float uGrassExposure;
uniform float uGrassAmbientOcclusion;
uniform float uGrassTranslucency;

varying vec3 vGrassColor;

/** Dave Hoskins' hash: three random values from a position, without a texture. */
vec3 grassHash32(vec2 point) {
  vec3 spread = fract(vec3(point.xyx) * vec3(0.1031, 0.1030, 0.0973));
  spread += dot(spread, spread.yxz + 33.33);
  return fract((spread.xxy + spread.yzz) * spread.zyx);
}

/*
 * Large-scale clumpiness: drives blade height, bare patches, and the darkening
 * underneath. A sum of directed waves, not a product of sines — a product sits
 * near zero across the whole zero grid of both factors, the value clumps
 * around one half and the contrast disappears. Three waves with different
 * directions and wavelengths interfere into a broad, axis-free pattern at the
 * price of three sines instead of four hashes.
 */
float grassClump(vec2 point) {
  float wave = sin(dot(point, vec2(0.213, 0.077)) + 0.7) +
    sin(dot(point, vec2(-0.068, 0.139)) - 1.9) +
    0.85 * sin(dot(point, vec2(0.121, -0.286)) + 2.3);
  return clamp(wave * 0.185 + 0.5, 0.0, 1.0);
}

vec3 grassTonemap(vec3 color) {
  return clamp(
    (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14),
    0.0,
    1.0
  );
}

void main() {
  float side = position.x;
  float t = position.y;

  // The cell is chunk-local and the chunk position sits in the model matrix.
  // Reading its translation column directly saves a full 4x4 multiply, which
  // counts because these lines also run for every blade discarded below.
  vec2 cellWorld = modelMatrix[3].xz + aGrassCell.xy * uGrassChunkSize;

  // The early, cheap rejection, before every hash, sample, and sine. A
  // discarded blade costs about twenty instructions instead of three hundred,
  // and all vertices of an instance take the same branch, so the triangle
  // degenerates and falls out at setup. This is what moves frustum culling
  // from the CPU into the shader and makes the chunk size a free parameter.
  float roughDistance = distance(cellWorld, cameraPosition.xz);
  float ref = uGrassDensityRef / max(roughDistance, uGrassDensityRef);
  float keep = min(uGrassDensityGain * ref * ref, 1.0);
  float rank = aGrassCell.z * uGrassRankScale;
  // A blade crossing the threshold shrinks across a band instead of vanishing.
  float dissolve = 1.0 - smoothstep(
    keep * (1.0 - uGrassDissolve),
    keep * (1.0 + uGrassDissolve),
    rank
  );
  // Offset the outer edge per blade, or a visible ring travels along it.
  float edgeJitter = fract(rank) - 0.5;
  float fadeEnd = uGrassFadeEnd * (1.0 + edgeJitter * 0.10);

  // Rank and distance first: they need nothing but arithmetic already done,
  // and in the far field the rank test alone discards most of the blades.
  if (dissolve <= 0.002 || roughDistance >= fadeEnd) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  vec3 random = grassHash32(cellWorld);
  vec3 random2 = grassHash32(cellWorld + 71.31);

  /*
   * The true mean blade spacing from the density law, 1/sqrt(D(d)). Not the
   * spacing of the allocated cells: after thinning the blades stand
   * 1/sqrt(keep) further apart, and a scatter scaled to the allocation is far
   * too small in the distance, which lets the cell grid show through. The
   * width below needs the same value, so it costs nothing extra.
   */
  float spacing = inversesqrt(max(uGrassDensity0 * ref * ref, 1e-4));
  vec2 bladeXZ = cellWorld + (random.xy - 0.5) * spacing * uGrassJitter;

  // The ground and the zone cover in one fetch. The window is camera-following
  // and snapped to its own texel grid, so this stays stable while walking.
  vec2 heightUv =
    (bladeXZ - uGrassHeightPlacement.xy) / uGrassHeightPlacement.z;
  heightUv = (heightUv + 0.5) / uGrassHeightPlacement.w;
  vec2 ground = texture2D(uGrassHeightField, heightUv).rg;
  float groundY = uGrassHeightRange.x + ground.r * uGrassHeightRange.y;
  float cover = ground.g;
  if (cover <= 0.004) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  vec3 root = vec3(bladeXZ.x, groundY, bladeXZ.y);

  // The frustum test runs on the real root, not on the cell at ground level
  // zero. Testing a flat probe needs a cull radius that covers the whole
  // elevation range of the world, and the angular error of that offset is
  // largest exactly where the blades are closest — which cuts a circle of
  // bare ground around the viewer while the distance stays grown. The radius
  // now only has to cover a blade's own height and its scatter.
  bool inside = true;
  for (int plane = 0; plane < 4; plane++) {
    inside = inside &&
      (dot(uGrassFrustum[plane].xyz, root) + uGrassFrustum[plane].w >
        -uGrassCullRadius);
  }
  if (!inside) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  vec3 toCamera = cameraPosition - root;
  float dist = length(toCamera);
  vec3 view = toCamera / max(dist, 1e-4);

  float clump = grassClump(bladeXZ);
  // Both factors reach at most one, so the authored height is an exact maximum
  // rather than a nominal value that scatter and clumping quietly multiply.
  float height = uGrassBladeHeight *
    mix(0.30, 1.0, random.z * random.z) *
    mix(0.72, 1.0, clump);
  // Bare patches: some blades fail entirely. Without them the field reads as
  // freshly mown rather than grown.
  height *= smoothstep(0.05, 0.32, clump * 0.72 + random2.x * 0.28);
  height *= cover;
  // Both transitions act on the height, so a blade grows as it comes closer
  // instead of appearing.
  height *= dissolve;
  height *= 1.0 - smoothstep(
    uGrassFadeStart * (1.0 + edgeJitter * 0.10),
    fadeEnd,
    dist
  );

  float yaw = random2.y * 6.2831853;
  vec2 facing = vec2(cos(yaw), sin(yaw));
  vec2 bendDirection = facing;
  float wind = 0.0;

#if GRASS_WIND
  float phase =
    dot(bladeXZ, uGrassWindDirection) * uGrassWindScale -
    uGrassTime * uGrassWindSpeed;
#if GRASS_WIND_SIMPLE
  // Distant blades: one sine instead of a nested gust and per-blade sway. The
  // factor keeps the mean identical to the full variant, or the tier border
  // would show as a strip where the field suddenly blows harder.
  float gust = 0.5 + 0.5 * sin(phase * 0.31);
  wind = uGrassWindStrength * (0.18 + 0.82 * gust * gust) * 0.675;
#else
  float gust = 0.5 + 0.5 * sin(phase * 0.31 + sin(phase * 0.117) * 2.2);
  float sway = 0.5 + 0.5 * sin(phase * 1.7 + random2.z * 6.2831853);
  wind = uGrassWindStrength *
    (0.18 + 0.82 * gust * gust) *
    (0.35 + 0.65 * sway);
#endif
#if GRASS_FLUTTER
  wind += sin(uGrassTime * (5.5 + 3.0 * random2.z) + random.x * 6.2831853) *
    0.09 * wind;
#endif
  // The bending plane turns into the wind as it rises, so the whole field lays
  // over coherently while keeping its variance.
  bendDirection = normalize(
    mix(facing, uGrassWindDirection, clamp(wind * 1.1, 0.0, 0.88)) +
      vec2(1e-4, 1e-4)
  );
#endif

  vec2 sideDirection = vec2(bendDirection.y, -bendDirection.x);

  // The blade is a circular arc, not a displaced strip: the arc length is
  // preserved exactly, so bending never stretches or squashes it. Long blades
  // hang further than short ones — the difference between lawn and meadow.
#if GRASS_CURVE
  float heightFraction = height / max(uGrassBladeHeight, 1e-3);
  float theta = uGrassCurve *
    (0.30 + 1.35 * random2.z * random2.z) *
    (0.45 + 0.75 * heightFraction);
  theta = max(theta + wind * 1.35, 0.02);
  float arc = theta * t;
  float arcSin = sin(arc);
  float arcCos = cos(arc);
  float up = height * arcSin / theta;
  float forward = height * (1.0 - arcCos) / theta;
#else
  float theta = max(wind * 1.35, 0.02);
  float arcSin = sin(theta);
  float arcCos = cos(theta);
  float up = height * t * arcCos;
  float forward = height * t * arcSin;
#endif

  // Near blades keep their true width; beyond a distance they inflate to a
  // minimum angular width instead of falling under pixel size. A max(), not a
  // multiply: exact up close, stable far away.
  float width = uGrassBladeWidth * (0.72 + 0.56 * random.y);
  width = max(width, max(dist * uGrassMinAngular, spacing * 0.26));
  float taper = sqrt(max(1.0 - t * t * 0.88, 0.0));
  float halfWidth = width * 0.5 * taper * side;

  // The second strip of a cross tuft bends around the same axis; only its
  // width axis is turned, so the tuft stays visible from every direction.
  vec2 widthDirection = position.z > 0.5 ? bendDirection : sideDirection;
  vec3 sideVector = vec3(widthDirection.x, 0.0, widthDirection.y);
  vec3 bendVector = vec3(bendDirection.x, 0.0, bendDirection.y);
  vec3 world =
    root + sideVector * halfWidth + bendVector * forward + vec3(0.0, up, 0.0);

#if GRASS_LIT
  vec3 tangent = vec3(bendDirection.x * arcSin, arcCos, bendDirection.y * arcSin);
  vec3 normal = cross(sideVector, tangent);
#if GRASS_NORMAL_BEND
  // The flat geometry is shaded round. sideVector and normal are orthonormal,
  // so the result is already unit length and a normalize would be waste.
  float bend = 0.62 * side * taper;
  normal = normal * cos(bend) + sideVector * sin(bend);
#endif
  // Blades are visible from both sides: turn the normal toward the camera
  // instead of paying for gl_FrontFacing in the fragment stage.
  normal *= sign(dot(normal, view));

  float lambert = dot(normal, uGrassSunDirection);
  float diffuse = lambert * 0.5 + 0.5;
  diffuse *= diffuse;

  // Ambient occlusion: dark at the base, darker inside dense clumps. Without a
  // dark undergrowth every grass field reads flat.
  float occlusion =
    mix(1.0 - uGrassAmbientOcclusion, 1.0, t * t * 0.65 + t * 0.35) *
    mix(0.68, 1.0, 1.0 - clump * 0.5);

  vec3 albedo = mix(uGrassRootColor, uGrassTipColor, t * 0.75 + 0.25 * t * t);
  albedo *= 0.84 + 0.32 * random2.x;

  // Direct sun is occluded far more than diffuse sky light, so each carries
  // its own share of the occlusion.
  vec3 ambient = uGrassSkyColor * (0.5 + 0.5 * normal.y) * mix(0.42, 1.0, occlusion);
  vec3 lit = albedo * (uGrassSunColor * diffuse * occlusion + ambient);
  // Bounce: green scattered light from the field catches the blade bases.
  lit += albedo * uGrassTipColor * (0.28 * (1.0 - t * t) * occlusion);

#if GRASS_TRANSLUCENCY
  float through = max(dot(-view, uGrassSunDirection), 0.0);
  lit += uGrassSunColor * uGrassTipColor *
    (uGrassTranslucency * through * through * through * mix(0.15, 1.0, t));
#endif

#if GRASS_SPECULAR
  vec3 halfway = normalize(uGrassSunDirection + view);
  lit += uGrassSunColor * pow(max(dot(normal, halfway), 0.0), 70.0) * (0.22 * t * t);
#endif

  // Cubic rather than quadratic: the near field stays clear and the distance
  // thickens quickly, which hides that the blades shrink to zero out there.
  float fogDepth = dist * uGrassFogDensity;
  float fog = 1.0 - exp(-fogDepth * fogDepth * fogDepth);
  lit = mix(lit, uGrassFogColor, fog);

  vGrassColor = grassTonemap(lit * uGrassExposure);
#else
  // A sense owns the color here: Echo Depth replaces it with its distance ramp
  // and Thermal covers it inside its radius. What remains is the root-to-tip
  // gradient that shows below full sense intensity — so the whole lighting
  // block above, some eighty instructions per vertex, is compiled out.
  vGrassColor = mix(uGrassRootColor, uGrassTipColor, t * 0.75 + 0.25 * t * t);
#endif

  // The chunk matrix is a pure translation, so subtracting it returns the
  // local position <project_vertex> expects. That keeps one projection path
  // and leaves every sense effect the `mvPosition` and the `transformed` it
  // measures against — both variants resolve to the same world position.
  vec3 transformed = world - modelMatrix[3].xyz;

  #include <project_vertex>
}
