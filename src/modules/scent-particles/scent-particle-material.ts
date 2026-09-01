/**
 * Purpose: Create the materials used by the two scent particle layers.
 * Context: Points need GPU-only life-cycle motion and a circular fragment shape.
 * Responsibility: Own material creation, shader patches, uniforms, and their clock input.
 * Boundary: Particle placement, buffers, printing, and lifecycle stay elsewhere.
 */

import { PointsMaterial, Vector2 } from "three";
import circleShader from "./scent-particle-circle.frag.glsl?raw";
import motionShader from "./scent-particle-motion.vert.glsl?raw";
import {
  type AnimalScentParameters,
  SCENT_PARTICLES_SETTINGS,
  type ScentParticlesParameters,
} from "./scent-particles-settings";
import trailShader from "./scent-trail-motion.vert.glsl?raw";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_POSITION_SHADER = "#include <begin_vertex>";
const THREE_PROJECT_SHADER = "#include <project_vertex>";
const THREE_POINT_SIZE_SHADER = "#include <logdepthbuf_vertex>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
const PLANT_MATERIAL_CACHE_KEY = "scent-particle-material-v2";
const TRAIL_MATERIAL_CACHE_KEY = "scent-trail-material-v1";

interface ScentParticleMaterialOptions {
  readonly appearance: ScentParticlesParameters["appearance"];
  readonly motion: ScentParticlesParameters["motion"];
  /** Shared with the module handle; a show fades the sense through it. */
  readonly senseFadeUniform?: { readonly value: number };
}

interface ScentTrailMaterialOptions {
  readonly appearance: ScentParticlesParameters["appearance"];
  readonly motion: ScentParticlesParameters["motion"];
  readonly animals: AnimalScentParameters;
  /** Shared with the module handle; a show fades the sense through it. */
  readonly senseFadeUniform?: { readonly value: number };
}

export interface ScentParticleMaterial {
  readonly pointsMaterial: PointsMaterial;
  /** Advance the shared looping clock; the module owns the one clock value. */
  readonly setTime: (loopSeconds: number) => void;

  /** Set the metres this layer is carried downwind over one particle life. */
  readonly setWind: (metresX: number, metresZ: number) => void;
}

/**
 * The clock, the intensity, the show fade, the wind, and the drift are the
 * same inputs in both layers, because both drift on one breath of air and a
 * show fades the whole sense at once. Only the life cycle around them
 * differs, so each factory adds its own uniforms to these.
 */
function createSharedScentLayer(
  appearance: ScentParticlesParameters["appearance"],
  motion: ScentParticlesParameters["motion"],
  senseFadeUniform: { readonly value: number } | undefined,
) {
  const timeUniform = { value: 0 };
  const windUniform = { value: new Vector2() };

  return {
    pointsMaterial: createPointsMaterial(appearance.sizeMeters),
    uniforms: {
      scentTime: timeUniform,
      scentIntensity: { value: resolveIntensity(appearance.intensity) },
      scentSenseFade: senseFadeUniform ?? { value: 1 },
      scentDriftAmplitude: { value: motion.driftAmplitudeMeters },
      scentWind: windUniform,
    },
    setTime: (loopSeconds: number) => {
      timeUniform.value = loopSeconds;
    },
    setWind: (metresX: number, metresZ: number) =>
      windUniform.value.set(metresX, metresZ),
  };
}

/** Create one opaque vertex-colored material with looping life-cycle animation. */
export function createScentParticleMaterial({
  appearance,
  motion,
  senseFadeUniform,
}: ScentParticleMaterialOptions): ScentParticleMaterial {
  validateRiseDuration(motion.riseDurationSeconds);

  const layer = createSharedScentLayer(appearance, motion, senseFadeUniform);
  const { pointsMaterial } = layer;
  const uniforms = {
    ...layer.uniforms,
    scentRiseDuration: { value: motion.riseDurationSeconds },
  };

  pointsMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = patchVertexShader(shader.vertexShader, motionShader, {
      animate: "animateScentParticle",
      clip: "getScentParticleClipPosition",
      size: "getScentParticleSizeScale",
    });
    shader.fragmentShader = patchShapeShader(shader.fragmentShader);
  };
  pointsMaterial.customProgramCacheKey = () => PLANT_MATERIAL_CACHE_KEY;

  return {
    pointsMaterial,
    setTime: layer.setTime,
    setWind: layer.setWind,
  };
}

/** Create the material of the trail animals print behind themselves. */
export function createScentTrailMaterial({
  appearance,
  motion,
  animals,
  senseFadeUniform,
}: ScentTrailMaterialOptions): ScentParticleMaterial {
  validateTrailLifetime(animals.lifetimeSeconds);

  const layer = createSharedScentLayer(appearance, motion, senseFadeUniform);
  const { pointsMaterial } = layer;
  const uniforms = {
    ...layer.uniforms,
    scentLoopSeconds: { value: SCENT_PARTICLES_SETTINGS.animationLoopSeconds },
    scentTrailLifetime: { value: animals.lifetimeSeconds },
    scentTrailRiseHeight: { value: animals.riseHeightMeters },
  };

  pointsMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = patchVertexShader(shader.vertexShader, trailShader, {
      animate: "animateScentTrailParticle",
      clip: "getScentTrailClipPosition",
      size: "getScentTrailSizeScale",
    });
    shader.fragmentShader = patchShapeShader(shader.fragmentShader);
  };
  pointsMaterial.customProgramCacheKey = () => TRAIL_MATERIAL_CACHE_KEY;

  return {
    pointsMaterial,
    setTime: layer.setTime,
    setWind: layer.setWind,
  };
}

function createPointsMaterial(sizeMeters: number): PointsMaterial {
  return new PointsMaterial({
    vertexColors: true,
    size: sizeMeters,
    sizeAttenuation: true,
  });
}

function resolveIntensity(intensity: number | undefined): number {
  return intensity ?? SCENT_PARTICLES_SETTINGS.defaultIntensity;
}

/**
 * The looping clock wraps at the animation loop. A rise that does not divide
 * it evenly leaves a visible jump at every wrap, so it is rejected here
 * rather than shipped as a comment.
 */
function validateRiseDuration(riseDurationSeconds: number): void {
  const loopSeconds = SCENT_PARTICLES_SETTINGS.animationLoopSeconds;
  if (
    riseDurationSeconds > 0 &&
    Number.isInteger(loopSeconds / riseDurationSeconds)
  ) {
    return;
  }

  throw new RangeError(
    `Scent rise duration must divide ${loopSeconds} seconds evenly`,
  );
}

/** A trail older than the wrapping clock would alias onto fresh prints. */
function validateTrailLifetime(lifetimeSeconds: number): void {
  const loopSeconds = SCENT_PARTICLES_SETTINGS.animationLoopSeconds;
  if (lifetimeSeconds > 0 && lifetimeSeconds <= loopSeconds) return;

  throw new RangeError(
    `Scent trail lifetime must be above 0 and at most ${loopSeconds} seconds`,
  );
}

interface VertexShaderFunctions {
  readonly animate: string;
  readonly clip: string;
  readonly size: string;
}

function patchVertexShader(
  vertexShader: string,
  moduleShader: string,
  functions: VertexShaderFunctions,
): string {
  return vertexShader
    .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${moduleShader}`)
    .replace(
      THREE_POSITION_SHADER,
      `${THREE_POSITION_SHADER}\ntransformed = ${functions.animate}(transformed);`,
    )
    .replace(
      THREE_PROJECT_SHADER,
      `${THREE_PROJECT_SHADER}\ngl_Position = ${functions.clip}(gl_Position);`,
    )
    .replace(
      // Three.js assigns gl_PointSize between project_vertex and this include,
      // so the life-cycle fade must scale the size here.
      THREE_POINT_SIZE_SHADER,
      `gl_PointSize *= ${functions.size}();\n${THREE_POINT_SIZE_SHADER}`,
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
