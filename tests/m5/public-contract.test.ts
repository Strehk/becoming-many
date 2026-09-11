import { expectTypeOf, test } from "bun:test";
import type {
  FlightInput,
  FlightInputSource,
} from "../../src/control/control-contract";
import type { Run } from "../../src/levels/run-contract";
import type { M5Observation, M5Runtime } from "../../src/m5/m5-contract";
import type { SerialSetupChannel } from "../../src/m5/setup/serial-setup";

// Type checking enforces capabilities; Bun alone does not validate these types.
test("M5 supplies flight input while UI observes only device facts", () => {
  expectTypeOf<M5Runtime>().toExtend<FlightInputSource>();
  expectTypeOf<M5Runtime["readInput"]>().returns.toEqualTypeOf<
    Readonly<FlightInput>
  >();
  expectTypeOf<NonNullable<Run["m5"]>>().toEqualTypeOf<
    Pick<M5Runtime, "setHost" | "readObservation">
  >();
  expectTypeOf<NonNullable<Run["m5"]>>().not.toHaveProperty("readInput");
  expectTypeOf<M5Observation>().not.toHaveProperty("control");
  expectTypeOf<M5Runtime>().not.toHaveProperty("consumeFrame");
  expectTypeOf<SerialSetupChannel["send"]>().returns.toEqualTypeOf<
    Promise<void>
  >();
  expectTypeOf<SerialSetupChannel["close"]>().returns.toEqualTypeOf<
    Promise<void>
  >();
});
