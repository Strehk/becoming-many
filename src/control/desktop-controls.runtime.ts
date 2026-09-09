import { type Camera, type Object3D, Quaternion, Vector3 } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

export interface DesktopControls {
  readonly update: (
    deltaSeconds: number,
    movementSpeedMetersPerSecond?: number,
  ) => void;
  /** Ends input capture and awaits any pending pointer-lock grant and release. */
  readonly unload: () => Promise<void>;
}

const MOVEMENT_SPEED_METERS_PER_SECOND = 20;
const FORWARD_KEYS = ["KeyW", "ArrowUp"] as const;
const BACKWARD_KEYS = ["KeyS", "ArrowDown"] as const;
const RIGHT_KEYS = ["KeyD", "ArrowRight"] as const;
const LEFT_KEYS = ["KeyA", "ArrowLeft"] as const;
const MOVEMENT_KEYS = new Set<string>([
  ...FORWARD_KEYS,
  ...BACKWARD_KEYS,
  ...RIGHT_KEYS,
  ...LEFT_KEYS,
]);

/** Owns desktop input; mutates borrowed camera look and rig position in meters. */
export function createDesktopControls(
  camera: Camera,
  viewerRig: Object3D,
  domElement: HTMLElement,
): DesktopControls {
  const controls = new PointerLockControls(camera, domElement);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const pressedKeys = new Set<string>();
  const viewQuaternion = new Quaternion();
  const forwardDirection = new Vector3();
  const rightDirection = new Vector3();
  let pendingLock: Promise<void> | undefined;
  let unloading: Promise<void> | undefined;

  domElement.addEventListener(
    "click",
    () => {
      if (pendingLock) return;
      pendingLock = domElement
        .requestPointerLock()
        .catch((error: unknown) => {
          if (!signal.aborted)
            console.warn("Desktop pointer lock failed.", error);
        })
        .finally(() => {
          pendingLock = undefined;
        });
    },
    { signal },
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (!controls.isLocked || !MOVEMENT_KEYS.has(event.code)) return;

      event.preventDefault();
      pressedKeys.add(event.code);
    },
    { signal },
  );

  window.addEventListener(
    "keyup",
    (event) => {
      if (!controls.isLocked || !MOVEMENT_KEYS.has(event.code)) return;

      event.preventDefault();
      pressedKeys.delete(event.code);
    },
    { signal },
  );

  window.addEventListener("blur", () => pressedKeys.clear(), { signal });
  domElement.ownerDocument.addEventListener(
    "pointerlockchange",
    () => {
      if (!controls.isLocked) pressedKeys.clear();
    },
    { signal },
  );

  return { update, unload };

  function update(
    deltaSeconds: number,
    movementSpeedMetersPerSecond = MOVEMENT_SPEED_METERS_PER_SECOND,
  ): void {
    if (signal.aborted || !controls.isLocked) return;

    const forward = getDirection(pressedKeys, FORWARD_KEYS, BACKWARD_KEYS);
    const right = getDirection(pressedKeys, RIGHT_KEYS, LEFT_KEYS);
    const directionLength = Math.hypot(forward, right);
    if (directionLength === 0) return;

    const distance =
      (movementSpeedMetersPerSecond * deltaSeconds) / directionLength;
    // Move the rig along the camera's world axes; WebXR owns camera translation.
    camera.getWorldQuaternion(viewQuaternion);
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

  function unload(): Promise<void> {
    if (unloading) return unloading;
    lifetime.abort();
    pressedKeys.clear();
    controls.dispose();
    unloading = (async () => {
      await pendingLock;
      // A permission response can grant the lock after our listeners ended.
      const owner = domElement.ownerDocument;
      if (owner.pointerLockElement !== domElement) return;
      await new Promise<void>((resolve, reject) => {
        const onUnlock = (): void => resolve();
        owner.addEventListener("pointerlockchange", onUnlock, { once: true });
        try {
          owner.exitPointerLock();
        } catch (error) {
          owner.removeEventListener("pointerlockchange", onUnlock);
          reject(error);
        }
      });
    })();
    return unloading;
  }
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
