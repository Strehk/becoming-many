import { expectTypeOf, test } from "bun:test";
import type { Run } from "../../src/levels/run-contract";
import type { RunningShow } from "../../src/levels/show-contract";
import type { ConductorPageOptions } from "../../src/ui/conductor/conductor.page";
import type { LanguagePanelOptions } from "../../src/ui/conductor/language.panel";

// These assertions run during type checking; Bun does not inspect TS contracts.
test("operator capabilities exclude consuming input and child cleanup", () => {
  expectTypeOf<NonNullable<Run["m5"]>>().toHaveProperty("setHost");
  expectTypeOf<NonNullable<Run["m5"]>>().not.toHaveProperty("readInput");
  expectTypeOf<NonNullable<Run["m5"]>>().not.toHaveProperty("unload");
  expectTypeOf<Run["xr"]>().toHaveProperty("start");
  expectTypeOf<Run["xr"]>().not.toHaveProperty("unload");
  expectTypeOf<RunningShow>().toHaveProperty("togglePlayback");
  expectTypeOf<RunningShow>().not.toHaveProperty("clock");

  expectTypeOf<ConductorPageOptions["run"]>().toHaveProperty(
    "resetShowAndFlight",
  );
  expectTypeOf<ConductorPageOptions["run"]>().not.toHaveProperty("unload");
  expectTypeOf<
    NonNullable<ConductorPageOptions["run"]["show"]>
  >().not.toHaveProperty("clock");
  expectTypeOf<ConductorPageOptions["xr"]>().not.toHaveProperty("unload");
  expectTypeOf<NonNullable<ConductorPageOptions["m5"]>>().not.toHaveProperty(
    "readInput",
  );
  expectTypeOf<NonNullable<ConductorPageOptions["m5"]>>().not.toHaveProperty(
    "unload",
  );
});

test("operator language remains independent of main Show availability", () => {
  expectTypeOf<ConductorPageOptions>().not.toHaveProperty("show");
  expectTypeOf<ConductorPageOptions["run"]["readLanguage"]>().toEqualTypeOf<
    Run["readLanguage"]
  >();
  expectTypeOf<ConductorPageOptions["run"]["setLanguage"]>().toEqualTypeOf<
    Run["setLanguage"]
  >();
  expectTypeOf<ConductorPageOptions["run"]["readTutorial"]>().toEqualTypeOf<
    Run["readTutorial"]
  >();
  expectTypeOf<ConductorPageOptions["run"]["skipTutorial"]>().toEqualTypeOf<
    Run["skipTutorial"]
  >();
  expectTypeOf<LanguagePanelOptions["run"]>().toEqualTypeOf<
    Pick<Run, "setLanguage">
  >();
  expectTypeOf<LanguagePanelOptions>().not.toHaveProperty("show");
  expectTypeOf<LanguagePanelOptions>().not.toHaveProperty("readShow");
});
