<!--
Purpose: Track responsibility accumulation in the level composition root.
Context: The file grew from 329 to 1,089 lines while integrating every cross-cutting feature.
Responsibility: Identify the smallest extractions that restore composition-only ownership.
Boundary: This does not replace the composition root or introduce a framework.
-->

# Reduce Level Runtime Responsibilities

**Status:** Open
**Priority:** Architecture

## Problem

`level-runtime.ts` now owns module wiring, show execution, transition policy,
audio orchestration, control arbitration, metrics, M5 handles, gates, and asset
selection. It remains the correct wiring owner but has absorbed implementation
policy and a 90 Hz show-driving hot path.

## Affected Files

- `src/levels/level-runtime.ts`
- `src/dramaturgy/show-levels.ts`
- `src/sound/narration-player.ts`
- `tests/dramaturgy/`
- `tests/levels/`

## Smallest YAGNI Solution

Extract only two proven responsibilities: an allocation-free show driver and a
control-source selector. Keep module constructors and concrete wiring in
`level-runtime.ts`. Do not introduce a DI container, generic module graph,
service locator, event bus, or new runtime hierarchy.

## Verification

Preserve all level/show tests and confirm the frame hot path does not allocate
new collections while following a show.
