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
import { createAnimalsModule } from "../../src/modules/animals/animals";
import type { AnimalsDefinition } from "../../src/modules/animals/animals-definition";
import type { GltfAssets } from "../../src/utils/asset-loader/gltf-assets";
import type { SensedMaterial } from "../../src/utils/asset-loader/material-effect";
import type { Viewpoint } from "../../src/world/viewer-rig";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

// These modules never read the view distance; the value only completes the
// contract. It matches the Three.js default far plane.
const DEFAULT_VIEW_DISTANCE_METERS = 2_000;

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

const MEADOW_ISLAND_RADIUS_METERS = 25;
/* Long enough that the body meets the island edge and turns on it. */
const FRAME_RATE_PROBE_SECONDS = 60;
/*
 * Two frame rates stagger where a turn begins by up to a frame, never how
 * fast it is walked, so a minute of arcs ends this close and no further.
 */
const FRAME_RATE_HEADING_TOLERANCE_RADIANS = 0.05;
const FRAME_RATE_POSITION_TOLERANCE_METERS = 0.5;

const PRESET = {
  colors: {
    furColor: 0x886644,
    lightFurColor: 0xccaa88,
    darkFurColor: 0x443322,
    featureColor: 0x111111,
  },
} as const;

test("Animals fade in when they take a visible slot", () => {
  const scene = new Scene();
  const viewpoint: Viewpoint = {
    worldPosition: new Vector3(),
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
  const population = scene.children[0];
  if (!(population instanceof Group)) throw new Error("Expected animal Group");

  const arrival: number[] = [];
  for (let step = 0; step < 90; step += 1) {
    module.update?.(1 / 60);
    arrival.push(readVisibleOpacity(population));
  }

  // It arrives over time rather than between two frames, and it is drawn all
  // the way through: an actor that only appeared once it was solid would be
  // the pop this fade exists to remove.
  expect(arrival[0]).toBeLessThan(0.2);
  expect(arrival.at(-1)).toBe(1);
  expect(arrival.indexOf(1)).toBeGreaterThan(5);
  for (let frame = 1; frame < arrival.length; frame += 1) {
    expect(arrival[frame] ?? 0).toBeGreaterThanOrEqual(arrival[frame - 1] ?? 0);
  }

  // The materials stay transparent for the whole loaded lifetime, so the fade
  // never asks the patched shader to recompile.
  const transparency: boolean[] = [];
  population.traverse((object) => {
    if (object instanceof Mesh && !Array.isArray(object.material)) {
      transparency.push(object.material.transparent);
    }
  });
  expect(transparency).not.toHaveLength(0);
  expect(transparency.every((transparent) => transparent)).toBe(true);

  module.unload();
});

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
  // Long enough for the arrival fade to finish: an actor taking a visible
  // slot fades in rather than appearing complete in one frame.
  module.update?.(1);

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

  // Put away but still updated — the warming state a show holds a layer in
  // before its sense reveals it: the actors keep walking and give up their
  // visible slots, so nothing off screen is reported as visible.
  handle.module.deactivate();
  handle.module.update?.(0.25);
  expect(handle.getVisibleWorldPositions()).toHaveLength(0);
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

test("Animals lean onto an arc at a zone edge instead of pivoting", () => {
  const scene = new Scene();
  const viewpoint: Viewpoint = {
    worldPosition: new Vector3(),
    viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
  };
  const species = {
    ...createSpecies("deer"),
    count: 1,
    heightMeters: 1.4,
    speedMetersPerSecond: 0.65,
    allowedZones: ["meadow"] as const,
  };
  const headings: number[] = [];
  const bodyPath: { x: number; z: number }[] = [];
  const { module } = createAnimalsModule({
    scene,
    viewpoint,
    definition: {
      ...DEFINITION,
      maxVisible: 1,
      // Inside the island, so the actor is placed on ground it may stand on.
      activeRadiusMeters: MEADOW_ISLAND_RADIUS_METERS,
      species: [species],
    },
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface: createIslandSurface(MEADOW_ISLAND_RADIUS_METERS),
    onBodiesUpdated: (bodies) => {
      const body = bodies[0];
      if (!body) return;

      headings.push(body.headingRadians);
      bodyPath.push({ x: body.x, z: body.z });
    },
  });

  module.load();
  module.activate();
  const stepSeconds = 1 / 60;
  for (let step = 0; step < 7_200; step += 1) module.update?.(stepSeconds);

  // The turning circle is authored in body heights, so the fastest the
  // heading may move is the speed over that radius.
  const turnRateRadiansPerSecond =
    species.speedMetersPerSecond / (species.heightMeters * 2.5);
  const largestStep = turnRateRadiansPerSecond * stepSeconds * 1.0001;
  let turningFrames = 0;
  for (let frame = 1; frame < headings.length; frame += 1) {
    const change = Math.abs(
      Math.atan2(
        Math.sin((headings[frame] ?? 0) - (headings[frame - 1] ?? 0)),
        Math.cos((headings[frame] ?? 0) - (headings[frame - 1] ?? 0)),
      ),
    );
    expect(change).toBeLessThanOrEqual(largestStep);
    if (change > 0) turningFrames += 1;
  }

  // It has to have met the edge and turned there, and it has to have kept
  // walking through the turn rather than standing still to make it.
  expect(turningFrames).toBeGreaterThan(0);
  let walkingFrames = 0;
  for (let frame = 1; frame < bodyPath.length; frame += 1) {
    const from = bodyPath[frame - 1];
    const to = bodyPath[frame];
    if (!from || !to) continue;
    if (Math.hypot(to.x - from.x, to.z - from.z) > 1e-9) walkingFrames += 1;
  }
  expect(walkingFrames).toBeGreaterThan((bodyPath.length - 1) * 0.9);

  // And it never left the one zone it is allowed to stand in.
  for (const { x, z } of bodyPath) {
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(MEADOW_ISLAND_RADIUS_METERS);
  }

  module.unload();
});

test("Animals walk the same arc whatever the frame rate", () => {
  const thirtyFps = walkOnIsland(30);
  const ninetyFps = walkOnIsland(90);

  // A turn authored per frame rather than per second walks a different path
  // at every frame rate, and a headset holds no single one. The same minute
  // of walking, stepped thirty times a second and ninety, has to leave the
  // body on the same ground facing the same way.
  expect(thirtyFps.turnedRadians).toBeGreaterThan(1);
  expect(
    Math.abs(
      shortestAngle(ninetyFps.headingRadians - thirtyFps.headingRadians),
    ),
  ).toBeLessThan(FRAME_RATE_HEADING_TOLERANCE_RADIANS);
  expect(
    Math.hypot(ninetyFps.x - thirtyFps.x, ninetyFps.z - thirtyFps.z),
  ).toBeLessThan(FRAME_RATE_POSITION_TOLERANCE_METERS);
});

/** The opacity of the actors currently drawn; zero when none is. */
function readVisibleOpacity(population: Group): number {
  let highest = 0;
  population.traverse((object) => {
    if (!(object instanceof Mesh) || !object.visible) return;
    if (Array.isArray(object.material)) return;
    if (!object.parent?.visible) return;

    highest = Math.max(highest, object.material.opacity);
  });
  return highest;
}

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

interface IslandWalk {
  readonly headingRadians: number;
  readonly turnedRadians: number;
  readonly x: number;
  readonly z: number;
}

/** Where one deer stands after walking the island at this frame rate. */
function walkOnIsland(framesPerSecond: number): IslandWalk {
  let latest: IslandWalk | undefined;
  const { module } = createAnimalsModule({
    scene: new Scene(),
    viewpoint: {
      worldPosition: new Vector3(),
      viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
    },
    definition: {
      ...DEFINITION,
      maxVisible: 1,
      // Inside the island, so the actor is placed on ground it may stand on.
      activeRadiusMeters: MEADOW_ISLAND_RADIUS_METERS,
      species: [
        {
          ...createSpecies("deer"),
          count: 1,
          heightMeters: 1.4,
          speedMetersPerSecond: 0.65,
          allowedZones: ["meadow"],
        },
      ],
    },
    preset: PRESET,
    assets: createAnimalAssets(),
    worldSurface: createIslandSurface(MEADOW_ISLAND_RADIUS_METERS),
    onBodiesUpdated: (bodies) => {
      const body = bodies[0];
      if (!body) return;
      const turnedThisFrame = latest
        ? Math.abs(shortestAngle(body.headingRadians - latest.headingRadians))
        : 0;
      latest = {
        headingRadians: body.headingRadians,
        turnedRadians: (latest?.turnedRadians ?? 0) + turnedThisFrame,
        x: body.x,
        z: body.z,
      };
    },
  });

  module.load();
  module.activate();
  const stepSeconds = 1 / framesPerSecond;
  const steps = Math.round(FRAME_RATE_PROBE_SECONDS * framesPerSecond);
  for (let step = 0; step < steps; step += 1) module.update?.(stepSeconds);
  module.unload();
  if (!latest) throw new Error("Expected an observed animal body");
  return latest;
}

/** The signed way round from one angle to another, never the long way. */
function shortestAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

/** One round meadow in conifer forest: walking straight always finds an edge. */
function createIslandSurface(radiusMeters: number): WorldSurface {
  return {
    ...createFlatSurface(),
    zoneAt: (worldX, worldZ) =>
      Math.hypot(worldX, worldZ) <= radiusMeters ? "meadow" : "coniferForest",
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
