<!--
Purpose: Track the Scent level's measured performance over the 90 Hz budget.
Context: The merged implementation is structurally bounded but too expensive at current settings.
Responsibility: Define the smallest measured reductions before architectural changes.
Boundary: This does not replace the particle system or introduce adaptive quality.
-->

# Bring Scent Within the Frame Budget

**Status:** Open
**Priority:** Performance blocker

## Problem

The merged Scent level documents roughly 219,520 points and a median frame time
around 14.8 ms. Its invisible ground adds many terrain draws, and a full stream
queue falls back to an unbounded synchronous slot write.

## Affected Files

- `src/modules/scent-particles/scent-particles.ts`
- `src/modules/scent-particles/scent-particles-settings.ts`
- `src/modules/scent-particles/scent-particle-field.ts`
- `src/modules/terrain/ground-occluder.ts`
- `src/levels/shared-level-values.ts`
- `docs/performance.md`

## Smallest YAGNI Solution

Measure three existing knobs in order: plant capacity, particle density, and
occluder range/resolution. Remove the synchronous queue fallback by retaining
the previous slot until enqueue succeeds. Keep the existing module and shader
architecture. Do not add LOD, workers, an adaptive governor, or another particle
implementation before these reductions are measured.

## Verification

Record before/after desktop evidence and require physical PCVR acceptance at
90 Hz with no queue-capacity synchronous work.
