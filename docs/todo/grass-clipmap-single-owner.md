<!--
Purpose: Track the architectural decision required before merging the grass-clipmap branch.
Context: The branch adds a second grass module and a separate spatial grid.
Responsibility: Ensure one grass owner and trustworthy evidence before integration.
Boundary: This issue applies to origin/grass-clipmap and is not a current-main defect.
-->

# Choose One Grass Owner Before Merging Grass Clipmap

**Status:** Open
**Priority:** Before merge
**Branch:** `origin/grass-clipmap`
**Audited commit:** `ab526b487bbd427fcfbea00f278551fad0d676b4`

## Problem

The audited commit adds `grass-clipmap/` beside `grass/`, permits both presets at once,
and uses a separate 42.75 m grid instead of the shared aligned chunk contract.
Its settings, benchmark baseline, and documentation also describe incompatible
coverage and draw-call numbers.

## Affected Files

- `origin/grass-clipmap:src/modules/grass-clipmap/`
- `origin/grass-clipmap:src/modules/grass/`
- `origin/grass-clipmap:src/levels/level-runtime.ts`
- `origin/grass-clipmap:docs/architecture-decisions.md`
- `origin/grass-clipmap:docs/current-status.md`
- `origin/grass-clipmap:tests/benchmark/benchmark-baseline.ts`

## Smallest YAGNI Solution

Measure both implementations on the same route, choose one owner, and delete
the other narrative path. Either align the winner to `ChunkWindow` or document
one measured reason the grass grid must differ. Correct the evidence before
merge. Do not support two grass systems or build a common abstraction first.

## Verification

Require one preset field, one active implementation, consistent benchmark
numbers, passing tests, and physical PCVR acceptance.

Re-audit the branch head if it moves; the file paths and measurements above are
evidence for the pinned commit, not a mutable remote name.
