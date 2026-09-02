<!--
Purpose: Track unverified cross-module effects of changing the shared wind source.
Context: A Scent change increased global wind while Grass also consumes it.
Responsibility: Make shared-setting changes validate every active consumer.
Boundary: This does not split the shared wind or add per-module copies.
-->

# Validate Every Consumer of Shared Wind Changes

**Status:** Open
**Priority:** Regression prevention

## Problem

Commit `4b2ffbb` increased shared wind strength for Scent and explicitly noted
that Grass had not been checked. Central ownership is correct, but its change
was accepted without validating all consumers.

## Affected Files

- `src/world/wind.ts`
- `src/modules/scent-particles/scent-particles.ts`
- `src/modules/grass/grass-field.ts`
- `tests/world/wind.test.ts`
- `tests/modules/grass.test.ts`

## Smallest YAGNI Solution

Add one focused Grass assertion that the maximum authored wind keeps blade bend
inside its supported visual range, and record a visual check when `world/wind.ts`
changes. Keep one shared wind source. Do not introduce per-module wind settings
or a dependency graph tool.

## Verification

Run Wind, Grass, and Scent tests and inspect the strongest gust in the browser.
