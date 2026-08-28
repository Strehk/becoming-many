/**
 * Purpose: Create the material used by the Motion Trail ring buffer.
 * Context: Printed particles must age, fade, and drift GPU-only from one frame uniform.
 * Responsibility: Own PointsMaterial creation, shader patches, uniforms, and the frame counter.
 * Boundary: Ring bookkeeping, spawning, fly simulation, and render loops stay elsewhere.
 */

import { PointsMaterial } from "three";
import type {
  MotionSenseParameters,
  MotionTrailAppearance,
} from "./motion-sense-settings";
import fadeShader from "./motion-trail.frag.glsl?raw";
import ageShader from "./motion-trail.vert.glsl?raw";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_PROJECT_SHADER = "#include <project_vertex>";
const THREE_POINT_SIZE_SHADER = "#include <logdepthbuf_vertex>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
const MATERIAL_CACHE_KEY = "motion-trail-material-v1";

interface MotionTrailMaterialOptions {
  readonly appearance: MotionTrailAppearance;
  readonly trail: MotionSenseParameters["trail"];
  readonly intensity: number;
}

export interface MotionTrailMaterial {
  readonly pointsMaterial: PointsMaterial;

  /** Advance the GPU age reference to the newest printed ring frame. */
  readonly setFrame: (frame: number) => void;
}

/** Create one transparent ink-speck material with GPU-only aging. */
export function createMotionTrailMaterial({
  appearance,
  trail,
  intensity,
}: MotionTrailMaterialOptions): MotionTrailMaterial {
  const frameUniform = { value: 0 };
  const intensityUniform = { value: intensity };
  const lifetimeUniform = { value: trail.lifetimeFrames };
  const expansionUniform = { value: trail.expansionDistanceMeters };
  const fadePowerUniform = { value: trail.fadePower };
  const pointsMaterial = new PointsMaterial({
    color: appearance.trailColor,
    size: appearance.trailSizeMeters,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: appearance.trailOpacity,
  });

  pointsMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.motionFrame = frameUniform;
    shader.uniforms.motionIntensity = intensityUniform;
    shader.uniforms.motionLifetimeFrames = lifetimeUniform;
    shader.uniforms.motionExpansionMeters = expansionUniform;
    shader.uniforms.motionFadePower = fadePowerUniform;
    shader.vertexShader = patchAgeShader(shader.vertexShader);
    shader.fragmentShader = patchFadeShader(shader.fragmentShader);
  };
  pointsMaterial.customProgramCacheKey = () => MATERIAL_CACHE_KEY;

  return {
    pointsMaterial,
    setFrame: (frame) => {
      frameUniform.value = frame;
    },
  };
}

function patchAgeShader(vertexShader: string): string {
  return vertexShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${ageShader}`)
    .replace(
      THREE_POSITION_SHADER,
      `${THREE_POSITION_SHADER}\ntransformed = expandMotionTrailParticle(transformed);`,
    )
    .replace(
      THREE_PROJECT_SHADER,
      `${THREE_PROJECT_SHADER}\ngl_Position = getMotionTrailClipPosition(gl_Position);`,
    )
    .replace(
      // Three.js assigns gl_PointSize between project_vertex and this include,
      // so the age fade must scale the size here.
      THREE_POINT_SIZE_SHADER,
      `gl_PointSize *= getMotionTrailSizeScale();\n${THREE_POINT_SIZE_SHADER}`,
    );
}

function patchFadeShader(fragmentShader: string): string {
  return fragmentShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${fadeShader}`)
    .replace(
      // diffuseColor is declared directly before this include in the Points
      // fragment shader, so the age fade can scale its alpha here.
      THREE_CLIPPING_FRAGMENT_SHADER,
      `${THREE_CLIPPING_FRAGMENT_SHADER}\ndiscardOutsideMotionTrailCircle();\ndiffuseColor.a *= getMotionTrailAlpha();`,
    );
}
