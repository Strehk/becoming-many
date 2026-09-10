import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Group, PerspectiveCamera } from "three";
import type { DesktopController } from "../../src/control/control-contract";
import { createDesktopController } from "../../src/control/desktop-controller";
import { createFlightControl } from "../../src/control/flight-control";
import { FLIGHT_SETTINGS } from "../../src/control/flight-settings";

/** Model pointer-lock events around real Three.js controls without rendering. */
class PointerLockDocument extends EventTarget {
  pointerLockElement: PointerLockCanvas | null = null;
  exitCount = 0;

  setLock(canvas: PointerLockCanvas | null): void {
    this.pointerLockElement = canvas;
    this.dispatchEvent(new Event("pointerlockchange"));
  }

  exitPointerLock(): void {
    this.exitCount++;
    this.setLock(null);
  }
}

class PointerLockCanvas extends EventTarget {
  readonly ownerDocument = new PointerLockDocument();
  readonly lockRequest = Promise.withResolvers<void>();
  requestCount = 0;

  requestPointerLock(): Promise<void> {
    this.requestCount++;
    return this.lockRequest.promise;
  }

  grantLock(): void {
    this.ownerDocument.setLock(this);
    this.lockRequest.resolve();
  }
}

let originalWindow: PropertyDescriptor | undefined;
let keyboard: EventTarget;
let canvas: PointerLockCanvas;
let camera: PerspectiveCamera;
let controls: DesktopController;

beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  keyboard = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: keyboard,
  });
  canvas = new PointerLockCanvas();
  camera = new PerspectiveCamera();
  controls = createDesktopController(camera, canvas as unknown as HTMLElement);
});

afterEach(async () => {
  await controls.unload();
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

function key(type: "keydown" | "keyup", code: string): Event {
  const event = Object.assign(new Event(type, { cancelable: true }), { code });
  keyboard.dispatchEvent(event);
  return event;
}

describe("desktop flight control", () => {
  test("stays neutral and leaves keys alone without pointer lock", () => {
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp"]) {
      expect(key("keydown", code).defaultPrevented).toBe(false);
      expect(key("keyup", code).defaultPrevented).toBe(false);
    }
    expect(controls.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test.each([
    ["KeyW", { forwardTilt: 1, rightTilt: 0 }],
    ["ArrowUp", { forwardTilt: 1, rightTilt: 0 }],
    ["KeyS", { forwardTilt: -1, rightTilt: 0 }],
    ["ArrowDown", { forwardTilt: -1, rightTilt: 0 }],
    ["KeyA", { forwardTilt: 0, rightTilt: -1 }],
    ["ArrowLeft", { forwardTilt: 0, rightTilt: -1 }],
    ["KeyD", { forwardTilt: 0, rightTilt: 1 }],
    ["ArrowRight", { forwardTilt: 0, rightTilt: 1 }],
  ] as const)("maps %s to semantic flight input", (code, expected) => {
    canvas.grantLock();
    expect(key("keydown", code).defaultPrevented).toBe(true);
    expect(controls.readInput(0)).toEqual(expected);
    expect(key("keyup", code).defaultPrevented).toBe(true);
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test.each(["KeyS", "ArrowDown"])(
    "%s raises the rig above its neutral flight height",
    (code) => {
      const viewerRig = new Group();
      const flight = createFlightControl(viewerRig, [controls]);
      const deltaSeconds = 0.1;
      canvas.grantLock();
      key("keydown", code);

      flight.update(deltaSeconds);

      expect(viewerRig.position.y).toBeGreaterThan(0);
    },
  );

  test("keeps aliases held and cancels opposing keys", () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    key("keydown", "ArrowUp");
    key("keyup", "KeyW");
    expect(controls.readInput(0).forwardTilt).toBe(1);
    key("keydown", "KeyS");
    expect(controls.readInput(0).forwardTilt).toBe(0);
    key("keyup", "ArrowUp");
    expect(controls.readInput(0).forwardTilt).toBe(-1);
    key("keyup", "KeyS");
    expect(controls.readInput(0.25).forwardTilt).toBe(0);
  });

  test("returns released tilt monotonically to exact center", () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    key("keydown", "KeyD");
    key("keyup", "KeyW");
    key("keyup", "KeyD");

    const released = controls.readInput(0);
    const firstForward = released.forwardTilt;
    const firstRight = released.rightTilt;
    const second = controls.readInput(0.1);
    const secondForward = second.forwardTilt;
    const secondRight = second.rightTilt;
    const third = controls.readInput(0.1);
    const thirdForward = third.forwardTilt;
    const thirdRight = third.rightTilt;

    expect(firstForward).toBe(1);
    expect(firstRight).toBe(1);
    expect(secondForward).toBeGreaterThan(0);
    expect(secondForward).toBeLessThan(firstForward);
    expect(secondRight).toBeGreaterThan(0);
    expect(secondRight).toBeLessThan(firstRight);
    expect(thirdForward).toBeLessThan(secondForward);
    expect(thirdRight).toBeLessThan(secondRight);
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test("ignores invalid frame deltas and centers after a large finite step", () => {
    canvas.grantLock();
    key("keydown", "KeyS");
    key("keyup", "KeyS");

    expect(controls.readInput(Number.NaN).forwardTilt).toBe(-1);
    expect(controls.readInput(-1).forwardTilt).toBe(-1);
    expect(controls.readInput(Number.POSITIVE_INFINITY).forwardTilt).toBe(-1);
    expect(controls.readInput(10).forwardTilt).toBe(0);
  });

  test("keeps mouse look local and out of the flight path", () => {
    const viewerRig = new Group();
    viewerRig.add(camera);
    const flight = createFlightControl(viewerRig, [controls]);
    canvas.grantLock();
    canvas.ownerDocument.dispatchEvent(
      Object.assign(new Event("mousemove"), {
        movementX: 300,
        movementY: -100,
      }),
    );

    expect(camera.rotation.x).not.toBeCloseTo(0);
    expect(camera.rotation.y).not.toBeCloseTo(0);
    flight.update(1);

    expect(viewerRig.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(viewerRig.position.x).toBeCloseTo(0);
    expect(viewerRig.position.z).toBeLessThan(0);
  });

  test("clears held input on blur, pointer-lock loss, and unload", async () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    keyboard.dispatchEvent(new Event("blur"));
    expect(controls.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
    key("keydown", "KeyD");
    canvas.ownerDocument.exitPointerLock();
    expect(controls.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
    canvas.grantLock();
    key("keydown", "KeyS");
    await controls.unload();
    expect(controls.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test("unloads once and releases a late pointer-lock grant", async () => {
    canvas.dispatchEvent(new Event("click"));
    canvas.dispatchEvent(new Event("click"));
    expect(canvas.requestCount).toBe(1);
    const unloading = controls.unload();
    expect(controls.unload()).toBe(unloading);
    canvas.grantLock();
    await unloading;

    expect(canvas.ownerDocument.pointerLockElement).toBeNull();
    expect(canvas.ownerDocument.exitCount).toBe(1);
    canvas.dispatchEvent(new Event("click"));
    expect(canvas.requestCount).toBe(1);
    expect(key("keydown", "KeyW").defaultPrevented).toBe(false);
    expect(controls.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });
});
