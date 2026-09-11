import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Euler, Group, type PerspectiveCamera, Quaternion } from "three";
import type { DesktopController } from "../../src/control/control-contract";
import { createDesktopController } from "../../src/control/desktop-controller";
import { createFlightControl } from "../../src/control/flight-control";
import { createViewerRig } from "../../src/world/viewer-rig";

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
let viewer: ReturnType<typeof createViewerRig>;
let controls: DesktopController;

beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  keyboard = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: keyboard,
  });
  canvas = new PointerLockCanvas();
  viewer = createViewerRig(30);
  camera = viewer.camera;
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
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
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
    expect(controls.readInput(1)).toEqual(expected);
    expect(key("keyup", code).defaultPrevented).toBe(true);
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test("keeps aliases held and cancels opposing keys", () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    key("keydown", "ArrowUp");
    key("keyup", "KeyW");
    expect(controls.readInput(1).forwardTilt).toBe(1);
    key("keydown", "KeyS");
    expect(controls.readInput(1).forwardTilt).toBe(0);
    key("keyup", "ArrowUp");
    expect(controls.readInput(1).forwardTilt).toBe(-1);
    key("keyup", "KeyS");
    expect(controls.readInput(1).forwardTilt).toBe(0);
  });

  test("key repeat never advances or interrupts the other axis", () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    controls.readInput(1);
    key("keyup", "KeyW");
    const returning = controls.readInput(1 / 60).forwardTilt;
    expect(returning).toBeGreaterThan(0);
    key("keydown", "KeyD");
    key("keydown", "KeyD");
    expect(controls.readInput(0).forwardTilt).toBe(returning);
    expect(controls.readInput(1 / 60).forwardTilt).toBeLessThan(returning);
  });

  test.each([
    ["pitch", "KeyW", "KeyS", "x", -1],
    ["bank", "KeyD", "KeyA", "z", -1],
  ] as const)(
    "%s remains continuous through press, hold, release and reversal",
    (_name, press, reverse, axis, sign) => {
      const flight = createFlightControl(viewer.group, [controls]);
      const orientation = new Quaternion();
      const angles = new Euler(0, 0, 0, "YXZ");
      const frame = (): number => {
        viewer.beginFrame();
        flight.update(1 / 60);
        viewer.publish();
        viewer.camera.getWorldQuaternion(orientation);
        return angles.setFromQuaternion(orientation, "YXZ")[axis];
      };
      canvas.grantLock();
      key("keydown", press);
      let previous = frame();
      expect(previous * sign).toBeGreaterThan(0);
      expect(Math.abs(previous)).toBeLessThan(Math.PI / 36);
      for (let index = 0; index < 60; index++) previous = frame();
      const held = previous;
      expect(Math.abs(held)).toBeGreaterThan(Math.PI / 18);
      expect(Math.abs(held)).toBeLessThan(Math.PI / 3);
      expect(frame()).toBeCloseTo(held);
      if (axis === "z") expect(viewer.viewpoint.worldUp.y).toBeLessThan(0.99);
      else expect(viewer.group.position.y).toBeLessThan(0);

      key("keyup", press);
      let released = frame();
      expect(Math.abs(released)).toBeLessThan(Math.abs(held));
      expect(Math.abs(released)).toBeGreaterThan(0);
      expect(Math.abs(released - held)).toBeLessThan(Math.PI / 36);
      key("keydown", reverse);
      for (let index = 0; index < 90; index++) {
        const next = frame();
        expect(Math.abs(next - released)).toBeLessThan(Math.PI / 36);
        released = next;
      }
      expect(released * sign).toBeLessThan(0);
      key("keyup", reverse);
      for (let index = 0; index < 60; index++) frame();
      expect(frame()).toBeCloseTo(0);
    },
  );

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

    expect(viewerRig.quaternion.angleTo(new Quaternion())).toBeCloseTo(0);
    expect(viewerRig.position.x).toBeCloseTo(0);
    expect(viewerRig.position.z).toBeLessThan(0);
  });

  test("clears held input on blur, pointer-lock loss, and unload", async () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    keyboard.dispatchEvent(new Event("blur"));
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
    key("keydown", "KeyD");
    canvas.ownerDocument.exitPointerLock();
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
    canvas.grantLock();
    key("keydown", "KeyS");
    await controls.unload();
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
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
    expect(controls.readInput(1)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });
});
