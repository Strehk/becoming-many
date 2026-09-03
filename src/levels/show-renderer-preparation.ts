/**
 * Purpose: Complete first-use GPU setup before the narrated show becomes visible.
 * Context: Shader compilation alone does not upload geometry and textures for later senses.
 * Responsibility: Compile and render the composed world once into a disposable target.
 * Boundary: This file does not advance show time, simulation, controls, or narration.
 */

import {
  type Camera,
  type Scene,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

interface ShowRenderWorld {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: Camera;
}

export async function prepareShowRenderer(
  world: ShowRenderWorld,
): Promise<void> {
  await world.renderer.compileAsync(world.scene, world.camera);
  renderComposedWorldOffscreen(world);
}

function renderComposedWorldOffscreen(world: ShowRenderWorld): void {
  const { renderer, scene, camera } = world;
  const previousTarget = renderer.getRenderTarget();
  const previousCubeFace = renderer.getActiveCubeFace();
  const previousMipmapLevel = renderer.getActiveMipmapLevel();
  const target = new WebGLRenderTarget(1, 1);
  target.texture.colorSpace = renderer.outputColorSpace;

  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(
      previousTarget,
      previousCubeFace,
      previousMipmapLevel,
    );
    target.dispose();
  }
}
