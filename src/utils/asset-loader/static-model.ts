/**
 * Purpose: Convert one named glTF object into opaque unlit instancing sources.
 * Context: A tree or rock may be one Mesh or a Group containing several Mesh children.
 * Responsibility: Preserve every mesh part, its authored transform, and the model bounds.
 * Boundary: Loading, instance placement, capacity, and module lifecycle stay elsewhere.
 */

import {
  Box3,
  type BufferGeometry,
  type Material,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createUnlitMaterial } from "./unlit-material";

export type StaticModelColor = (
  material: Material,
  meshName: string,
) => number | undefined;

export interface StaticModelPart {
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicMaterial | MeshBasicMaterial[];
  readonly sourceMatrix: Matrix4;
}

export interface StaticModelAsset {
  readonly parts: readonly StaticModelPart[];
  readonly height: number;
  readonly minimumY: number;
  readonly footprintRadius: number;
}

/** Extract every Mesh below the configured object, including the object itself. */
export function createStaticModelAsset(
  gltf: GLTF,
  objectName: string,
  colorForMaterial?: StaticModelColor,
): StaticModelAsset {
  gltf.scene.updateMatrixWorld(true);
  const sourceObject = gltf.scene.getObjectByName(objectName);
  if (!sourceObject) throw new Error(`GLTF object not found: ${objectName}`);

  const parts: StaticModelPart[] = [];
  const modelBounds = new Box3();
  const worldToModel = createTranslationFreeModelTransform(
    sourceObject.matrixWorld,
  );
  sourceObject.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const sourceMatrix = worldToModel.clone().multiply(object.matrixWorld);
    parts.push(createModelPart(object, sourceMatrix, colorForMaterial));
    expandModelBounds(modelBounds, object.geometry, sourceMatrix);
  });
  if (parts.length === 0) {
    throw new Error(`GLTF object contains no meshes: ${objectName}`);
  }

  const height = modelBounds.max.y - modelBounds.min.y;
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error(`GLTF object has no measurable height: ${objectName}`);
  }
  return {
    parts,
    height,
    minimumY: modelBounds.min.y,
    footprintRadius: getFootprintRadius(modelBounds),
  };
}

/** Return a rotation-safe horizontal radius around the model origin. */
function getFootprintRadius(bounds: Box3): number {
  const furthestX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
  const furthestZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
  return Math.hypot(furthestX, furthestZ);
}

/**
 * Remove only the gallery position of a selected model.
 *
 * Asset packs often arrange models at different positions in one scene, while
 * their root rotation converts glTF coordinates into Three.js coordinates.
 * Cancelling the complete root transform would turn those models sideways.
 */
function createTranslationFreeModelTransform(sourceMatrix: Matrix4): Matrix4 {
  const rotation = new Quaternion();
  const scale = new Vector3();
  sourceMatrix.decompose(new Vector3(), rotation, scale);

  const modelOrientation = new Matrix4().compose(
    new Vector3(),
    rotation,
    scale,
  );
  return modelOrientation.multiply(sourceMatrix.clone().invert());
}

export function disposeStaticModelAsset(asset: StaticModelAsset): void {
  for (const part of asset.parts) disposeModelPart(part);
}

function createModelPart(
  sourceMesh: Mesh,
  sourceMatrix: Matrix4,
  colorForMaterial: StaticModelColor | undefined,
): StaticModelPart {
  const material = Array.isArray(sourceMesh.material)
    ? sourceMesh.material.map((source) =>
        createUnlitMaterial(
          source,
          colorForMaterial?.(source, sourceMesh.name),
        ),
      )
    : createUnlitMaterial(
        sourceMesh.material,
        colorForMaterial?.(sourceMesh.material, sourceMesh.name),
      );

  return {
    geometry: sourceMesh.geometry,
    material,
    sourceMatrix,
  };
}

function expandModelBounds(
  modelBounds: Box3,
  geometry: BufferGeometry,
  sourceMatrix: Matrix4,
): void {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  if (!geometry.boundingBox) return;
  modelBounds.union(geometry.boundingBox.clone().applyMatrix4(sourceMatrix));
}

function disposeModelPart(part: StaticModelPart): void {
  const materials = Array.isArray(part.material)
    ? part.material
    : [part.material];
  for (const material of materials) material.dispose();
}
