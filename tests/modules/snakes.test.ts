/**
 * Purpose: Verify the rebuilt snake body and where the ground lets one crawl.
 * Context: The authored model was a rigid tube; what ships is its girth and a wave.
 * Responsibility: Cover the geometry, the pool, the ground refusal, and the crawl.
 * Boundary: How a snake looks in motion is a visual acceptance, not a test.
 */

import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Scene, Vector3 } from "three";
import { createSnakeGeometry } from "../../src/modules/snakes/snake-geometry";
import { createSnakesModule } from "../../src/modules/snakes/snakes";
import { SNAKES_DEFINITION } from "../../src/modules/snakes/snakes-definition";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

const PRESET = { candidatesPerCell: 4, crawlingShare: 1, color: 0x2b2b2b };

describe("the rebuilt snake body", () => {
  test("lays every ring along a unit body and marks where it sits", () => {
    const geometry = createSnakeGeometry();
    const positions = geometry.getAttribute("position");
    const alongBody = geometry.getAttribute("snakeAlongBody");
    const { ringCount, sideCount } = SNAKES_DEFINITION;

    expect(positions.count).toBe(ringCount * sideCount);
    expect(geometry.getIndex()?.count).toBe((ringCount - 1) * sideCount * 6);

    let headZ = Number.POSITIVE_INFINITY;
    let tailZ = Number.NEGATIVE_INFINITY;
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const place = alongBody.getX(vertex);
      expect(place).toBeGreaterThanOrEqual(0);
      expect(place).toBeLessThanOrEqual(1);
      expect(positions.getZ(vertex)).toBeCloseTo(place, 5);
      headZ = Math.min(headZ, positions.getZ(vertex));
      tailZ = Math.max(tailZ, positions.getZ(vertex));
    }
    expect(headZ).toBe(0);
    expect(tailZ).toBe(1);
  });

  test("draws the tail to a point and keeps the body round", () => {
    const geometry = createSnakeGeometry();
    const positions = geometry.getAttribute("position");
    const { sideCount, ringCount } = SNAKES_DEFINITION;

    const girthAt = (ring: number): number => {
      let widest = 0;
      for (let side = 0; side < sideCount; side += 1) {
        widest = Math.max(
          widest,
          Math.abs(positions.getX(ring * sideCount + side)),
        );
      }
      return widest;
    };
    expect(girthAt(Math.floor(ringCount / 2))).toBeGreaterThan(girthAt(0));
    expect(girthAt(ringCount - 1)).toBeLessThan(girthAt(0));
  });
});

describe("Snakes", () => {
  test("crawls only where the ground is open and level", () => {
    const scene = new Scene();
    const module = createSnakesModule({
      scene,
      viewpoint: { worldPosition: new Vector3(), viewDistanceMeters: 64 },
      preset: PRESET,
      worldSurface: createFlatSurface("meadow"),
    });
    module.load();
    const mesh = scene.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("Expected one pool");
    expect(mesh.count).toBeGreaterThan(0);

    const woodedScene = new Scene();
    const wooded = createSnakesModule({
      scene: woodedScene,
      viewpoint: { worldPosition: new Vector3(), viewDistanceMeters: 64 },
      preset: PRESET,
      worldSurface: createFlatSurface("coniferForest"),
    });
    wooded.load();
    const woodedMesh = woodedScene.children[0];
    if (!(woodedMesh instanceof InstancedMesh))
      throw new Error("Expected one pool");
    // A snake crossing a wood would be laid through the trunks it cannot see.
    expect(woodedMesh.count).toBe(0);
  });

  test("carries every snake along its own way over time", () => {
    const scene = new Scene();
    const module = createSnakesModule({
      scene,
      viewpoint: { worldPosition: new Vector3(), viewDistanceMeters: 64 },
      preset: PRESET,
      worldSurface: createFlatSurface("meadow"),
    });
    module.load();
    module.activate();
    const mesh = scene.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error("Expected one pool");

    const placement = new Matrix4();
    const before = new Vector3();
    mesh.getMatrixAt(0, placement);
    before.setFromMatrixPosition(placement);

    module.update?.(1);
    const after = new Vector3();
    mesh.getMatrixAt(0, placement);
    after.setFromMatrixPosition(placement);

    const travelled = Math.hypot(after.x - before.x, after.z - before.z);
    expect(travelled).toBeCloseTo(
      SNAKES_DEFINITION.crawlSpeedMetersPerSecond,
      2,
    );
    module.deactivate();
    module.unload();
    expect(scene.children).toHaveLength(0);
  });
});

/** One zone, one height: the ground under a test that is about placement. */
function createFlatSurface(zone: ZoneId): WorldSurface {
  return {
    groundYAt: () => 3,
    surfaceYAt: () => 3,
    zoneAt: () => zone,
    zoneConditionsAt: () => ({
      groundY: 3,
      slope: 0,
      riverDistance: 100,
      water: 0,
      forest: 0,
    }),
  } as unknown as WorldSurface;
}
