import type { WebGLRenderer } from "three";

/** Copy the rendered left eye inside its XR frame without drawing the scene again. */
export function mirrorXrFrame(renderer: WebGLRenderer): void {
  if (!renderer.xr.isPresenting) return;
  const eye = renderer.xr.getCamera().cameras[0];
  if (!eye) return;
  const source = eye.viewport;
  // World creates WebGL2 explicitly; the Three.js type still includes WebGL1.
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (source.z === 0 || source.w === 0 || width === 0 || height === 0) return;

  const target = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const mip = renderer.getActiveMipmapLevel();
  const scale = Math.min(width / source.z, height / source.w);
  const destinationWidth = Math.round(source.z * scale);
  const destinationHeight = Math.round(source.w * scale);
  const x = Math.floor((width - destinationWidth) / 2);
  const y = Math.floor((height - destinationHeight) / 2);

  try {
    // The rendered XR framebuffer remains bound for reading. Binding only DRAW
    // preserves it, including projection-layer targets owned by Three.js.
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    renderer.state.setScissorTest(false);
    renderer.clear(true, false, false);
    gl.blitFramebuffer(
      source.x,
      source.y,
      source.x + source.z,
      source.y + source.w,
      x,
      y,
      x + destinationWidth,
      y + destinationHeight,
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR,
    );
  } finally {
    // Restore Three.js's framebuffer, viewport and scissor caches together.
    renderer.setRenderTarget(target, face, mip);
  }
}
