/**
 * Purpose: Coordinate the shared lifecycle of unloadable world modules.
 * Context: The permanent world runtime needs one place to track module state.
 * Responsibility: Run synchronous lifecycle transitions and active updates.
 * Boundary: Concrete modules own resources; levels only describe desired state.
 */

export interface WorldModule {
  readonly load: () => void;
  /** Put the module's content on screen. Never the place to build it. */
  readonly activate: () => void;
  /**
   * Advance the module. Called while it is warming as well as while it is
   * active, so a module builds, streams, and simulates the same way whether or
   * not it is currently seen. Nothing here may depend on its own visibility.
   */
  readonly update?: (deltaSeconds: number) => void;
  readonly deactivate: () => void;
  readonly unload: () => void;
}

/**
 * `warming` runs the module without showing it: its content builds and follows
 * the viewer while nothing of it is drawn. A show uses it to stand a layer up
 * before the sense that reveals it, so the fade raises finished content
 * instead of content still arriving.
 */
type ModuleState = "inactive" | "warming" | "active";

/**
 * Public lifecycle coordinator used by the Level Runtime composition root.
 */
export class ModuleRuntime {
  private readonly states = new Map<WorldModule, ModuleState>();

  load(module: WorldModule): void {
    if (this.states.has(module)) return;

    module.load();
    this.states.set(module, "inactive");
  }

  /**
   * Run a loaded module without showing it. Coming back from active — a seek
   * to before the cue — puts its content away and keeps it running, so the
   * layer is warm again wherever the scrub lands next.
   */
  warm(module: WorldModule): void {
    const state = this.states.get(module);
    if (state === undefined || state === "warming") return;

    if (state === "active") module.deactivate();
    this.states.set(module, "warming");
  }

  activate(module: WorldModule): void {
    const state = this.states.get(module);
    if (state === undefined || state === "active") return;

    module.activate();
    this.states.set(module, "active");
  }

  update(deltaSeconds: number): void {
    for (const [module, state] of this.states) {
      if (state !== "inactive") module.update?.(deltaSeconds);
    }
  }

  deactivate(module: WorldModule): void {
    const state = this.states.get(module);
    if (state === undefined || state === "inactive") return;

    if (state === "active") module.deactivate();
    this.states.set(module, "inactive");
  }

  // Part of the explicit lifecycle API; modules must remain fully unloadable.
  // fallow-ignore-next-line unused-class-member
  unload(module: WorldModule): void {
    if (!this.states.has(module)) return;

    this.deactivate(module);
    module.unload();
    this.states.delete(module);
  }

  // Future: support asynchronous load transitions without blocking activation.

  // Procedural chunk work uses the separate world StreamQueue. Keeping it out
  // of this class prevents module lifecycle and spatial streaming from mixing.
}
