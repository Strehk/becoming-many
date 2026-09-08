import { expectTypeOf, test } from "bun:test";
import type { ConductorPageOptions } from "../../src/ui/conductor/conductor.page";
import type { Run } from "../../src/levels/level.runtime";
import type { RunningShow } from "../../src/levels/show.runtime";

// These assertions run during type checking; Bun does not inspect TS contracts.
test("operator capabilities exclude consuming input and child cleanup", () => {
  expectTypeOf<NonNullable<Run["m5"]>>().toHaveProperty("setHost");
  expectTypeOf<NonNullable<Run["m5"]>>().not.toHaveProperty("consumeFrame");
  expectTypeOf<NonNullable<Run["m5"]>>().not.toHaveProperty("unload");
  expectTypeOf<Run["xr"]>().toHaveProperty("start");
  expectTypeOf<Run["xr"]>().not.toHaveProperty("unload");
  expectTypeOf<RunningShow>().toHaveProperty("togglePlayback");
  expectTypeOf<RunningShow>().not.toHaveProperty("clock");

  expectTypeOf<ConductorPageOptions["run"]>().toHaveProperty(
    "resetShowAndFlight",
  );
  expectTypeOf<ConductorPageOptions["run"]>().not.toHaveProperty("unload");
  expectTypeOf<ConductorPageOptions["show"]>().not.toHaveProperty("clock");
  expectTypeOf<ConductorPageOptions["xr"]>().not.toHaveProperty("unload");
  expectTypeOf<NonNullable<ConductorPageOptions["m5"]>>().not.toHaveProperty(
    "consumeFrame",
  );
  expectTypeOf<NonNullable<ConductorPageOptions["m5"]>>().not.toHaveProperty(
    "unload",
  );
});
