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
    const state = this.states.get(module);
    if (state) return;

    this.states.set(module, "inactive");
    module.load();
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

  unload(module: WorldModule): void {
    if (!this.states.has(module)) return;
    const errors: unknown[] = [];
    try {
      this.deactivate(module);
    } catch (error) {
      errors.push(error);
    }
    this.states.delete(module);
    try {
      module.unload();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError(errors, "Module cleanup failed");
  }
  // Procedural chunk work uses the separate world StreamQueue. Keeping it out
  // of this class prevents module lifecycle and spatial streaming from mixing.
}
