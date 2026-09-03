<!--
Purpose: Track branch-specific implementation detail in the product README.
Context: The terrain-finetuning rollback matrix remained in the root after merge.
Responsibility: Restore the root README as the concise project entry point.
Boundary: This does not delete performance evidence.
-->

# Move the Performance Map Out of the Root README

**Status:** Superseded
**Priority:** Documentation structure

Resolved on 2026-09-02 by removing the obsolete PR-specific rollback matrix
from the project introduction. Current evidence and acceptance rules remain in
`docs/performance.md`; Git history remains the owner of commit-level rollback
notes.

## Problem

The root README contains a long PR-specific performance and rollback matrix.
Repository standards assign the root README to the piece's concept and direct
implementation evidence to `docs/`.

## Affected Files

- `README.md`
- `docs/performance.md` or one existing performance audit document
- `docs/README.md`

## Resolution

Removed the stale table instead of moving historical branch detail into current
performance documentation. No new documentation category or duplicate table was
created.

## Verification

Read the root README as a first-time visitor and confirm implementation rollback
detail is reachable through the documentation index.
