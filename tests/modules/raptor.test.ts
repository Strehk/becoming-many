/**
 * Purpose: Verify the raptor holds its ring, its height, and its bank.
 * Context: One bird soaring far above is placed entirely by authored values.
 * Responsibility: Cover the ring, the drift after the traveller, and the lifecycle.
 * Boundary: How a soaring bird reads from below is a visual acceptance.
 */

import { describe, expect, test } from "bun:test";
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createRaptorModule } from "../../src/modules/raptor/raptor";
import { RAPTOR_DEFINITION } from "../../src/modules/raptor/raptor-definition";
import type { WorldSurface } from "../../src/world-surface/world-surface";

const GROUND_Y = 4;

describe("the high raptor", () => {
  test("holds its ring at the authored radius and height", () => {
    const { scene, module, viewpoint } = createRaptor();
    module.load();
    module.activate();
    const raptor = scene.children[0];
    if (!raptor) throw new Error("Expected one raptor");

    for (let step = 0; step < 200; step += 1) module.update?.(0.1);

    const outward = Math.hypot(
      raptor.position.x - viewpoint.worldPosition.x,
      raptor.position.z - viewpoint.worldPosition.z,
    );
    expect(outward).toBeCloseTo(RAPTOR_DEFINITION.ringRadiusMeters, 0);

    const above = raptor.position.y - GROUND_Y;
    expect(above).toBeGreaterThan(
      RAPTOR_DEFINITION.heightAboveGroundMeters -
        RAPTOR_DEFINITION.ringRiseMeters -
        0.001,
    );
    expect(above).toBeLessThan(
      RAPTOR_DEFINITION.heightAboveGroundMeters +
        RAPTOR_DEFINITION.ringRiseMeters +
        0.001,
    );
    expect(raptor.rotation.z).toBeCloseTo(RAPTOR_DEFINITION.bankRadians, 5);
  });

  test("carries the ring after a traveller who flies away from it", () => {
    const { scene, module, viewpoint } = createRaptor();
    module.load();
    module.activate();
    const raptor = scene.children[0];
    if (!raptor) throw new Error("Expected one raptor");

    for (let step = 0; step < 600; step += 1) {
      viewpoint.worldPosition.z += 5 / 60;
      module.update?.(1 / 60);
    }

    // Ten seconds of flight at five metres a second: a ring that did not
    // follow would be fifty metres behind and out of the world.
    const outward = Math.hypot(
      raptor.position.x - viewpoint.worldPosition.x,
      raptor.position.z - viewpoint.worldPosition.z,
    );
    expect(outward).toBeLessThan(RAPTOR_DEFINITION.ringRadiusMeters + 25);
  });

  test("holds still while it is put away, and leaves nothing behind", () => {
    const { scene, module } = createRaptor();
    module.load();
    const raptor = scene.children[0];
    if (!raptor) throw new Error("Expected one raptor");
    expect(raptor.visible).toBe(false);

    const restingX = raptor.position.x;
    module.update?.(2);
    expect(raptor.position.x).toBe(restingX);

    module.activate();
    module.update?.(2);
    expect(raptor.position.x).not.toBe(restingX);

    module.unload();
    expect(scene.children).toHaveLength(0);
  });
});

function createRaptor() {
  const scene = new Scene();
  const viewpoint = {
    worldPosition: new Vector3(),
    viewDistanceMeters: 128,
  };
  const module = createRaptorModule({
    scene,
    viewpoint,
    preset: { color: 0x171717 },
    assets: new Map([[RAPTOR_DEFINITION.asset.id, createRaptorGltf()]]),
    worldSurface: {
      groundYAt: () => GROUND_Y,
      surfaceYAt: () => GROUND_Y,
      zoneAt: () => "meadow",
      zoneConditionsAt: () => ({}),
    } as unknown as WorldSurface,
  });
  return { scene, module, viewpoint };
}

/** A two-metre span with the beat the module looks for, and nothing else. */
function createRaptorGltf(): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(2, 0.2, 1), new MeshBasicMaterial()));
  return {
    animations: [new AnimationClip(RAPTOR_DEFINITION.beatClip, 0.5, [])],
    asset: {},
    cameras: [],
    parser: {} as GLTF["parser"],
    scene,
    scenes: [scene],
    userData: {},
  };
}
