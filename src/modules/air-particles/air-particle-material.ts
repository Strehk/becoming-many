/**
 * Purpose: Create the material used by the Air Particles cloud.
 * Context: Points need GPU-only motion and an optional circular fragment shape.
 * Responsibility: Own PointsMaterial creation, shader patches, uniforms, and animation time.
 * Boundary: Particle placement, buffers, streaming, lifecycle, and render loops stay elsewhere.
 */

import { PointsMaterial } from "three";
import circleShader from "./air-particle-circle.frag.glsl?raw";
import motionShader from "./air-particle-motion.vert.glsl?raw";
import {
  AIR_PARTICLES_SETTINGS,
  type AirParticleShape,
  type AirParticlesParameters,
} from "./air-particles-settings";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_PROJECT_SHADER = "#include <project_vertex>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
const MATERIAL_CACHE_KEY = "air-particle-material-v1";

interface AirParticleMaterialOptions {
  readonly appearance: AirParticlesParameters["appearance"];
  readonly motion: AirParticlesParameters["motion"];
}

export interface AirParticleMaterial {
  readonly pointsMaterial: PointsMaterial;
  readonly update: (deltaSeconds: number) => void;
}

/** Create one opaque material whose shader variant matches the requested shape. */
export function createAirParticleMaterial({
  appearance,
  motion,
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
  });

  pointsMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.airParticleTime = timeUniform;
    shader.uniforms.airParticleHorizontalAmplitude = horizontalAmplitudeUniform;
    shader.uniforms.airParticleVerticalAmplitude = verticalAmplitudeUniform;
    shader.vertexShader = patchMotionShader(shader.vertexShader);
    shader.fragmentShader = patchShapeShader(shader.fragmentShader, shape);
  };

  // Shape participates in the key so Three.js never reuses the square program
  // for a circle or compiles circle fragment work for the default square path.
  pointsMaterial.customProgramCacheKey = () => `${MATERIAL_CACHE_KEY}:${shape}`;

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
      `${THREE_PROJECT_SHADER}\ngl_Position = getAirParticleClipPosition(gl_Position);`,
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
