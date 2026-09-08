import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Group, PerspectiveCamera } from "three";
import {
  createDesktopControls,
  type DesktopControls,
} from "../../src/control/desktop-controls.runtime";

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
let rig: Group;
let controls: DesktopControls;

beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  keyboard = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: keyboard,
  });
  canvas = new PointerLockCanvas();
  camera = new PerspectiveCamera();
  rig = new Group();
  rig.add(camera);
  controls = createDesktopControls(
    camera,
    rig,
    canvas as unknown as HTMLElement,
  );
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

describe("desktop controls", () => {
  test("leaves typing and cursor keys alone without pointer lock", () => {
    for (const code of [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
    ]) {
      expect(key("keydown", code).defaultPrevented).toBe(false);
      expect(key("keyup", code).defaultPrevented).toBe(false);
    }
    key("keydown", "KeyW");
    canvas.grantLock();
    controls.update(1);
    expect(rig.position.length()).toBe(0);
  });

  test("moves the rig along camera look at normalized diagonal speed", () => {
    camera.rotation.y = Math.PI / 2;
    canvas.grantLock();
    expect(key("keydown", "KeyW").defaultPrevented).toBe(true);
    expect(key("keydown", "ArrowRight").defaultPrevented).toBe(true);
    expect(key("keydown", "Space").defaultPrevented).toBe(false);
    controls.update(0.5);
    expect(rig.position.length()).toBeCloseTo(10);
    expect(rig.position.x).toBeCloseTo(-10 / Math.SQRT2);
    expect(rig.position.z).toBeCloseTo(-10 / Math.SQRT2);
    expect(camera.position.length()).toBe(0);
    expect(key("keyup", "KeyW").defaultPrevented).toBe(true);
    key("keyup", "ArrowRight");
    const stoppedPosition = rig.position.clone();
    controls.update(1);
    expect(rig.position.equals(stoppedPosition)).toBe(true);
  });

  test("clears held movement when lock is lost before it is reacquired", () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    canvas.ownerDocument.exitPointerLock();
    expect(key("keyup", "KeyW").defaultPrevented).toBe(false);
    canvas.grantLock();
    controls.update(1);
    expect(rig.position.length()).toBe(0);
  });

  test("clears held movement on window blur", () => {
    canvas.grantLock();
    key("keydown", "KeyW");
    keyboard.dispatchEvent(new Event("blur"));
    controls.update(1);
    expect(rig.position.length()).toBe(0);
  });

  test("unloads once and releases a lock granted after cleanup begins", async () => {
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
    canvas.grantLock();
    expect(key("keydown", "KeyW").defaultPrevented).toBe(false);
    const initialLook = camera.quaternion.clone();
    canvas.ownerDocument.dispatchEvent(
      Object.assign(new Event("mousemove"), { movementX: 100, movementY: 100 }),
    );
    controls.update(1);
    expect(camera.quaternion.equals(initialLook)).toBe(true);
    expect(rig.position.length()).toBe(0);
  });
});
