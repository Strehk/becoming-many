/**
 * Purpose: Create the material used by the Air Particles cloud.
 * Context: Points need GPU-only motion and an optional circular fragment shape.
 * Responsibility: Own PointsMaterial creation, shader patches, uniforms, and animation time.
 * Boundary: Particle placement, buffers, streaming, lifecycle, and render loops stay elsewhere.
 */

import { PointsMaterial } from "three";
import circleShader from "./point-cloud-circle.frag.glsl?raw";
import distanceShader from "./point-cloud-distance.frag.glsl?raw";
import motionShader from "./point-cloud-motion.vert.glsl?raw";
import {
  AIR_PARTICLES_SETTINGS,
  type AirParticleShape,
  type AirParticlesParameters,
} from "./point-cloud-settings";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_PROJECT_SHADER = "#include <project_vertex>";
const THREE_LOG_DEPTH_VERTEX_SHADER = "#include <logdepthbuf_vertex>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
const MATERIAL_CACHE_KEY = "air-particle-material-v2";

interface AirParticleMaterialOptions {
  readonly appearance: AirParticlesParameters["appearance"];
  readonly motion: AirParticlesParameters["motion"];
  readonly streaming?: AirParticlesParameters["streaming"];
}

export interface AirParticleMaterial {
  readonly pointsMaterial: PointsMaterial;
  readonly update: (deltaSeconds: number) => void;
}

/** Keep the default opaque; a local field fades before its resident slots recycle. */
export function createAirParticleMaterial({
  appearance,
  motion,
  streaming,
}: AirParticleMaterialOptions): AirParticleMaterial {
  const shape = appearance.shape ?? AIR_PARTICLES_SETTINGS.defaultShape;
  const timeUniform = { value: 0 };
  const horizontalAmplitudeUniform = {
    value: motion.horizontalAmplitudeMeters,
  };
  const verticalAmplitudeUniform = { value: motion.verticalAmplitudeMeters };
  const pointsMaterial = new PointsMaterial({
    color: appearance.color,
    size: appearance.sizeMeters,
    sizeAttenuation: true,
    transparent: streaming !== undefined,
    depthWrite: streaming === undefined,
  });
  if (streaming) pointsMaterial.defines = { AIR_PARTICLE_DISTANCE_FADE: 1 };

  pointsMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.airParticleTime = timeUniform;
    shader.uniforms.airParticleHorizontalAmplitude = horizontalAmplitudeUniform;
    shader.uniforms.airParticleVerticalAmplitude = verticalAmplitudeUniform;
    if (streaming) {
      shader.uniforms.airParticleFadeStart = {
        value: streaming.fadeStartMeters,
      };
      shader.uniforms.airParticleFadeEnd = {
        value: streaming.viewDistanceMeters,
      };
    }
    shader.vertexShader = patchMotionShader(shader.vertexShader);
    shader.fragmentShader = patchShapeShader(shader.fragmentShader, shape);
    if (streaming) {
      // Apply the limit after Three.js has converted world size to pixel size.
      shader.vertexShader = shader.vertexShader.replace(
        THREE_LOG_DEPTH_VERTEX_SHADER,
        `gl_PointSize = min(gl_PointSize, AIR_PARTICLE_MAXIMUM_SIZE_PIXELS);\n${THREE_LOG_DEPTH_VERTEX_SHADER}`,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          THREE_COMMON_SHADER,
          `${THREE_COMMON_SHADER}\n${distanceShader}`,
        )
        .replace(
          THREE_CLIPPING_FRAGMENT_SHADER,
          `${THREE_CLIPPING_FRAGMENT_SHADER}\ndiffuseColor.a *= airParticleDistanceOpacity;`,
        );
    }
  };

  // Shape participates in the key so Three.js never reuses the square program
  // for a circle or compiles circle fragment work for the default square path.
  pointsMaterial.customProgramCacheKey = () =>
    `${MATERIAL_CACHE_KEY}:${shape}:${streaming !== undefined}`;

  return {
    pointsMaterial,
    update: (deltaSeconds) => {
      timeUniform.value =
        (timeUniform.value + deltaSeconds * motion.speedMultiplier) %
        AIR_PARTICLES_SETTINGS.animationLoopSeconds;
    },
  };
}

function patchMotionShader(vertexShader: string): string {
  return vertexShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${motionShader}`)
    .replace(
      THREE_POSITION_SHADER,
      `${THREE_POSITION_SHADER}\ntransformed = animateAirParticle(transformed);`,
    )
    .replace(
      THREE_PROJECT_SHADER,
      `${THREE_PROJECT_SHADER}\ngl_Position = getAirParticleClipPosition(gl_Position, mvPosition.xyz);`,
    );
}

function patchShapeShader(
  fragmentShader: string,
  shape: AirParticleShape,
): string {
  if (shape === "square") return fragmentShader;

  return fragmentShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${circleShader}`)
    .replace(
      THREE_CLIPPING_FRAGMENT_SHADER,
      `${THREE_CLIPPING_FRAGMENT_SHADER}\ndiscardOutsideAirParticleCircle();`,
    );
}
