<!--
Purpose: Track expensive fragment work in Thermal Perception.
Context: Thermal applies multi-octave noise and dynamic heat loops across several surfaces.
Responsibility: Reduce measured shader cost using existing constants and branches.
Boundary: This does not redesign Thermal or add baked texture infrastructure without evidence.
-->

# Reduce Thermal Fragment Cost

**Status:** Open
**Priority:** Performance blocker

## Problem

Thermal performs four noise octaves, repeated hash work, contrast curves, and a
dynamic heat-source loop with `length()` and `exp()`. Some consumers compute
heat that is later multiplied by zero. These costs were merged without isolated
target-device measurements.

## Affected Files

- `src/modules/thermal-perception/thermal-perception.frag.glsl`
- `src/modules/thermal-perception/thermal-perception-settings.ts`
- `src/modules/thermal-perception/thermal-perception.ts`
- `tests/modules/thermal-perception.test.ts`
- `docs/performance.md`

## Smallest YAGNI Solution

First skip the body-heat function for consumers whose response is zero. Then
measure reducing noise octaves using the existing shader. Keep the current
uniform and material-effect contracts. Do not add textures, compute passes,
shader variants, or a new thermal renderer until the simple reductions fail.

## Verification

Compare shader output and frame cost per consumer, then validate the authored
look and 90 Hz target on the physical PCVR path.
