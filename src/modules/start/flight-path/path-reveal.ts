import type { PathParticleMaterial } from "./particle-contract";

/** One GPU front reveals prepared particles; generation and playback clocks are separate. */
export function createPathRevealMaterial(
  base: PathParticleMaterial,
  softEdgeMeters: number,
): PathParticleMaterial {
  const front = { value: 0 };
  const compile = base.pointsMaterial.onBeforeCompile.bind(base.pointsMaterial);
  const key = base.pointsMaterial.customProgramCacheKey();
  base.pointsMaterial.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.uniforms.pathRevealFront = front;
    shader.uniforms.pathRevealWidth = { value: softEdgeMeters };
    shader.vertexShader = patchVertex(shader.vertexShader);
    shader.fragmentShader = patchFragment(shader.fragmentShader);
  };
  base.pointsMaterial.customProgramCacheKey = () => `${key}:growing-route-v2`;
  return {
    ...base,
    setRevealMeters: (meters) => {
      front.value = meters;
    },
  };
}

function patchVertex(source: string): string {
  return (
    source
      // Path poses contain translation and yaw only. Convert world wind back to local axes.
      .replace(
        "transformed = animateAirParticle(transformed);",
        `vec3 restingWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vec3 worldWind = animateAirParticle(restingWorld) - restingWorld;
      transformed += vec3(dot(modelMatrix[0].xyz, worldWind),
        dot(modelMatrix[1].xyz, worldWind), dot(modelMatrix[2].xyz, worldWind));`,
      )
      .replace(
        "#include <common>",
        "#include <common>\nattribute float routeDistance; varying float pathDistance;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\npathDistance = routeDistance;",
      )
  );
}

function patchFragment(source: string): string {
  return source
    .replace(
      "#include <common>",
      "#include <common>\nvarying float pathDistance; uniform float pathRevealFront; uniform float pathRevealWidth;",
    )
    .replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\ndiffuseColor.a *= smoothstep(0.0, pathRevealWidth, pathRevealFront - pathDistance);",
    );
}
