/**
 * Purpose: Let the menu's particle work run inside the real experience.
 * Context: In the app the menu does not own a renderer: the Show's Run starts
 *   behind it in a prelude and lends its world through Run.stage. This adapter
 *   gives that stage the shape the borrowing, the title and the pointer
 *   effects expect of a world.
 * Responsibility: Camera, scene, renderer and overlay from the stage, and
 *   frame hooks with their timing.
 * Boundary: The Run owns everything it lends; nothing here disposes it.
 */

export function createStageWorld(run) {
  const stage = run.stage;
  const hooks = [];
  stage.onFrame((deltaSeconds) => {
    const now = performance.now() / 1000;
    for (const hook of hooks) hook(deltaSeconds, now, deltaSeconds);
  });
  return {
    camera: stage.camera,
    scene: stage.scene,
    renderer: stage.renderer,
    overlay: stage.overlay,
    onFrame(hook) {
      hooks.push(hook);
    },
  };
}
