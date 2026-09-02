/**
 * Purpose: Fade whole surface groups into and out of the live background.
 * Context: A show stands structure up and strikes it by presence, not alpha.
 * Responsibility: Own the presence and background uniforms and the color mix.
 * Boundary: What presence means at a show time is the show driver's concern.
 */

import { Color } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import fragmentShader from "./world-fade.frag.glsl?raw";

const WORLD_FADE_CACHE_KEY = "world-fade-v1";

/**
 * One fading surface group. Everything patched by the same instance shares
 * one presence and one background, so a group condenses out of the haze — and
 * dissolves back into it — as a whole. Materials stay opaque: the mix moves
 * color toward the background rather than alpha toward zero, which keeps the
 * XR render path free of transition-time overdraw and sorting.
 */
export interface WorldFadeEffect extends UnlitMaterialEffect {
  /** 0 is fully dissolved into the background, 1 is fully present. */
  readonly setPresence: (presence: number) => void;
  /** Track the live background so the mix target never lags a lerp. */
  readonly setBackground: (background: Color) => void;
}

/** Create one surface group's fade; apply it first so it wins the color. */
export function createWorldFade(): WorldFadeEffect {
  const presenceUniform = { value: 1 };
  const backgroundUniform = { value: new Color(0xffffff) };

  return {
    setPresence: (presence) => {
      presenceUniform.value = presence;
    },
    setBackground: (background) => {
      backgroundUniform.value.copy(background);
    },
    applyTo: (material) => {
      applyShaderPatch(material, {
        cacheKey: WORLD_FADE_CACHE_KEY,
        uniforms: {
          worldFadePresence: presenceUniform,
          worldFadeBackground: backgroundUniform,
        },
        vertexHeader: "",
        vertexAnchor: "#include <begin_vertex>",
        vertexCall: "",
        fragmentHeader: fragmentShader,
        colorFragmentCall:
          "diffuseColor.rgb = applyWorldFade(diffuseColor.rgb);",
      });
    },
  };
}
