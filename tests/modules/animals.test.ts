/**
 * Purpose: Verify the bounded Animals lifecycle and zone-dependent visibility.
 * Context: Animated models are expensive and must remain a small optional population.
 * Responsibility: Cover loading, visibility limits, movement, and cleanup.
 * Boundary: Real model fidelity and animation timing require browser acceptance.
 */

import { expect, test } from "bun:test";
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createAnimalSurfaceAlignment } from "../../src/modules/animals/animal-surface-orientation";
import { createAnimalsModule } from "../../src/modules/animals/animals";
import type { AnimalsDefinition } from "../../src/modules/animals/animals-definition";
import type { GltfAssets } from "../../src/utils/asset-loader/gltf-assets";
import type { SensedMaterial } from "../../src/utils/asset-loader/material-effect";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

const LAND_ZONES: readonly ZoneId[] = [
  "meadow",
  "coniferForest",
  "deciduousForest",
  "shrubSlope",
];

const DEFINITION: AnimalsDefinition = {
  seed: 7,
  maxVisible: 1,
  activeRadiusMeters: 96,
  species: [createSpecies("deer"), createSpecies("fox")],
};

const PRESET = {
  colors: {
    furColor: 0x886644,
    lightFurColor: 0xccaa88,
    darkFurColor: 0x443322,
    featureColor: 0x111111,
  },
} as const;

test("Animals animate only the nearest bounded population", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const module = createAnimalsModule({
    scene,
    camera,
    definition: DEFINITION,
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface: createFlatSurface(),
  });

  module.load();
  module.activate();
  module.update?.(0.25);

  const population = scene.children[0];
  if (!(population instanceof Group)) throw new Error("Expected animal Group");
  expect(population.children).toHaveLength(4);
  expect(population.children.filter(({ visible }) => visible)).toHaveLength(1);

  module.deactivate();
  expect(population.visible).toBe(false);
  module.unload();
  expect(scene.children).toHaveLength(0);
});

test("Animals decorate every actor material with supplied effects", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const decoratedMaterials: SensedMaterial[] = [];
  const bodyMatrices: Matrix4[] = [];
  const module = createAnimalsModule({
    scene,
    camera,
    definition: DEFINITION,
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface: createFlatSurface(),
    effectsFor: (bodyMatrix) => {
      bodyMatrices.push(bodyMatrix);
      return [
        {
          applyTo: (material: SensedMaterial) => {
            decoratedMaterials.push(material);
          },
        },
      ];
    },
  });

  module.load();

  // Two species with two actors each and one material per cloned model.
  expect(decoratedMaterials).toHaveLength(4);
  // Every decorated mesh is handed the route into its own body space.
  expect(bodyMatrices).toHaveLength(4);
  expect(bodyMatrices.every((matrix) => matrix instanceof Matrix4)).toBe(true);
  expect(
    decoratedMaterials.every(
      (material) => material instanceof MeshBasicMaterial,
    ),
  ).toBe(true);
  module.unload();
});

test("Animals reject an impossible visibility budget", () => {
  expect(() =>
    createAnimalsModule({
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      definition: { ...DEFINITION, maxVisible: 5 },
      preset: PRESET,
      assets: createAnimalAssets(),
      worldSurface: createFlatSurface(),
    }),
  ).toThrow("Animal maxVisible must fit the configured population");
});

test("Animals occupy separate territories around the player", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const module = createAnimalsModule({
    scene,
    camera,
    definition: {
      ...DEFINITION,
      maxVisible: 4,
      species: [
        {
          ...createSpecies("deer"),
          count: 4,
          allowedZones: LAND_ZONES,
        },
      ],
    },
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface: createDirectionalSurface(),
  });

  module.load();
  module.activate();
  module.update?.(0);

  const population = scene.children[0];
  if (!(population instanceof Group)) throw new Error("Expected animal Group");
  const occupiedDirections = population.children.map(({ position }) =>
    getDirectionIndex(position.x, position.z),
  );
  const occupiedZones = population.children.map(
    ({ position }) => LAND_ZONES[getDirectionIndex(position.x, position.z)],
  );

  expect(new Set(occupiedDirections).size).toBe(4);
  expect(new Set(occupiedZones).size).toBe(4);
  expect(population.children.every(({ visible }) => visible)).toBe(true);
  module.unload();
});

test("Animals align their up axis with the local surface slope", () => {
  const actor = new Group();
  const expectedSurfaceNormal = new Vector3(0, 1, -0.5).normalize();
  const expectedSurfaceForward = new Vector3(0, 0, 1)
    .projectOnPlane(expectedSurfaceNormal)
    .normalize();

  createAnimalSurfaceAlignment(createSlopedSurface())(actor, 0);
  const actorUp = new Vector3(0, 1, 0).applyQuaternion(actor.quaternion);
  const actorForward = new Vector3(0, 0, 1).applyQuaternion(actor.quaternion);

  expect(actorUp.dot(expectedSurfaceNormal)).toBeGreaterThan(0.999);
  expect(actorForward.dot(expectedSurfaceForward)).toBeGreaterThan(0.999);
});

function createSpecies(id: string) {
  return {
    id,
    url: `/animals/${id}.glb`,
    count: 2,
    heightMeters: 1,
    speedMetersPerSecond: 1,
    allowedZones: ["meadow"],
    walkAnimation: "Walk",
  } as const;
}

function createAnimalAssets(): GltfAssets {
  return new Map([
    ["deer", createAnimalGltf()],
    ["fox", createAnimalGltf()],
  ]);
}

function createAnimalGltf(): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  return {
    animations: [new AnimationClip("Walk", 1)],
    asset: {},
    cameras: [],
    parser: {} as GLTF["parser"],
    scene,
    scenes: [scene],
    userData: {},
  };
}

function createFlatSurface(): WorldSurface {
  return {
    groundYAt: () => 2,
    surfaceYAt: () => 2,
    zoneConditionsAt: () => ({
      riverChannelMarginMeters: -1,
      waterDepthMeters: -1,
      groundSlope: 0,
      forestRegionValue: 0,
    }),
    zoneAt: () => "meadow",
  };
}

function createDirectionalSurface(): WorldSurface {
  const zoneAt = (worldX: number, worldZ: number) =>
    LAND_ZONES[getDirectionIndex(worldX, worldZ)] ?? "meadow";

  return {
    ...createFlatSurface(),
    zoneAt,
  };
}

function createSlopedSurface(): WorldSurface {
  const surfaceYAt = (_worldX: number, worldZ: number) => worldZ * 0.5;

  return {
    ...createFlatSurface(),
    groundYAt: surfaceYAt,
    surfaceYAt,
  };
}

function getDirectionIndex(worldX: number, worldZ: number): number {
  const fullCircleRadians = Math.PI * 2;
  const angle = Math.atan2(worldX, worldZ);
  const positiveAngle = (angle + fullCircleRadians) % fullCircleRadians;
  return Math.floor((positiveAngle / fullCircleRadians) * 4);
}
