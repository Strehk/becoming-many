/**
 * Purpose: Give the grass vertex shader the ground height and grass cover of this world.
 * Context: The source demo read an analytical terrain; this world's surface is noise-based.
 * Responsibility: Own a camera-following height texture, its encoding, and its refills.
 * Boundary: Blade shape, layout, and lifecycle stay elsewhere; the surface itself is queried.
 */

import type { Texture } from "three";
import {
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RGFormat,
  Vector2,
  Vector4,
} from "three";
import { getElevationRange } from "../../world-surface/height-field";
import type { WorldSurfaceSettings } from "../../world-surface/surface-settings";
import type { WorldSurface } from "../../world-surface/world-surface";
import { GRASS_CLIPMAP_SETTINGS } from "./grass-clipmap-settings";

/**
 * Why a texture at all. The source demo derives every blade from a hash of its
 * world position and reads the ground from an analytical sine sum, so nothing
 * per blade ever leaves memory. This world's ground is `getGroundY`: four
 * Perlin lookups against a permutation table plus a carved river. Ported to
 * GLSL that would be roughly 160 table reads with a dynamic index per vertex,
 * which the target device cannot pay.
 *
 * So the height arrives sampled instead. The texel grid is Terrain's own
 * vertex spacing, which means the samples are the same points the terrain mesh
 * is built from — the grass follows the surface the viewer actually sees,
 * closer than an approximate analytical function would. The second channel
 * carries how much grass its zone allows, so one fetch answers both questions.
 */
export interface GrassHeightField {
  readonly texture: Texture;
  /** World XZ of the centre of texel zero, and the metres one texel spans. */
  readonly placement: Vector4;
  /** Lowest ground height and the span the normalized channel covers. */
  readonly range: Vector2;
  /** True once the camera has left the window's safe radius. */
  readonly needsRecenter: (cameraX: number, cameraZ: number) => boolean;
  /** Fill the next rows of the pending window; true once the window is done. */
  readonly fillNextRows: () => boolean;
  /** Start a refill centred on the camera, discarding any pending one. */
  readonly beginRecenter: (cameraX: number, cameraZ: number) => void;
  readonly dispose: () => void;
}

interface HeightFieldState {
  /** World XZ of the centre of texel zero for the window being filled. */
  pendingOriginX: number;
  pendingOriginZ: number;
  nextRow: number;
}

export interface GrassHeightFieldOptions {
  readonly worldSurface: WorldSurface;
  readonly surfaceSettings: WorldSurfaceSettings;
  readonly cameraX: number;
  readonly cameraZ: number;
}

export function createGrassHeightField(
  options: GrassHeightFieldOptions,
): GrassHeightField {
  const settings = GRASS_CLIPMAP_SETTINGS.heightField;
  const size = settings.sizeTexels;
  const data = new Uint16Array(size * size * 2);
  const texture = new DataTexture(data, size, size, RGFormat, HalfFloatType);
  // Linear so the blade root moves smoothly between samples instead of
  // stepping from texel to texel; no mipmaps, the vertex stage samples level
  // zero and a reduced height field would flatten hills.
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;

  const elevation = getElevationRange(options.surfaceSettings);
  const range = new Vector2(
    elevation.minimumElevation,
    Math.max(elevation.maximumElevation - elevation.minimumElevation, 1),
  );
  const placement = new Vector4(0, 0, settings.texelMeters, size);
  const state: HeightFieldState = {
    pendingOriginX: 0,
    pendingOriginZ: 0,
    nextRow: 0,
  };

  const beginRecenter = (cameraX: number, cameraZ: number): void => {
    // Snap the window to its own texel grid, so a refill never shifts the
    // sample points and the ground cannot ripple as the camera walks.
    const half = ((size - 1) / 2) * settings.texelMeters;
    state.pendingOriginX =
      Math.round((cameraX - half) / settings.texelMeters) *
      settings.texelMeters;
    state.pendingOriginZ =
      Math.round((cameraZ - half) / settings.texelMeters) *
      settings.texelMeters;
    state.nextRow = 0;
  };

  const fillNextRows = (): boolean => {
    const lastRow = Math.min(size, state.nextRow + settings.rowsPerStep);
    for (let row = state.nextRow; row < lastRow; row++) {
      fillRow(row, data, state, range, options);
    }
    state.nextRow = lastRow;
    if (state.nextRow < size) return false;

    // The window only becomes the published one once it is complete: swapping
    // mid-fill would show blades rooted half in the old window.
    placement.x = state.pendingOriginX;
    placement.y = state.pendingOriginZ;
    texture.needsUpdate = true;
    return true;
  };

  beginRecenter(options.cameraX, options.cameraZ);
  while (!fillNextRows()) {
    // The first window must be complete before the first frame; a partly
    // filled one would root the whole field at the lowest elevation.
  }

  return {
    texture,
    placement,
    range,
    needsRecenter: (cameraX, cameraZ) => {
      const half = ((size - 1) / 2) * settings.texelMeters;
      const centreX = placement.x + half;
      const centreZ = placement.y + half;
      return (
        Math.abs(cameraX - centreX) > settings.recenterMeters ||
        Math.abs(cameraZ - centreZ) > settings.recenterMeters
      );
    },
    fillNextRows,
    beginRecenter,
    dispose: () => texture.dispose(),
  };
}

function fillRow(
  row: number,
  data: Uint16Array,
  state: HeightFieldState,
  range: Vector2,
  options: GrassHeightFieldOptions,
): void {
  const settings = GRASS_CLIPMAP_SETTINGS.heightField;
  const size = settings.sizeTexels;
  const worldZ = state.pendingOriginZ + row * settings.texelMeters;

  for (let column = 0; column < size; column++) {
    const worldX = state.pendingOriginX + column * settings.texelMeters;
    const groundY = options.worldSurface.groundYAt(worldX, worldZ);
    const normalizedHeight = (groundY - range.x) / range.y;
    const index = (row * size + column) * 2;
    data[index] = DataUtils.toHalfFloat(normalizedHeight);
    data[index + 1] = DataUtils.toHalfFloat(
      getGrassZoneCoverage(options.worldSurface, worldX, worldZ),
    );
  }
}

/**
 * Zones the world does not grow grass in stay bare, water and forest first.
 * Published because other modules have to know where the ground is covered —
 * deriving it from the zone thresholds a second time would fork the answer.
 */
export function getGrassZoneCoverage(
  worldSurface: WorldSurface,
  worldX: number,
  worldZ: number,
): number {
  const zone = worldSurface.zoneAt(worldX, worldZ);
  const coverage: Partial<Record<string, number>> =
    GRASS_CLIPMAP_SETTINGS.zoneCoverage;

  return coverage[zone] ?? 0;
}
