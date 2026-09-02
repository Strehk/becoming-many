<!--
Purpose: Track one unused exported level value reported by Fallow.
Context: sharedEchoGrass has no current consumer after Grass was parked from narrative levels.
Responsibility: Remove the dead public surface or restore a proven consumer.
Boundary: This does not re-enable Grass or redesign level inheritance.
-->

# Remove the Unused sharedEchoGrass Export

**Status:** Open
**Priority:** Cleanup

## Problem

Fallow reports `sharedEchoGrass` as an unused export. Keeping it suggests a
supported narrative configuration that no current level consumes.

## Affected Files

- `src/levels/shared-level-values.ts`
- `src/levels/echo.level.ts` only if a real consumer is intentionally restored

## Smallest YAGNI Solution

Delete the unused export. Restore it only as part of a separately accepted Grass
integration. Do not preserve speculative configuration for a future branch.

## Verification

Run level tests, TypeScript check, and `fallow dead-code`.
