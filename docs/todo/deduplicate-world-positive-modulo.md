<!--
Purpose: Track the duplicated positive-modulo calculation in world chunk windows.
Context: Flat and volumetric slot mapping use the same negative-safe arithmetic.
Responsibility: Keep one domain-owned implementation for stable finite-slot mapping.
Boundary: This does not change folders, chunk contracts, slot layouts, or public architecture.
-->

# Deduplicate Positive Modulo Inside the World Domain

**Status:** Open

**Priority:** Cleanup
**Issue:** [#39](https://github.com/Strehk/becoming-many/issues/39)

## Problem

`chunk-system.ts` and `volume-chunk-window.ts` each contain the same private
`positiveModulo()` implementation. Both functions protect finite slot mapping
for negative world coordinates, so a future correction could drift between the
flat and volumetric chunk windows.

## Affected Files

- `src/world/chunk-system.ts`
- `src/world/volume-chunk-window.ts`
- `tests/world/chunk-system.test.ts`
- `tests/world/volume-chunk-window.test.ts`

## Structural Constraint

Keep both chunk-window files and the existing `src/world` ownership unchanged.
Do not move chunk logic into `src/utils`, introduce a generic math package, or
replace the current flat and volumetric window contracts.

## Smallest YAGNI Solution

Keep one small world-owned positive-modulo function and reuse it from both
chunk-window implementations. Prefer an existing `src/world` file as the owner
instead of adding a new architectural layer.

## Verification

Cover equivalent positive and negative coordinates in both window test suites,
then run TypeScript check, Biome, build, and Fallow duplication.
