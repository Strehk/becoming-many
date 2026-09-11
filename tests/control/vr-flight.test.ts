/** Head tracking supplies physical tilt once; flight still owns travel and heading. */
import { expect, test } from "bun:test";
import { Euler, Matrix4, Quaternion } from "three";
import { createFlightControl } from "../../src/control/flight-control";
import { createViewerRig } from "../../src/world/viewer-rig";

test("XR keeps flight motion while pitch and bank come only from the tracked head", () => {
  const viewer = createViewerRig();
  const flight = createFlightControl(viewer.group, [
    { readInput: () => ({ forwardTilt: 0.5, rightTilt: 0.5 }) },
  ]);
  const head = new Quaternion().setFromEuler(new Euler(-0.3, 0.2, -0.4, "YXZ"));
  for (let frame = 0; frame < 60; frame++) {
    viewer.beginFrame();
    flight.update(1 / 60, 5, true);
    viewer.publish(true);
    const parent = viewer.camera.parent;
    if (!parent) throw new Error("Camera requires the viewer rig");
    const trackedWorld = parent.matrixWorld
      .clone()
      .multiply(new Matrix4().makeRotationFromQuaternion(head));
    viewer.camera.matrix
      .copy(parent.matrixWorld)
      .invert()
      .multiply(trackedWorld);
    viewer.camera.matrix.decompose(
      viewer.camera.position,
      viewer.camera.quaternion,
      viewer.camera.scale,
    );
  }
  viewer.publish(true);
  const rigPose = new Euler().setFromQuaternion(viewer.group.quaternion, "YXZ");
  expect(rigPose.x).toBeCloseTo(0);
  expect(rigPose.z).toBeCloseTo(0);
  expect(rigPose.y).toBeLessThan(0);
  expect(viewer.group.position.x).toBeGreaterThan(0);
  expect(viewer.group.position.y).toBeLessThan(0);
  expect(viewer.camera.quaternion.angleTo(head)).toBeLessThan(1e-7);
});
