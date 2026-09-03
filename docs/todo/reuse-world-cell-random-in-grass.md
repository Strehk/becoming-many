<!--
Purpose: Track the duplicated deterministic cell hash in the Grass module.
Context: Grass repeats the hash already owned by the shared world candidate grid.
Responsibility: Reuse the established random stream without changing generated grass.
Boundary: This does not move folders, change ownership, or introduce a generic random framework.
-->

# Reuse the World Cell Random Function in Grass

**Status:** Open

**Priority:** Cleanup
**Issue:** [#40](https://github.com/Strehk/becoming-many/issues/40)

## Problem

`grass-field.ts` implements `getGrassRandom()` with the same integer-cell hash
used by `getCellRandom()` in `world/chunk-candidates.ts`. The duplicate keeps a
second copy of the constants and mixing steps that must remain identical for
stable procedural placement.

## Affected Files

- `src/modules/grass/grass-field.ts`
- `src/world/chunk-candidates.ts`
- `tests/modules/grass.test.ts`
- `tests/world/chunk-candidates.test.ts`

## Structural Constraint

Keep the current `src/world`, `src/modules`, and `src/utils` structure. The
shared cell random function remains owned by `src/world/chunk-candidates.ts`;
do not create a new utility folder, random service, or stateful generator.

## Smallest YAGNI Solution

Replace the local Grass hash with `getCellRandom(0, cellX, cellZ, valueIndex)`
and remove `getGrassRandom()` plus its now-unused range constant. Preserve the
existing output exactly so previously visited cells regenerate the same tufts.

## Verification

Add or retain exact deterministic-value coverage for Grass, then run Grass and
chunk-candidate tests, TypeScript check, Biome, build, and Fallow duplication.
