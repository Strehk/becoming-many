/**
 * Purpose: Prove M5 locomotion survives WebXR's per-frame head-pose write.
 * Context: WebXR owns the child camera while flight owns its parent viewer rig.
 * Responsibility: Exercise the integration between the glider and viewer rig.
 * Boundary: Session lifecycle, polling, rendering, and target-device checks stay outside.
 */

import { describe, expect, test } from "bun:test";
import { Matrix4, type Object3D, Scene } from "three";
import { applyM5Flight } from "../../src/control/m5-flight";
import { createNeutralControl } from "../../src/m5/control-frame";
import { createViewerRig } from "../../src/world/viewer-rig";

const STANDING_HEIGHT_METERS = 1.6;

describe("VR flight", () => {
  test("keeps a steady M5 glide while WebXR replaces the head pose", () => {
    const scene = new Scene();
    const viewer = createViewerRig();
    scene.add(viewer.group);

    for (let frame = 0; frame < 10; frame += 1) {
      applyM5Flight(viewer.group, createNeutralControl(), 1);
      viewer.publish();
      writeHeadsetPose(viewer.camera, headPoseOver(viewer.group.matrixWorld));
    }

    viewer.publish();
    expect(viewer.viewpoint.worldPosition.z).toBeCloseTo(-100);
    expect(viewer.viewpoint.worldPosition.y).toBeCloseTo(
      STANDING_HEIGHT_METERS,
    );
  });

  test("keeps M5 steering on the rig instead of the headset camera", () => {
    const scene = new Scene();
    const viewer = createViewerRig();
    scene.add(viewer.group);

    applyM5Flight(viewer.group, { ...createNeutralControl(), roll: 0.5 }, 1);
    viewer.publish();
    const steeredQuaternion = viewer.group.quaternion.clone();

    writeHeadsetPose(viewer.camera, headPoseOver(viewer.group.matrixWorld));

    expect(viewer.group.quaternion.equals(steeredQuaternion)).toBe(true);
    expect(Math.abs(viewer.group.position.x)).toBeGreaterThan(0.01);
  });
});

/** Reproduce Three.js WebXRManager.updateUserCamera for a parented camera. */
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

function headPoseOver(rigWorldMatrix: Matrix4): Matrix4 {
  return new Matrix4().multiplyMatrices(
    rigWorldMatrix,
    new Matrix4().makeTranslation(0, STANDING_HEIGHT_METERS, 0),
  );
}
