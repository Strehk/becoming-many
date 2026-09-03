<!--
Purpose: Track misleading M5 control naming, an inconsistent pitch contract, and avoidable implementation noise.
Context: The current M5 flight path is small, but comments compensate for unclear names and contradictory axis semantics.
Responsibility: Define the smallest cleanup that makes the existing behavior explicit and precisely tested.
Boundary: This does not implement shared navigation state, the XR flight rig, control-source arbitration, or new button behavior.
-->

# Simplify the M5 Control Contract

**Status:** Open

**Priority:** Correctness and maintainability
**Issue:** [#38](https://github.com/Strehk/becoming-many/issues/38)

## Problem

`desktop-controls.ts` captures browser input, owns mutable key and pointer-lock
state, and moves the camera. `m5-flight.ts` only applies one already-produced
M5 frame to the camera. The neighboring names suggest equivalent control
adapters even though the files have different responsibilities, while the M5
name emphasizes the flight model rather than the control path.

The axis contract is also contradictory. `M5State.pitch` is documented as
forward-positive, `ControlFrame.pitch` says positive values climb, and the
flight implementation plus its test make negative pitch climb. The local
`steeringPitch` and `steeringRoll` variables and their long polarity comment
hide that disagreement instead of expressing one authoritative mapping.

The implementation carries additional noise:

- `controllerType` can only be `"m5"` and has no reader.
- `steeringRoll` is negated and then immediately negated again for yaw.
- Rate names omit their units and the horizontal-direction threshold is an
  unexplained literal.
- Line-by-line comments repeat operations that focused names can express.
- The tests check mostly signs and non-zero movement, despite claiming to
  protect the exact flight rates and mapping.

The runtime's device branch is a separate architectural concern. The approved
shared navigation boundary belongs with the control-source extraction already
tracked in `level-runtime-responsibilities.md`; expanding this cleanup into a
new navigation framework would mix scopes.

## Affected Files

- `src/control/m5-flight.ts`
- `src/control/README.md`
- `src/m5/control-frame.ts`
- `src/m5/README.md`
- `src/m5/m5-settings.ts`
- `src/m5/state-frames.ts`
- `src/levels/level-runtime.ts`
- `tests/control/m5-flight.test.ts`
- `tests/m5/auto-neutralize.test.ts`
- `docs/architecture.md`
- `docs/current-status.md`
- `docs/direction/controls-m5.md`
- `docs/todo/xr-flight-rig.md`

## Smallest YAGNI Solution

1. Make the existing physical-axis convention authoritative: M5 pitch is
   forward-positive and roll is right-positive. Keep the flight-specific
   conversion at the flight boundary and name the resulting values by intent,
   such as `climbInput` and `turnInput`.
2. Rename `m5-flight.ts` to `m5-controls.ts`, its public update function and
   mirrored test accordingly. Keep one direct function; do not add a factory,
   class, shared controls interface, or lifecycle to stateless code merely to
   imitate `createDesktopControls()`.
3. Replace the double roll negation, give rate constants unit-bearing names,
   name the minimum horizontal direction length, and retain the allocation-free
   module scratch objects.
4. Remove `controllerType` from `ControlFrame` and its constructors. It is a
   one-value discriminant without a union or consumer.
5. Keep only the required file header, short tunable rationale, and one concise
   explanation of the world-up quaternion composition. Let names describe the
   remaining arithmetic.
6. Tighten the existing tests to assert exact glide distance, climb distance,
   yaw magnitude and direction, level horizon, and persistent heading for both
   input signs.

Keep the existing quality and button transport unchanged. Quality drives
safety, smoothing, liveness, and operator status. Button edges have a concrete
planned tutorial consumer, and removing them from the firmware/protocol would
require unrelated firmware and compatibility work. The flight update should
continue to ignore fields it does not use.

Do not add `FlightInput`, `NavigationState`, strategy objects, a generic
locomotion engine, or a second control selector in this issue. Those concepts
should land only with the already approved end-to-end navigation boundary and
a concrete consumer.

## Verification

- Run the focused M5 and control tests after the rename and contract cleanup.
- Confirm the TypeScript compiler finds every renamed import and every removed
  `controllerType` assignment.
- Run the full test, typecheck, lint, build, and Fallow gates.
- Confirm the exact steering polarity on the physical calibrated rig; automated
  tests can preserve a chosen convention but cannot prove the mounting
  direction.
