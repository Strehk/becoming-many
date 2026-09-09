import { expect, test } from "bun:test";
import type { WebGLRenderer } from "three";
import { mirrorXrFrame } from "../../src/world/xr-mirror";

test("XR mirror copies a whole eye once and restores the borrowed target on failure", () => {
  const operations: unknown[][] = [];
  const target = {};
  let fail = false;
  const renderer = {
    xr: {
      isPresenting: false,
      getCamera: () => ({
        cameras: [{ viewport: { x: 100, y: 0, z: 800, w: 800 } }],
      }),
    },
    getContext: () => ({
      drawingBufferWidth: 1280,
      drawingBufferHeight: 720,
      DRAW_FRAMEBUFFER: 1,
      COLOR_BUFFER_BIT: 2,
      LINEAR: 3,
      blitFramebuffer: (...args: unknown[]) => {
        operations.push(["blit", ...args]);
        if (fail) throw new Error("copy failed");
      },
    }),
    getRenderTarget: () => target,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    state: {
      bindFramebuffer: (...args: unknown[]) =>
        operations.push(["bind", ...args]),
      setScissorTest: (...args: unknown[]) =>
        operations.push(["scissor", ...args]),
    },
    clear: (...args: unknown[]) => operations.push(["clear", ...args]),
    setRenderTarget: (...args: unknown[]) =>
      operations.push(["restore", ...args]),
  };
  const worldRenderer = renderer as unknown as WebGLRenderer;
  mirrorXrFrame(worldRenderer);
  expect(operations).toEqual([]);
  renderer.xr.isPresenting = true;
  mirrorXrFrame(worldRenderer);
  expect(operations).toEqual([
    ["bind", 1, null],
    ["scissor", false],
    ["clear", true, false, false],
    ["blit", 100, 0, 900, 800, 280, 0, 1000, 720, 2, 3],
    ["restore", target, 0, 0],
  ]);
  fail = true;
  expect(() => mirrorXrFrame(worldRenderer)).toThrow("copy failed");
  expect(operations.at(-1)).toEqual(["restore", target, 0, 0]);
});
