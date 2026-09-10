import type { Camera } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import type { DesktopController } from "./control-contract";
import { FLIGHT_SETTINGS } from "./flight-settings";

const FLIGHT_KEYS = new Set([
  "KeyW",
  "ArrowUp",
  "KeyS",
  "ArrowDown",
  "KeyD",
  "ArrowRight",
  "KeyA",
  "ArrowLeft",
]);

/** Own desktop look capture and translate held keys into reusable flight input. */
export function createDesktopController(
  camera: Camera,
  domElement: HTMLElement,
): DesktopController {
  const look = new PointerLockControls(camera, domElement);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const pressedKeys = new Set<string>();
  const input = { forwardTilt: 0, rightTilt: 0 };
  let pendingLock: Promise<void> | undefined;
  let unloading: Promise<void> | undefined;

  domElement.addEventListener("click", requestLock, { signal });
  window.addEventListener("keydown", onKeyChange, { signal });
  window.addEventListener("keyup", onKeyChange, { signal });
  window.addEventListener("blur", clearKeys, { signal });
  domElement.ownerDocument.addEventListener("pointerlockchange", onLockChange, {
    signal,
  });

  return {
    readInput: sampleInput,
    unload,
  };

  function requestLock(): void {
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
  }

  function onKeyChange(event: KeyboardEvent): void {
    if (!look.isLocked || !FLIGHT_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.type === "keydown") pressedKeys.add(event.code);
    else pressedKeys.delete(event.code);
    // Preserve immediate keydown response, including opposing-key cancellation.
    readKeyboardInput(event.type === "keydown" ? 1 : 0);
  }

  function clearKeys(): void {
    pressedKeys.clear();
    input.forwardTilt = 0;
    input.rightTilt = 0;
  }

  function onLockChange(): void {
    if (!look.isLocked) clearKeys();
  }

  function sampleInput(deltaSeconds: number): Readonly<typeof input> {
    const elapsedSeconds =
      Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    readKeyboardInput(
      FLIGHT_SETTINGS.desktopTiltReturnPerSecond * elapsedSeconds,
    );
    return input;
  }

  function readKeyboardInput(maximumReturn: number): void {
    const forward = Number(
      pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp"),
    );
    const backward = Number(
      pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown"),
    );
    const right = Number(
      pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight"),
    );
    const left = Number(
      pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft"),
    );
    input.forwardTilt =
      forward - backward || returnToCenter(input.forwardTilt, maximumReturn);
    input.rightTilt =
      right - left || returnToCenter(input.rightTilt, maximumReturn);
  }

  function unload(): Promise<void> {
    if (unloading) return unloading;
    lifetime.abort();
    clearKeys();
    look.dispose();
    unloading = releasePointerLock();
    return unloading;
  }

  async function releasePointerLock(): Promise<void> {
    await pendingLock;
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
  }
}

function returnToCenter(tilt: number, maximumChange: number): number {
  if (Math.abs(tilt) <= maximumChange) return 0;
  return tilt - Math.sign(tilt) * maximumChange;
}
