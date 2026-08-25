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
): Promise<GltfAssets> {
  validateUniqueAssetIds(requests);

  const loader = new GLTFLoader();
  const urls = [...new Set(requests.map(({ url }) => url))];
  const loadedEntries = await Promise.all(
    urls.map(async (url) => [url, await loader.loadAsync(url)] as const),
  );
  const assetsByUrl = new Map(loadedEntries);

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
  const scenes = new Set([...assets.values()].map(({ scene }) => scene));

  for (const scene of scenes) {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of objectMaterials)
        collectMaterial(material, materials, textures);

      if (object instanceof SkinnedMesh) object.skeleton.dispose();
    });
  }

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
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
