<!--
Purpose: Track repeated static-population runtime code in Rocks and Vegetation.
Context: Both modules share placement mechanics but retain separate content ownership.
Responsibility: Reduce proven duplication without merging the concrete modules.
Boundary: This does not move folders, combine modules, or create a general content framework.
-->

# Reduce Rocks and Vegetation Runtime Duplication

**Status:** Open

**Priority:** Maintainability
**Issue:** [#41](https://github.com/Strehk/becoming-many/issues/41)

## Problem

Fallow reports repeated setup, streaming, instance writing, and model-pool code
between Rocks and Vegetation. `src/modules/static-population.ts` already owns
their shared candidate, zone, density, and model-selection pipeline, but some
common runtime mechanics remain duplicated in the concrete modules.

## Affected Files

- `src/modules/static-population.ts`
- `src/modules/rocks/rocks.ts`
- `src/modules/rocks/rock-instances.ts`
- `src/modules/vegetation/vegetation.ts`
- `src/modules/vegetation/vegetation-instances.ts`
- `tests/modules/static-populations.test.ts`

## Structural Constraint

Keep Rocks and Vegetation as separate modules in their current folders. Shared
code remains under `src/modules`; do not move content decisions into
`src/utils`, merge the modules, or add a generic module/runtime framework.

## Smallest YAGNI Solution

Review the exact Fallow clone groups and extract only mechanics that are already
identical and have the same lifecycle. Keep colors, transforms, asset rules,
placement policy, settings, and rendering decisions in their concrete module.
Prefer extending `static-population.ts` or one narrowly named sibling module
over introducing a new abstraction hierarchy.

## Verification

Prove identical deterministic placements before and after the change, retain
separate Rocks and Vegetation lifecycle tests, and run the full test, TypeScript,
Biome, build, and Fallow gates. Recheck draw calls and frame timing because the
affected code is on the streamed-content path.
