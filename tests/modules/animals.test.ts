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
  Scene,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createAnimalSurfaceAlignment } from "../../src/modules/animals/animal-surface-orientation";
import {
  type AnimalBody,
  createAnimalsModule,
} from "../../src/modules/animals/animals";
import type { AnimalsDefinition } from "../../src/modules/animals/animals-definition";
import type { GltfAssets } from "../../src/utils/asset-loader/gltf-assets";
import type { SensedMaterial } from "../../src/utils/asset-loader/material-effect";
import type { Viewpoint } from "../../src/world/viewer-rig";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

// These modules never read the view distance; the value only completes the
// contract. It matches the Three.js default far plane.
const DEFAULT_VIEW_DISTANCE_METERS = 2_000;
const ANGLE_TOLERANCE_RADIANS = 1e-10;
const EXPECTED_TURN_SPEED_RADIANS_PER_SECOND = 2.2;
const POSITION_TOLERANCE_METERS = 1e-6;

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
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const { module } = createAnimalsModule({
    scene,
    viewpoint,
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
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const decoratedMaterials: SensedMaterial[] = [];
  const bodyMatrices: Matrix4[] = [];
  const { module } = createAnimalsModule({
    scene,
    viewpoint,
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
      viewpoint: {
        worldPosition: new Vector3(),
        viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
      },
      definition: { ...DEFINITION, maxVisible: 5 },
      preset: PRESET,
      assets: createAnimalAssets(),
      worldSurface: createFlatSurface(),
    }),
  ).toThrow("Animal maxVisible must fit the configured population");
});

test("Animals occupy separate territories around the player", () => {
  const scene = new Scene();
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const { module } = createAnimalsModule({
    scene,
    viewpoint,
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

test("Animals turn continuously and independently of frame rate at habitat boundaries", () => {
  const thirtyFps = simulateBlockedBoundaryTurn(30);
  const ninetyFps = simulateBlockedBoundaryTurn(90);

  expect(thirtyFps.headingChangeRadians).toBeCloseTo(
    EXPECTED_TURN_SPEED_RADIANS_PER_SECOND,
    10,
  );
  expect(ninetyFps.headingChangeRadians).toBeCloseTo(
    thirtyFps.headingChangeRadians,
    10,
  );
  expect(thirtyFps.maximumStepRadians).toBeCloseTo(
    EXPECTED_TURN_SPEED_RADIANS_PER_SECOND / 30,
    10,
  );
  expect(ninetyFps.maximumStepRadians).toBeCloseTo(
    EXPECTED_TURN_SPEED_RADIANS_PER_SECOND / 90,
    10,
  );
  expect(thirtyFps.finalBody.x).toBeCloseTo(thirtyFps.initialBody.x, 10);
  expect(thirtyFps.finalBody.z).toBeCloseTo(thirtyFps.initialBody.z, 10);
  expect(ninetyFps.finalBody.x).toBeCloseTo(ninetyFps.initialBody.x, 10);
  expect(ninetyFps.finalBody.z).toBeCloseTo(ninetyFps.initialBody.z, 10);
  expect(thirtyFps.finalZone).toBe("meadow");
  expect(ninetyFps.finalZone).toBe("meadow");
});

test("Animals resume movement after turning toward an allowed zone", () => {
  const deltaSeconds = 1 / 60;
  const requiredTurnRadians =
    EXPECTED_TURN_SPEED_RADIANS_PER_SECOND * deltaSeconds * 2;
  let boundaryOrigin: Pick<AnimalBody, "x" | "z"> | undefined;
  let initialHeadingRadians: number | undefined;
  const worldSurface: WorldSurface = {
    ...createFlatSurface(),
    zoneAt: (worldX, worldZ) => {
      if (!boundaryOrigin || initialHeadingRadians === undefined) {
        return "meadow";
      }

      const offsetX = worldX - boundaryOrigin.x;
      const offsetZ = worldZ - boundaryOrigin.z;
      if (Math.hypot(offsetX, offsetZ) <= POSITION_TOLERANCE_METERS) {
        return "meadow";
      }

      const candidateHeadingRadians = Math.atan2(offsetX, offsetZ);
      const turnRadians = Math.atan2(
        Math.sin(candidateHeadingRadians - initialHeadingRadians),
        Math.cos(candidateHeadingRadians - initialHeadingRadians),
      );
      return turnRadians >= requiredTurnRadians - ANGLE_TOLERANCE_RADIANS
        ? "meadow"
        : "water";
    },
  };
  const { bodies, module } = createSingleAnimalHarness(worldSurface);
  const initialBody = getLatestAnimalBody(bodies);
  boundaryOrigin = initialBody;
  initialHeadingRadians = initialBody.headingRadians;

  module.update?.(deltaSeconds);
  module.update?.(deltaSeconds);
  const turnedBody = getLatestAnimalBody(bodies);
  expect(turnedBody.x).toBeCloseTo(initialBody.x, 10);
  expect(turnedBody.z).toBeCloseTo(initialBody.z, 10);
  expect(turnedBody.headingRadians - initialBody.headingRadians).toBeCloseTo(
    requiredTurnRadians,
    10,
  );

  module.update?.(deltaSeconds);
  const movingBody = getLatestAnimalBody(bodies);
  expect(
    Math.hypot(movingBody.x - initialBody.x, movingBody.z - initialBody.z),
  ).toBeGreaterThan(0);
  expect(movingBody.headingRadians).toBeCloseTo(turnedBody.headingRadians, 10);
  expect(worldSurface.zoneAt(movingBody.x, movingBody.z)).toBe("meadow");
  module.unload();
});

test("Animals expose the visible actor positions within their budget", () => {
  const scene = new Scene();
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const handle = createAnimalsModule({
    scene,
    viewpoint,
    definition: DEFINITION,
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface: createFlatSurface(),
  });

  expect(handle.getVisibleWorldPositions()).toHaveLength(0);

  handle.module.load();
  handle.module.activate();
  handle.module.update?.(0.25);

  const positions = handle.getVisibleWorldPositions();
  expect(positions.length / 3).toBeLessThanOrEqual(DEFINITION.maxVisible);
  expect(positions).toHaveLength(3);

  const population = scene.children[0];
  if (!(population instanceof Group)) throw new Error("Expected animal Group");
  const visibleActor = population.children.find(({ visible }) => visible);
  if (!visibleActor) throw new Error("Expected one visible actor");
  // The packed buffer stores 32-bit floats of the 64-bit actor positions.
  expect(positions[0] ?? 0).toBeCloseTo(visibleActor.position.x, 4);
  expect(positions[1] ?? 0).toBeCloseTo(visibleActor.position.y, 4);
  expect(positions[2] ?? 0).toBeCloseTo(visibleActor.position.z, 4);

  handle.module.deactivate();
  handle.module.update?.(0.25);
  expect(handle.getVisibleWorldPositions()).toHaveLength(3);
  handle.module.unload();
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

function createSingleAnimalHarness(worldSurface: WorldSurface) {
  const bodies: AnimalBody[] = [];
  const handle = createAnimalsModule({
    scene: new Scene(),
    viewpoint: {
      worldPosition: new Vector3(),
      viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
    },
    definition: {
      ...DEFINITION,
      species: [{ ...createSpecies("deer"), count: 1 }],
    },
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface,
    onBodiesUpdated: (visibleBodies) => {
      const body = visibleBodies[0];
      if (!body) throw new Error("Expected one visible animal body");
      bodies.push({ ...body });
    },
  });

  handle.module.load();
  handle.module.activate();
  handle.module.update?.(0);
  return { bodies, module: handle.module };
}

function simulateBlockedBoundaryTurn(updateCount: number) {
  let boundaryOrigin: Pick<AnimalBody, "x" | "z"> | undefined;
  const worldSurface: WorldSurface = {
    ...createFlatSurface(),
    zoneAt: (worldX, worldZ) => {
      if (!boundaryOrigin) return "meadow";
      const distanceFromOrigin = Math.hypot(
        worldX - boundaryOrigin.x,
        worldZ - boundaryOrigin.z,
      );
      return distanceFromOrigin <= POSITION_TOLERANCE_METERS
        ? "meadow"
        : "water";
    },
  };
  const { bodies, module } = createSingleAnimalHarness(worldSurface);
  const initialBody = getLatestAnimalBody(bodies);
  boundaryOrigin = initialBody;

  const deltaSeconds = 1 / updateCount;
  for (let updateIndex = 0; updateIndex < updateCount; updateIndex++) {
    module.update?.(deltaSeconds);
  }

  const finalBody = getLatestAnimalBody(bodies);
  const maximumStepRadians = bodies.reduce((maximumStep, body, index) => {
    const previousBody = bodies[index - 1];
    if (!previousBody) return maximumStep;
    return Math.max(
      maximumStep,
      body.headingRadians - previousBody.headingRadians,
    );
  }, 0);
  const finalZone = worldSurface.zoneAt(finalBody.x, finalBody.z);
  module.unload();

  return {
    initialBody,
    finalBody,
    finalZone,
    headingChangeRadians: finalBody.headingRadians - initialBody.headingRadians,
    maximumStepRadians,
  };
}

function getLatestAnimalBody(bodies: readonly AnimalBody[]): AnimalBody {
  const body = bodies.at(-1);
  if (!body) throw new Error("Expected an observed animal body");
  return body;
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
