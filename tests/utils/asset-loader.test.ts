/**
 * Purpose: Verify the GLTF-to-instancing boundary with realistic scene structure.
 * Context: Production models often expose a named Group containing several Mesh children.
 * Responsibility: Prevent partial models and startup failures from narrow mesh assumptions.
 * Boundary: Network loading and browser rendering are covered by runtime acceptance.
 */

import { expect, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ANIMALS_DEFINITION } from "../../src/modules/animals/animals-definition";
import { ROCKS_DEFINITION } from "../../src/modules/rocks/rocks-definition";
import { VEGETATION_DEFINITION } from "../../src/modules/vegetation/vegetation-definition";
import { disposeGltfAssets } from "../../src/utils/asset-loader/gltf-assets";
import {
  createStaticModelAsset,
  disposeStaticModelAsset,
} from "../../src/utils/asset-loader/static-model";

test("extracts every Mesh below a named GLTF Group", () => {
  const scene = new Group();
  const model = new Group();
  model.name = "CompleteModel";
  model.position.x = 10;
  model.add(createMesh("first", 0), createMesh("second", 2));
  scene.add(model);

  const asset = createStaticModelAsset(createGltf(scene), model.name);

  expect(asset.parts).toHaveLength(2);
  expect(asset.parts[0]?.sourceMatrix.elements[12]).toBe(0);
  expect(asset.parts[1]?.sourceMatrix.elements[12]).toBe(2);
  expect(asset.minimumY).toBe(-0.5);
  expect(asset.footprintRadius).toBeCloseTo(Math.hypot(2.5, 0.5));
  disposeStaticModelAsset(asset);
});

test("also accepts a named Mesh as a complete one-part model", () => {
  const scene = new Group();
  const mesh = createMesh("SingleMesh", 0);
  scene.add(mesh);

  const asset = createStaticModelAsset(createGltf(scene), mesh.name);

  expect(asset.parts).toHaveLength(1);
  disposeStaticModelAsset(asset);
});

test("removes model position while preserving root rotation and scale", () => {
  const scene = new Group();
  const model = new Group();
  model.name = "RotatedModel";
  model.position.set(20, 5, -10);
  model.rotation.x = -Math.PI / 2;
  model.scale.setScalar(2);
  model.add(new Mesh(new BoxGeometry(1, 2, 4), new MeshStandardMaterial()));
  scene.add(model);

  const asset = createStaticModelAsset(createGltf(scene), model.name);

  expect(asset.height).toBeCloseTo(8);
  expect(asset.minimumY).toBeCloseTo(-4);
  expect(asset.parts[0]?.sourceMatrix.elements[13]).toBeCloseTo(0);
  disposeStaticModelAsset(asset);
});

test("rejects missing and empty GLTF objects with explicit errors", () => {
  const scene = new Group();
  const empty = new Group();
  empty.name = "EmptyGroup";
  scene.add(empty);
  const gltf = createGltf(scene);

  expect(() => createStaticModelAsset(gltf, "Missing")).toThrow(
    "GLTF object not found: Missing",
  );
  expect(() => createStaticModelAsset(gltf, empty.name)).toThrow(
    "GLTF object contains no meshes: EmptyGroup",
  );
});

test("every configured production model resolves to complete mesh parts", async () => {
  const settings = [
    ...VEGETATION_DEFINITION.assets,
    ...ROCKS_DEFINITION.assets,
  ];

  for (const configuredAsset of settings) {
    const gltf = await loadPublicGltf(configuredAsset.url);
    const asset = createStaticModelAsset(gltf, configuredAsset.objectName);
    expect(asset.parts.length).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
    expect(asset.footprintRadius).toBeGreaterThan(0);
    disposeStaticModelAsset(asset);
    disposeGltfAssets(new Map([[configuredAsset.id, gltf]]));
  }
});

test("every configured production animal contains its walk animation", async () => {
  for (const species of ANIMALS_DEFINITION.species) {
    const gltf = await loadPublicGltf(species.url);
    expect(
      gltf.animations.some(({ name }) => name === species.walkAnimation),
    ).toBe(true);
    disposeGltfAssets(new Map([[species.id, gltf]]));
  }
});

function createMesh(name: string, x: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.name = name;
  mesh.position.x = x;
  return mesh;
}

function createGltf(scene: Group): GLTF {
  return {
    animations: [],
    asset: {},
    cameras: [],
    parser: {} as GLTF["parser"],
    scene,
    scenes: [scene],
    userData: {},
  };
}

async function loadPublicGltf(url: string): Promise<GLTF> {
  const data = await Bun.file(`public${url}`).arrayBuffer();
  return new GLTFLoader().parseAsync(data, "");
}
