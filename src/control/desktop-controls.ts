/**
 * Purpose: Provide minimal first-person controls for desktop development.
 * Context: The current MVP needs mouse look and keyboard navigation.
 * Responsibility: Capture pointer input and move the camera through 3D space.
 * Boundary: WebXR input, collisions, physics, and world rendering live elsewhere.
 */

import type { Camera } from "three";
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
  domElement: HTMLElement,
): DesktopControls {
  const controls = new PointerLockControls(camera, domElement);
  const pressedKeys = trackMovementKeys();

  domElement.addEventListener("click", () => controls.lock());

  return {
    update: (deltaSeconds) =>
      updateMovement(controls, pressedKeys, deltaSeconds),
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
  pressedKeys: ReadonlySet<string>,
  deltaSeconds: number,
): void {
  if (!controls.isLocked) return;

  const forward = getDirection(pressedKeys, FORWARD_KEYS, BACKWARD_KEYS);
  const right = getDirection(pressedKeys, RIGHT_KEYS, LEFT_KEYS);
  const directionLength = Math.hypot(forward, right);

  if (directionLength === 0) return;

  const distance = (MOVEMENT_SPEED * deltaSeconds) / directionLength;
  // PointerLockControls.moveForward() deliberately ignores camera pitch.
  // Local camera axes make forward flight follow the mouse look direction.
  controls.object.translateZ(-forward * distance);
  controls.object.translateX(right * distance);
}

function getDirection(
  pressedKeys: ReadonlySet<string>,
  positiveKeys: readonly [string, string],
  negativeKeys: readonly [string, string],
): number {
  const positive = positiveKeys.some((key) => pressedKeys.has(key));
  const negative = negativeKeys.some((key) => pressedKeys.has(key));

  return Number(positive) - Number(negative);
}
