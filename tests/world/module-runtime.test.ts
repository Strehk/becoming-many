/**
 * Purpose: Verify the module lifecycle, including running a module unseen.
 * Context: A show warms the layer a sense reveals before it may be looked at.
 * Responsibility: Cover every transition, what update reaches, and idempotence.
 * Boundary: What a concrete module builds while warming is that module's test.
 */

import { describe, expect, test } from "bun:test";
import {
  ModuleRuntime,
  type WorldModule,
} from "../../src/world/module-runtime";

interface RecordedModule {
  readonly module: WorldModule;
  readonly calls: string[];
  readonly updates: () => number;
}

function recordModule(): RecordedModule {
  const calls: string[] = [];
  let updates = 0;

  return {
    calls,
    updates: () => updates,
    module: {
      load: () => calls.push("load"),
      activate: () => calls.push("activate"),
      update: () => {
        updates += 1;
      },
      deactivate: () => calls.push("deactivate"),
      unload: () => calls.push("unload"),
    },
  };
}

describe("ModuleRuntime", () => {
  test("loads a module once and leaves it inactive", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.load(recorded.module);
    runtime.update(0.016);

    expect(recorded.calls).toEqual(["load"]);
    expect(recorded.updates()).toBe(0);
  });

  test("runs a warming module without showing it", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.warm(recorded.module);
    runtime.update(0.016);
    runtime.update(0.016);

    expect(recorded.calls).toEqual(["load"]);
    expect(recorded.updates()).toBe(2);
  });

  test("shows a warm module without loading or updating it again", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.warm(recorded.module);
    runtime.activate(recorded.module);
    runtime.update(0.016);

    expect(recorded.calls).toEqual(["load", "activate"]);
    expect(recorded.updates()).toBe(1);
  });

  test("keeps an active module running when it is warmed again", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.activate(recorded.module);
    runtime.warm(recorded.module);
    runtime.update(0.016);

    expect(recorded.calls).toEqual(["load", "activate", "deactivate"]);
    expect(recorded.updates()).toBe(1);
  });

  test("stops a warming module without putting away what was never shown", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.warm(recorded.module);
    runtime.deactivate(recorded.module);
    runtime.update(0.016);

    expect(recorded.calls).toEqual(["load"]);
    expect(recorded.updates()).toBe(0);
  });

  test("repeats no transition it already stands in", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.activate(recorded.module);
    runtime.activate(recorded.module);
    runtime.deactivate(recorded.module);
    runtime.deactivate(recorded.module);

    expect(recorded.calls).toEqual(["load", "activate", "deactivate"]);
  });

  test("touches nothing it has not loaded", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.warm(recorded.module);
    runtime.activate(recorded.module);
    runtime.deactivate(recorded.module);
    runtime.update(0.016);

    expect(recorded.calls).toEqual([]);
    expect(recorded.updates()).toBe(0);
  });

  test("puts a module away before unloading it", () => {
    const runtime = new ModuleRuntime();
    const recorded = recordModule();

    runtime.load(recorded.module);
    runtime.activate(recorded.module);
    runtime.unload(recorded.module);
    runtime.update(0.016);

    expect(recorded.calls).toEqual([
      "load",
      "activate",
      "deactivate",
      "unload",
    ]);
    expect(recorded.updates()).toBe(0);
  });
});
