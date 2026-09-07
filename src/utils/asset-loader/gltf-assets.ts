/**
 * Purpose: Load and release small explicit sets of glTF runtime assets.
 * Context: Level Runtime preloads only the models required by the selected level.
 * Responsibility: Deduplicate URLs, use Three.js GLTFLoader, and dispose shared resources once.
 * Boundary: Asset selection, mesh extraction, placement, and module lifecycle stay elsewhere.
 */

import {
  type BufferGeometry,
  type Material,
  Mesh,
  type Skeleton,
  SkinnedMesh,
  Texture,
} from "three";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface GltfAssetRequest {
  readonly id: string;
  readonly url: string;
}

export type GltfAssets = ReadonlyMap<string, GLTF>;

/** Load every distinct URL once and expose the result through authored IDs. */
export async function loadGltfAssets(
  requests: readonly GltfAssetRequest[],
  signal?: AbortSignal,
): Promise<GltfAssets> {
  validateUniqueAssetIds(requests);

  signal?.throwIfAborted();
  const loader = new GLTFLoader();
  const urls = [...new Set(requests.map(({ url }) => url))];
  const loaded = await Promise.allSettled(
    urls.map((url) => loader.loadAsync(url)),
  );
  const assetsByUrl = new Map<string, GLTF>();
  for (const [index, result] of loaded.entries()) {
    if (result.status === "fulfilled")
      assetsByUrl.set(urls[index] as string, result.value);
  }
  const failure = loaded.find((result) => result.status === "rejected");
  if (failure || signal?.aborted) {
    const error: unknown = failure?.reason ?? signal?.reason;
    try {
      disposeGltfAssets(assetsByUrl);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "GLTF loading and cleanup failed",
      );
    }
    throw error;
  }

  return new Map(
    requests.map(({ id, url }) => {
      const asset = assetsByUrl.get(url);
      if (!asset) throw new Error(`GLTF asset did not load: ${url}`);
      return [id, asset] as const;
    }),
  );
}

/** Dispose resources once even when several authored IDs share one source GLB. */
export function disposeGltfAssets(assets: GltfAssets): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  const images = new Set<ImageBitmap>();
  const scenes = new Set(
    [...assets.values()].flatMap(({ scene, scenes }) => [scene, ...scenes]),
  );

  for (const scene of scenes) {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of objectMaterials)
        collectMaterial(material, materials, textures);

      if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
    });
  }

  for (const texture of textures) {
    if (
      typeof ImageBitmap !== "undefined" &&
      texture.source.data instanceof ImageBitmap
    )
      images.add(texture.source.data);
  }
  const errors: unknown[] = [];
  for (const resource of [
    ...geometries,
    ...materials,
    ...skeletons,
    ...textures,
  ]) {
    try {
      resource.dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  for (const image of images) {
    try {
      image.close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, "GLTF cleanup failed");
}

function validateUniqueAssetIds(requests: readonly GltfAssetRequest[]): void {
  const ids = new Set<string>();

  for (const { id } of requests) {
    if (ids.has(id)) throw new Error(`Duplicate GLTF asset id: ${id}`);
    ids.add(id);
  }
}

function collectMaterial(
  material: Material,
  materials: Set<Material>,
  textures: Set<Texture>,
): void {
  materials.add(material);

  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
}
