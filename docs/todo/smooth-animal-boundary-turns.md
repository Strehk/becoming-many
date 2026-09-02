<!--
Purpose: Track the abrupt animal direction changes at habitat boundaries.
Context: Animals share one bounded movement rule that prevents entry into disallowed world zones.
Responsibility: Record the confirmed cause, smallest viable correction, simplification constraints, and acceptance criteria.
Boundary: This issue does not introduce pathfinding, flocking, or a general steering system.
-->

# Smooth Animal Boundary Turns

- **Status:** Open
- **Priority:** Behavior defect
- **Affected area:** Animals
- **Found:** 2026-09-02

## Problem

Animals visibly snap to a new direction when they reach the boundary of a zone
their species may not enter. A turn should be continuous and independent of the
render frame rate while the existing habitat restriction remains intact.

This is a shared behavior defect, not an asset or animation defect. Deer, Stag,
Fox, and Rat all use the same movement function.

## Diagnosis

`moveActor()` in
[`animal-actors.ts`](../../src/modules/animals/animal-actors.ts) calculates the
next position from the current heading. When `zoneAt()` classifies that position
as disallowed, the actor does not move and its heading changes immediately by
`TURN_RADIANS`:

```ts
const TURN_RADIANS = 2.2;

actor.headingRadians += TURN_RADIANS;
return;
```

`2.2` radians are approximately 126 degrees. The same frame then passes that
new heading to `alignToSurface()`, which applies it directly to the actor's
quaternion. The complete 126-degree turn therefore becomes visible in one
frame. If the new direction is also disallowed, another 126-degree change can
follow on the next frame.

The hard change returned by `zoneAt()` is expected: the world surface exposes a
single `ZoneId`, and every animal species declares its allowed subset. The
defect is the frame-sized steering response to that boundary, not the zone
classification itself.

The current animal tests cover lifecycle, visibility bounds, placement, and
surface alignment. They do not cover turn continuity or frame-rate-independent
steering.

Two other abrupt behaviors exist but are separate concerns:

- an actor outside the 96-metre active radius is relocated to a new habitat;
- the four visible slots can select a different actor as distances change.

Neither changes the heading of one actor by 126 degrees in a frame. Do not fold
visibility hysteresis or relocation work into this fix without separate visual
evidence.

## Affected Files

- `src/modules/animals/animal-actors.ts`
- `tests/modules/animals.test.ts`
- `src/modules/animals/README.md` only if the documented movement rule changes

## Smallest Viable Fix

Replace the fixed turn amount with one frame-rate-independent turn rate and use
the `deltaSeconds` already owned by `moveActor()`:

```ts
const TURN_SPEED_RADIANS_PER_SECOND = 2.2;

actor.headingRadians += TURN_SPEED_RADIANS_PER_SECOND * deltaSeconds;
return;
```

Using `2.2` as the initial rate preserves the previous authored turn magnitude
as a one-second turn instead of a one-frame jump. It is a starting value for
visual acceptance, not a claim that every species needs a distinct rate.

While the next point remains disallowed, the actor turns smoothly in place. As
soon as its current heading produces an allowed next point, the existing code
continues movement. The same `headingRadians` continues to drive both movement
and surface-aligned rendering, so the body cannot visually face one way while
sliding another way.

## YAGNI and Simplification

The fix should replace the current constant and one update expression. It needs
no new runtime contract, dependency, allocation, module, or actor state.

Specifically, do not add:

- `targetHeadingRadians` or separate logical and rendered headings;
- quaternion damping that masks the snap while movement still turns instantly;
- pathfinding, boids, obstacle maps, or a generic steering abstraction;
- random turn selection, angle normalization, or per-species turn settings;
- boundary look-ahead or habitat hysteresis before evidence shows they are
  necessary.

This keeps `headingRadians` as the single source of truth and makes the existing
movement rule time-based in the same way as forward speed. If a later visual
test shows that animals react too late at the exact boundary, a short look-ahead
can be considered as a separate measured refinement.

Large animation-loop deltas should not be clamped locally in Animals. Forward
movement uses the same delta, so any maximum simulation step belongs at the
shared frame-time boundary if it becomes a demonstrated system-wide problem.

## Verification

Add one focused regression test using a surface that accepts the actor's initial
habitat point but rejects attempted forward movement. Observe headings through
the existing `onBodiesUpdated` contract and verify:

- no single normal-frame update changes the heading by the former 2.2 radians;
- while movement remains blocked for the full test, simulating the same
  duration with 30 and 90 updates produces the same final heading within
  floating-point tolerance;
- the blocked actor remains inside its allowed zone while turning;
- movement resumes once the current heading points into an allowed zone.

Use a separate threshold-crossing test for resumed movement. Because the first
allowed step is discrete, its final heading may differ by at most one update's
turn (`turnRate * largestDeltaSeconds`); do not require exact equality across
frame rates after that threshold.

Then verify the real animal models in the browser at normal desktop frame rates
and through the Windows-to-PICO PCVR path at the 90 FPS target. Turning should
be continuous, with no visible sideways slide or zone crossing.

Run `bun test`, `bun run check`, `bun run lint`, `bun run build`, and Fallow
before a checkpoint.
