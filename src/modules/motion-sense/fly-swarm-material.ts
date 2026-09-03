/**
 * Purpose: Create the material used by the visible fly specks.
 * Context: Flies are opaque ink-dark points that read against the pale haze.
 * Responsibility: Own PointsMaterial creation and the circular fragment patch.
 * Boundary: Swarm simulation, buffers, trails, and lifecycle stay elsewhere.
 */

import { PointsMaterial } from "three";
import arrivalShader from "./fly-sense-arrival.vert.glsl?raw";
import circleShader from "./fly-swarm-circle.frag.glsl?raw";
import type { MotionSenseParameters } from "./motion-sense-settings";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
// Three.js assigns gl_PointSize between project_vertex and this include, so
// the sense fade must scale the size here (scent particles set the precedent).
const THREE_POINT_SIZE_SHADER = "#include <logdepthbuf_vertex>";
const MATERIAL_CACHE_KEY = "motion-fly-material-v4";

/** Create one opaque round-speck material for the fly point pool. */
export function createFlySwarmMaterial(
  appearance: MotionSenseParameters["appearance"],
  senseFadeUniform?: { readonly value: number },
): PointsMaterial {
  const pointsMaterial = new PointsMaterial({
    color: appearance.flyColor,
    size: appearance.flySizeMeters,
    sizeAttenuation: true,
  });

  pointsMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.motionSenseFade = senseFadeUniform ?? { value: 1 };
    shader.vertexShader = shader.vertexShader
      .replace(
        THREE_COMMON_SHADER,
        // The per-fly arrival carries a swarm in and out around a re-anchor:
        // its specks shrink away, the swarm moves while nothing of it is on
        // screen, and they swell back at the new place. The show's sense fade
        // is spread across the pool by a second, fixed per-fly share, so the
        // swarms gather speck by speck rather than appearing at once.
        `${THREE_COMMON_SHADER}\nuniform float motionSenseFade;\nattribute float flyArrival;\nattribute float flySenseArrival;\n${arrivalShader}`,
      )
      .replace(
        THREE_POINT_SIZE_SHADER,
        `gl_PointSize *= flySenseArrivalScale(motionSenseFade, flySenseArrival) * flyArrival;\n${THREE_POINT_SIZE_SHADER}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(THREE_COMMON_SHADER, `${THREE_COMMON_SHADER}\n${circleShader}`)
      .replace(
        THREE_CLIPPING_FRAGMENT_SHADER,
        `${THREE_CLIPPING_FRAGMENT_SHADER}\ndiscardOutsideFlySwarmCircle();`,
      );
  };
  pointsMaterial.customProgramCacheKey = () => MATERIAL_CACHE_KEY;

  return pointsMaterial;
}
