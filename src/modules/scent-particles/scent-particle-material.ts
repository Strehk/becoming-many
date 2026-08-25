/**
 * Purpose: Create the material used by the Scent Particle field.
 * Context: Points need GPU-only life-cycle motion and a circular fragment shape.
 * Responsibility: Own PointsMaterial creation, shader patches, uniforms, and animation time.
 * Boundary: Particle placement, buffers, lifecycle, and render loops stay elsewhere.
 */

import { PointsMaterial } from "three";
import circleShader from "./scent-particle-circle.frag.glsl?raw";
import motionShader from "./scent-particle-motion.vert.glsl?raw";
import {
  SCENT_PARTICLES_SETTINGS,
  type ScentParticlesParameters,
} from "./scent-particles-settings";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_PROJECT_SHADER = "#include <project_vertex>";
const THREE_POINT_SIZE_SHADER = "#include <logdepthbuf_vertex>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
const MATERIAL_CACHE_KEY = "scent-particle-material-v1";

interface ScentParticleMaterialOptions {
  readonly appearance: ScentParticlesParameters["appearance"];
  readonly motion: ScentParticlesParameters["motion"];
}

export interface ScentParticleMaterial {
  readonly pointsMaterial: PointsMaterial;
  readonly update: (deltaSeconds: number) => void;
}

/** Create one opaque vertex-colored material with looping life-cycle animation. */
export function createScentParticleMaterial({
  appearance,
  motion,
}: ScentParticleMaterialOptions): ScentParticleMaterial {
  const timeUniform = { value: 0 };
  const intensityUniform = {
    value: appearance.intensity ?? SCENT_PARTICLES_SETTINGS.defaultIntensity,
  };
  const riseHeightUniform = { value: motion.riseHeightMeters };
  const riseDurationUniform = { value: motion.riseDurationSeconds };
  const driftAmplitudeUniform = { value: motion.driftAmplitudeMeters };
  const pointsMaterial = new PointsMaterial({
    vertexColors: true,
    size: appearance.sizeMeters,
    sizeAttenuation: true,
  });

  pointsMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.scentTime = timeUniform;
    shader.uniforms.scentIntensity = intensityUniform;
    shader.uniforms.scentRiseHeight = riseHeightUniform;
    shader.uniforms.scentRiseDuration = riseDurationUniform;
    shader.uniforms.scentDriftAmplitude = driftAmplitudeUniform;
    shader.vertexShader = patchMotionShader(shader.vertexShader);
    shader.fragmentShader = patchShapeShader(shader.fragmentShader);
  };
  pointsMaterial.customProgramCacheKey = () => MATERIAL_CACHE_KEY;

  return {
    pointsMaterial,
    update: (deltaSeconds) => {
      timeUniform.value =
        (timeUniform.value + deltaSeconds * motion.speedMultiplier) %
        SCENT_PARTICLES_SETTINGS.animationLoopSeconds;
    },
  };
}

function patchMotionShader(vertexShader: string): string {
  return vertexShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${motionShader}`)
    .replace(
      THREE_POSITION_SHADER,
      `${THREE_POSITION_SHADER}\ntransformed = animateScentParticle(transformed);`,
    )
    .replace(
      THREE_PROJECT_SHADER,
      `${THREE_PROJECT_SHADER}\ngl_Position = getScentParticleClipPosition(gl_Position);`,
    )
    .replace(
      // Three.js assigns gl_PointSize between project_vertex and this include,
      // so the life-cycle fade must scale the size here.
      THREE_POINT_SIZE_SHADER,
      `gl_PointSize *= getScentParticleSizeScale();\n${THREE_POINT_SIZE_SHADER}`,
    );
}

function patchShapeShader(fragmentShader: string): string {
  return fragmentShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${circleShader}`)
    .replace(
      THREE_CLIPPING_FRAGMENT_SHADER,
      `${THREE_CLIPPING_FRAGMENT_SHADER}\ndiscardOutsideScentParticleCircle();`,
    );
}
