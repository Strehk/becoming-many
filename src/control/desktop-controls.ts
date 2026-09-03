/**
 * Purpose: Provide minimal first-person controls for desktop development.
 * Context: The browser runtime needs mouse look and keyboard navigation.
 * Responsibility: Capture pointer input and move the viewer rig through 3D space.
 * Boundary: WebXR input, collisions, physics, and world rendering live elsewhere.
 */

import { type Camera, type Object3D, Quaternion, Vector3 } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const MOVEMENT_SPEED = 20;
const FORWARD_KEYS = ["KeyW", "ArrowUp"] as const;
const BACKWARD_KEYS = ["KeyS", "ArrowDown"] as const;
const RIGHT_KEYS = ["KeyD", "ArrowRight"] as const;
const LEFT_KEYS = ["KeyA", "ArrowLeft"] as const;
const MOVEMENT_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "KeyA",
  "KeyD",
  "KeyS",
  "KeyW",
]);

export interface DesktopControls {
  readonly update: (deltaSeconds: number) => void;
}

export function createDesktopControls(
  camera: Camera,
  viewerRig: Object3D,
  domElement: HTMLElement,
): DesktopControls {
  const controls = new PointerLockControls(camera, domElement);
  const pressedKeys = trackMovementKeys();

  domElement.addEventListener("click", () => controls.lock());

  return {
    update: (deltaSeconds) =>
      updateMovement(controls, viewerRig, pressedKeys, deltaSeconds),
  };
}

function trackMovementKeys(): ReadonlySet<string> {
  const pressedKeys = new Set<string>();

  window.addEventListener("keydown", (event) => {
    if (!MOVEMENT_KEYS.has(event.code)) return;

    event.preventDefault();
    pressedKeys.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    if (!MOVEMENT_KEYS.has(event.code)) return;

    event.preventDefault();
    pressedKeys.delete(event.code);
  });

  window.addEventListener("blur", () => pressedKeys.clear());
  return pressedKeys;
}

function updateMovement(
  controls: PointerLockControls,
  viewerRig: Object3D,
  pressedKeys: ReadonlySet<string>,
  deltaSeconds: number,
): void {
  if (!controls.isLocked) return;

  const forward = getDirection(pressedKeys, FORWARD_KEYS, BACKWARD_KEYS);
  const right = getDirection(pressedKeys, RIGHT_KEYS, LEFT_KEYS);
  const directionLength = Math.hypot(forward, right);

  if (directionLength === 0) return;

  const distance = (MOVEMENT_SPEED * deltaSeconds) / directionLength;
  // Pointer lock owns only the camera's look. Translate its parent rig along
  // the camera's world axes so desktop flight still follows that look without
  // putting locomotion on the camera WebXR overwrites.
  controls.object.getWorldQuaternion(viewQuaternion);
  forwardDirection
    .set(0, 0, -1)
    .applyQuaternion(viewQuaternion)
    .multiplyScalar(forward * distance);
  rightDirection
    .set(1, 0, 0)
    .applyQuaternion(viewQuaternion)
    .multiplyScalar(right * distance);
  viewerRig.position.add(forwardDirection).add(rightDirection);
}

const viewQuaternion = new Quaternion();
const forwardDirection = new Vector3();
const rightDirection = new Vector3();

function getDirection(
  pressedKeys: ReadonlySet<string>,
  positiveKeys: readonly [string, string],
  negativeKeys: readonly [string, string],
): number {
  const positive = positiveKeys.some((key) => pressedKeys.has(key));
  const negative = negativeKeys.some((key) => pressedKeys.has(key));

  return Number(positive) - Number(negative);
}
