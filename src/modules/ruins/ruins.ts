/**
 * Purpose: Stand the ruined temples the open meadows carry.
 * Context: A landmark is rare, large, and refused far more often than it is placed.
 * Responsibility: Own the cell window, the ground test, the instanced pool, and cleanup.
 * Boundary: What a ruin looks like is its model; which ground carries one is the definition.
 */

import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Quaternion,
  type Scene,
  Vector3,
} from "three";
import {
  disposeGltfAssets,
  type GltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import {
  createStaticModelAsset,
  disposeStaticModelAsset,
  type StaticModelAsset,
} from "../../utils/asset-loader/static-model";
import { getCellRandom } from "../../world/chunk-candidates";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import { RUINS_DEFINITION } from "./ruins-definition";

/**
 * Fixed random channels, so every drawn value keeps its own hash stream. Each
 * candidate of a cell takes the next block of them, which is what keeps two
 * candidates of one cell from landing on the same spot.
 */
const RANDOM_VALUES_PER_CANDIDATE = 5;
const RANDOM_OFFSET_X = 0;
const RANDOM_OFFSET_Z = 1;
const RANDOM_HEIGHT = 2;
const RANDOM_YAW = 3;
const RANDOM_STANDS = 4;

const UP = new Vector3(0, 1, 0);

export interface RuinsPreset {
  /**
   * How many of the cells that could carry a ruin actually do, 0..1. The
   * ground test refuses most of them anyway; this is what decides whether a
   * flight meets a temple often or once.
   */
  readonly standingShare: number;
  /** Stone tone. Like every surface, the senses recolour it from here. */
  readonly color: number;
}

export interface RuinsModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: RuinsPreset;
  readonly assets: GltfAssets;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

interface RuinsStream {
  readonly chunkWindow: ChunkWindow;
  readonly mesh: InstancedMesh;
  readonly model: StaticModelAsset;
  /**
   * The cell each slot currently stands for. The window reports what changed;
   * the pool is rewritten whole, because a window this coarse holds only a
   * handful of cells and every one of them may have refused its ruin.
   */
  readonly cells: (ChunkAssignment | undefined)[];
}

interface RuinsState {
  currentStream: RuinsStream | undefined;
}

/**
 * One `InstancedMesh` holds every ruin the window can carry. A cell offers one
 * candidate and the ground answers: only meadow that stays level under the
 * whole footprint stands one up, so a placed ruin is where the landscape
 * already had room for it.
 */
export function createRuinsModule(options: RuinsModuleOptions): WorldModule {
  const state: RuinsState = { currentStream: undefined };

  return {
    load: () => loadRuins(state, options),
    activate: () => setRuinsVisible(state, true),
    update: () => updateRuins(state, options),
    deactivate: () => setRuinsVisible(state, false),
    unload: () => unloadRuins(state, options),
  };
}

function loadRuins(state: RuinsState, options: RuinsModuleOptions): void {
  const gltf = options.assets.get(RUINS_DEFINITION.asset.id);
  if (!gltf) throw new Error("The ruin model was not loaded");

  const model = createStaticModelAsset(
    gltf,
    RUINS_DEFINITION.asset.objectName,
    () => options.preset.color,
  );
  const part = model.parts[0];
  if (!part || model.parts.length !== 1) {
    throw new Error("The ruin model must be one merged part");
  }

  const chunkSize = getChunkSize(RUINS_DEFINITION.chunkLevel);
  const radius = Math.max(
    1,
    Math.ceil(options.viewpoint.viewDistanceMeters / chunkSize),
  );
  const chunkWindow = new ChunkWindow({
    level: RUINS_DEFINITION.chunkLevel,
    radius,
  });

  const geometry = part.geometry.clone().applyMatrix4(part.sourceMatrix);
  const material = Array.isArray(part.material)
    ? part.material[0]
    : part.material;
  if (!material) throw new Error("The ruin model carries no material");
  applyMaterialEffects(options.effects ?? [], material);

  const mesh = new InstancedMesh(
    geometry,
    material,
    chunkWindow.slotCount * RUINS_DEFINITION.candidatesPerCell,
  );
  mesh.name = "Ruins";
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  mesh.visible = false;
  options.scene.add(mesh);

  const cells: (ChunkAssignment | undefined)[] = Array.from(
    { length: chunkWindow.slotCount },
    () => undefined,
  );
  const stream: RuinsStream = { chunkWindow, mesh, model, cells };
  state.currentStream = stream;

  rememberCells(
    stream,
    chunkWindow.update(
      options.viewpoint.worldPosition.x,
      options.viewpoint.worldPosition.z,
    ),
  );
  placeRuins(stream, options);
}

function updateRuins(state: RuinsState, options: RuinsModuleOptions): void {
  const stream = state.currentStream;
  if (!stream) return;

  const changed = stream.chunkWindow.update(
    options.viewpoint.worldPosition.x,
    options.viewpoint.worldPosition.z,
  );
  if (changed.length === 0) return;

  // Most frames cross no cell boundary at all, and a crossing moves one edge
  // of a 128-metre grid: the whole window is rewritten because there are only
  // ever a handful of ruins in it.
  rememberCells(stream, changed);
  placeRuins(stream, options);
}

/**
 * Rewrite every standing ruin of the window, compacted to the front of the
 * pool so a refused cell costs no draw at all.
 */
function placeRuins(stream: RuinsStream, options: RuinsModuleOptions): void {
  const chunkSize = stream.chunkWindow.chunkSize;
  const placement = new Matrix4();
  const position = new Vector3();
  const facing = new Quaternion();
  const scale = new Vector3();
  let standing = 0;

  for (const cell of stream.cells) {
    if (!cell) continue;

    for (
      let candidate = 0;
      candidate < RUINS_DEFINITION.candidatesPerCell;
      candidate += 1
    ) {
      const channel = candidate * RANDOM_VALUES_PER_CANDIDATE;
      const draw = (valueIndex: number): number =>
        getCellRandom(
          RUINS_DEFINITION.seed,
          cell.chunkX,
          cell.chunkZ,
          channel + valueIndex,
        );
      if (draw(RANDOM_STANDS) >= options.preset.standingShare) continue;

      const worldX = cell.originX + draw(RANDOM_OFFSET_X) * chunkSize;
      const worldZ = cell.originZ + draw(RANDOM_OFFSET_Z) * chunkSize;
      const ground = readStandingGround(worldX, worldZ, options.worldSurface);
      if (ground === undefined) continue;

      const { minimum, maximum } = RUINS_DEFINITION.heightMeters;
      const height = minimum + draw(RANDOM_HEIGHT) * (maximum - minimum);
      const modelScale = height / stream.model.height;

      position.set(worldX, ground - stream.model.minimumY * modelScale, worldZ);
      facing.setFromAxisAngle(UP, draw(RANDOM_YAW) * Math.PI * 2);
      scale.setScalar(modelScale);
      placement.compose(position, facing, scale);
      stream.mesh.setMatrixAt(standing, placement);
      standing += 1;
    }
  }

  stream.mesh.count = standing;
  stream.mesh.instanceMatrix.needsUpdate = true;
  // The pool follows the traveller across an endless landscape, so its bounds
  // are only ever as current as the last placement.
  stream.mesh.computeBoundingSphere();
}

/** Keep the window's own view of which cell each slot stands for. */
function rememberCells(
  stream: RuinsStream,
  changed: readonly ChunkAssignment[],
): void {
  for (const assignment of changed) {
    stream.cells[assignment.slotIndex] = assignment;
  }
}

/**
 * The height a ruin would stand at, or nothing when this ground refuses one:
 * the centre and the four corners of the footprint must all be meadow, and
 * the fall between them must stay within what a stepped platform can carry.
 */
function readStandingGround(
  worldX: number,
  worldZ: number,
  worldSurface: WorldSurface,
): number | undefined {
  const reach = RUINS_DEFINITION.footprintRadiusMeters;
  const corners: readonly (readonly [number, number])[] = [
    [0, 0],
    [-reach, -reach],
    [reach, -reach],
    [-reach, reach],
    [reach, reach],
  ];

  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (const [offsetX, offsetZ] of corners) {
    const cornerX = worldX + offsetX;
    const cornerZ = worldZ + offsetZ;
    if (!RUINS_DEFINITION.zones.includes(worldSurface.zoneAt(cornerX, cornerZ)))
      return undefined;

    const cornerY = worldSurface.groundYAt(cornerX, cornerZ);
    lowest = Math.min(lowest, cornerY);
    highest = Math.max(highest, cornerY);
  }
  if (highest - lowest > RUINS_DEFINITION.maximumGroundFallMeters)
    return undefined;

  // Founded on the lowest corner: a platform is dug in, never floating.
  return lowest;
}

function setRuinsVisible(state: RuinsState, visible: boolean): void {
  if (state.currentStream) state.currentStream.mesh.visible = visible;
}

function unloadRuins(state: RuinsState, options: RuinsModuleOptions): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.currentStream = undefined;
  options.scene.remove(stream.mesh);
  stream.mesh.dispose();
  stream.mesh.geometry.dispose();
  disposeStaticModelAsset(stream.model);
  disposeGltfAssets(options.assets);
}
