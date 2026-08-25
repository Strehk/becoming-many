/**
 * Purpose: Coordinate the shared lifecycle of unloadable world modules.
 * Context: The permanent world runtime needs one place to track module state.
 * Responsibility: Run synchronous lifecycle transitions and active updates.
 * Boundary: Concrete modules own resources; levels only describe desired state.
 */

export interface WorldModule {
  readonly load: () => void;
  readonly activate: () => void;
  readonly update?: (deltaSeconds: number) => void;
  readonly deactivate: () => void;
  readonly unload: () => void;
}

type ModuleState = "inactive" | "active";

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

  activate(module: WorldModule): void {
    if (this.states.get(module) !== "inactive") return;

    module.activate();
    this.states.set(module, "active");
  }

  update(deltaSeconds: number): void {
    for (const [module, state] of this.states) {
      if (state === "active") module.update?.(deltaSeconds);
    }
  }

  deactivate(module: WorldModule): void {
    if (this.states.get(module) !== "active") return;

    module.deactivate();
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

  // Future: prefetch resources before load when upcoming level cues are known.
  // Future: support asynchronous load transitions without blocking activation.

  // Procedural chunk work uses the separate world StreamQueue. Keeping it out
  // of this class prevents module lifecycle and spatial streaming from mixing.
}
