/**
 * Purpose: Verify precedence between desktop and M5 flight sources.
 * Context: Exactly one source may move the rig in a render frame.
 * Responsibility: Cover desktop fallback and configured-device precedence.
 * Boundary: Device polling and the ICAROS movement equations are tested separately.
 */

import { expect, test } from "bun:test";
import { Group } from "three";
import { createFlightControlSource } from "../../src/control/flight-control-source";
import { createNeutralControl } from "../../src/m5/control-frame";

test("desktop updates when no M5 host supplies a frame", () => {
  let desktopDelta = 0;
  const control = createFlightControlSource(
    new Group(),
    { update: (deltaSeconds) => (desktopDelta = deltaSeconds) },
    { readFrame: () => undefined },
  );

  control.update(0.25);

  expect(desktopDelta).toBe(0.25);
});

test("an M5 frame takes exclusive control of the rig", () => {
  const rig = new Group();
  let desktopUpdates = 0;
  const control = createFlightControlSource(
    rig,
    { update: () => desktopUpdates++ },
    { readFrame: () => createNeutralControl() },
  );

  control.update(1);

  expect(desktopUpdates).toBe(0);
  expect(rig.position.z).toBeLessThan(0);
});
