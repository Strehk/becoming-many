/**
 * Purpose: Patch built-in and module-owned shaders with one sense effect's GLSL.
 * Context: Every material effect injects the same way; the wrap logic must live once.
 * Responsibility: Wrap onBeforeCompile, merge uniforms, inject at anchors, extend the cache key.
 * Boundary: Effects own GLSL, uniforms, and parameter validation; this hook validates injection anchors.
 *
 * Anchor ordering: every patch keeps the anchor text in its replacement and
 * String.replace hits the first occurrence, so a patch applied LATER injects its
 * call line BEFORE an earlier patch's line. The FIRST-applied effect therefore
 * executes LAST and wins the final `diffuseColor`. Consumers order their effect
 * lists with the winning effect first (see the push sites in level-composition).
 */

import type { SensedMaterial } from "./material-effect";

const THREE_COMMON_SHADER = "#include <common>";
const THREE_COLOR_FRAGMENT = "#include <color_fragment>";

/** One effect's complete shader injection, applied to one material. */
export interface MaterialShaderPatch {
  /** Suffix appended to the material's program cache key. */
  readonly cacheKey: string;
  /** Shared uniform objects merged into every patched program. */
  readonly uniforms: Readonly<Record<string, { value: unknown }>>;
  /** GLSL declarations inserted after the vertex stage's common include. */
  readonly vertexHeader: string;
  /** Vertex main() anchor the call is appended to. */
  readonly vertexAnchor:
    | "#include <begin_vertex>"
    | "#include <project_vertex>";
  /** Call statement appended after the vertex anchor. */
  readonly vertexCall: string;
  /** GLSL declarations inserted after the fragment stage's common include. */
  readonly fragmentHeader: string;
  /** Call statement appended after the color fragment include. */
  readonly colorFragmentCall: string;
}

/** Decorate the material's shader program while preserving earlier patches. */
export function applyShaderPatch(
  material: SensedMaterial,
  patch: MaterialShaderPatch,
): void {
  const compileBaseMaterial = material.onBeforeCompile.bind(material);
  const baseCacheKey = material.customProgramCacheKey();

  material.onBeforeCompile = (shader, renderer) => {
    compileBaseMaterial(shader, renderer);
    // Check the whole patch before changing any uniforms or shader source.
    for (const [stage, anchor, injection] of [
      ["vertexShader", THREE_COMMON_SHADER, patch.vertexHeader],
      ["vertexShader", patch.vertexAnchor, patch.vertexCall],
      ["fragmentShader", THREE_COMMON_SHADER, patch.fragmentHeader],
      ["fragmentShader", THREE_COLOR_FRAGMENT, patch.colorFragmentCall],
    ] as const) {
      if (injection && !shader[stage].includes(anchor)) {
        throw new Error(
          `Material "${material.name || material.type}" cannot apply "${patch.cacheKey}": missing ${stage} anchor "${anchor}"`,
        );
      }
    }
    Object.assign(shader.uniforms, patch.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        THREE_COMMON_SHADER,
        `${THREE_COMMON_SHADER}\n${patch.vertexHeader}`,
      )
      .replace(
        patch.vertexAnchor,
        `${patch.vertexAnchor}\n${patch.vertexCall}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        THREE_COMMON_SHADER,
        `${THREE_COMMON_SHADER}\n${patch.fragmentHeader}`,
      )
      .replace(
        THREE_COLOR_FRAGMENT,
        `${THREE_COLOR_FRAGMENT}\n${patch.colorFragmentCall}`,
      );
  };
  material.customProgramCacheKey = () => `${baseCacheKey}:${patch.cacheKey}`;
}
