import { expectTypeOf, test } from "bun:test";
import type { Run } from "../../src/levels/level.runtime";
import type { ControlFrame } from "../../src/m5/control-frame";
import type { M5Observation, M5Runtime } from "../../src/m5/runtime/m5.runtime";
import type { SerialSetupChannel } from "../../src/m5/setup/serial-setup";

// Type checking enforces capabilities; Bun alone does not validate these types.
test("M5 consumers observe without acquiring device lifetime or button consumption", () => {
  expectTypeOf<NonNullable<Run["m5"]>>().toEqualTypeOf<
    Pick<M5Runtime, "setHost" | "readObservation">
  >();
  expectTypeOf<NonNullable<M5Observation["control"]>>().toEqualTypeOf<
    Readonly<Pick<ControlFrame, "pitch" | "roll" | "quality">>
  >();
  expectTypeOf<ControlFrame>().not.toHaveProperty("host");
  expectTypeOf<ControlFrame>().not.toHaveProperty("firmwareVersion");
  expectTypeOf<SerialSetupChannel["send"]>().returns.toEqualTypeOf<
    Promise<void>
  >();
  expectTypeOf<SerialSetupChannel["close"]>().returns.toEqualTypeOf<
    Promise<void>
  >();
});
