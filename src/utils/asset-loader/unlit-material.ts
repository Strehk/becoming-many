/**
 * Purpose: Convert loaded model materials into authored unlit materials.
 * Context: Static instances and animated animals must stay readable without scene lights.
 * Responsibility: Preserve geometry-facing settings and use either source appearance or level color.
 * Boundary: Palette selection, model traversal, instancing, and disposal stay with consumers.
 */

import {
  type Color,
  type Material,
  MeshBasicMaterial,
  type Texture,
} from "three";

interface MaterialWithMaps extends Material {
  readonly alphaMap?: Texture | null;
  readonly color?: Color;
  readonly map?: Texture | null;
}

export function createUnlitMaterial(
  source: Material,
  color?: number,
): MeshBasicMaterial {
  const authored = source as MaterialWithMaps;
  const usesAlphaCutout = source.transparent || source.alphaTest > 0;

  return new MeshBasicMaterial({
    name: `${source.name || "gltf-material"}-unlit`,
    color: color ?? authored.color?.getHex() ?? 0xffffff,
    map: color === undefined ? (authored.map ?? null) : null,
    alphaMap: authored.alphaMap ?? null,
    alphaTest: usesAlphaCutout ? Math.max(source.alphaTest, 0.5) : 0,
    side: source.side,
    vertexColors: source.vertexColors,
    transparent: false,
    depthWrite: true,
  });
}
