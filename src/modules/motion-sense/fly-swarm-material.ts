/**
 * Purpose: Create the material used by the visible fly specks.
 * Context: Flies are opaque ink-dark points that read against the pale haze.
 * Responsibility: Own PointsMaterial creation and the circular fragment patch.
 * Boundary: Swarm simulation, buffers, trails, and lifecycle stay elsewhere.
 */

import { PointsMaterial } from "three";
import circleShader from "./fly-swarm-circle.frag.glsl?raw";
import type { MotionSenseParameters } from "./motion-sense-settings";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_CLIPPING_FRAGMENT_SHADER = "#include <clipping_planes_fragment>";
const MATERIAL_CACHE_KEY = "motion-fly-material-v1";

/** Create one opaque round-speck material for the fly point pool. */
export function createFlySwarmMaterial(
  appearance: MotionSenseParameters["appearance"],
): PointsMaterial {
  const pointsMaterial = new PointsMaterial({
    color: appearance.flyColor,
    size: appearance.flySizeMeters,
    sizeAttenuation: true,
  });

  pointsMaterial.onBeforeCompile = (shader) => {
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
