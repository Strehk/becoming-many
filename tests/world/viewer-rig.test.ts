/**
 * Purpose: Prove locomotion survives the pose the headset writes every frame.
 * Context: Three.js overwrites the camera's local transform from the head pose
 *   while presenting, so locomotion written there is silently discarded.
 * Responsibility: Cover the rig's survival of that overwrite, the loss of a
 *   camera-local write, and the world position the rig publishes.
 * Boundary: Session lifecycle, rendering, and what drives the rig stay outside.
 */

import { describe, expect, test } from "bun:test";
import { Matrix4, type Object3D, Scene } from "three";
import { createViewerRig } from "../../src/world/viewer-rig";

/**
 * `WebXRManager.updateUserCamera` reproduced exactly: the camera's local
 * transform is replaced so its world transform equals the head pose. This is
 * the operation every locomotion write has to survive. The `parent === null`
 * branch is the bug the rig exists to remove — with no rig, the head pose
 * lands directly on the camera's own position.
 */
function writeHeadsetPose(camera: Object3D, headWorldMatrix: Matrix4): void {
  const parent = camera.parent;
  if (parent === null) {
    camera.matrix.copy(headWorldMatrix);
  } else {
    camera.matrix.copy(parent.matrixWorld).invert().multiply(headWorldMatrix);
  }
  camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
  camera.updateMatrixWorld(true);
}

/** A visitor standing this far above their `local-floor` origin. */
const STANDING_HEIGHT_METERS = 1.6;

/** Where the runtime's head would be, given where the rig has moved to. */
function headPoseOver(rigWorldMatrix: Matrix4): Matrix4 {
  return new Matrix4().multiplyMatrices(
    rigWorldMatrix,
    new Matrix4().makeTranslation(0, STANDING_HEIGHT_METERS, 0),
  );
}

describe("viewer rig", () => {
  test("locomotion moves the visitor through a headset pose overwrite", () => {
    const scene = new Scene();
    const viewer = createViewerRig();
    scene.add(viewer.group);

    // Ten seconds of steady forward travel, with the runtime writing the head
    // pose during every render exactly as it does in a live session.
    for (let frame = 0; frame < 10; frame += 1) {
      viewer.group.position.z -= 10;
      viewer.publish();
      writeHeadsetPose(viewer.camera, headPoseOver(viewer.group.matrixWorld));
    }

    viewer.publish();
    expect(viewer.viewpoint.worldPosition.z).toBeCloseTo(-100);
    // The visitor travelled, and still stands their own height above the floor.
    expect(viewer.viewpoint.worldPosition.y).toBeCloseTo(
      STANDING_HEIGHT_METERS,
    );
  });

  test("a write to the camera's own transform does not move the visitor", () => {
    const scene = new Scene();
    const viewer = createViewerRig();
    scene.add(viewer.group);

    // The bug the rig exists to make unrepresentable: before it, this was the
    // only thing locomotion did, and the head pose erased it every frame.
    viewer.camera.position.set(0, 0, -100);
    writeHeadsetPose(viewer.camera, headPoseOver(viewer.group.matrixWorld));

    viewer.publish();
    expect(viewer.viewpoint.worldPosition.z).toBeCloseTo(0);
  });

  test("the published viewpoint follows the rig within the same frame", () => {
    const viewer = createViewerRig();
    viewer.group.position.set(64, 12, -128);
    viewer.publish();

    expect(viewer.viewpoint.worldPosition.toArray()).toEqual([64, 12, -128]);
  });

  test("the published position carries the head offset in world space", () => {
    const viewer = createViewerRig();
    viewer.group.position.set(0, 0, -40);
    // A quarter turn: the head's own offset has to rotate with the rig.
    viewer.group.rotateY(Math.PI / 2);
    viewer.camera.position.set(0, STANDING_HEIGHT_METERS, 2);
    viewer.publish();

    const { worldPosition } = viewer.viewpoint;
    expect(worldPosition.x).toBeCloseTo(2);
    expect(worldPosition.y).toBeCloseTo(STANDING_HEIGHT_METERS);
    expect(worldPosition.z).toBeCloseTo(-40);
  });

  test("the view distance follows the camera's far plane", () => {
    const viewer = createViewerRig();
    viewer.camera.far = 240;

    // A show retunes the far plane mid-run, so a snapshot would go stale.
    expect(viewer.viewpoint.viewDistanceMeters).toBe(240);
  });
});
