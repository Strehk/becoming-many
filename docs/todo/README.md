<!--
Purpose: Index the stabilization audit and define how its findings become implementation work.
Context: The audit was captured from a local checkout while upstream development continued in parallel.
Responsibility: Preserve the snapshot context, analysis limits, issue mapping, and execution workflow.
Boundary: This document records findings and proposed work; it does not prove that a defect still exists or that a proposed solution is accepted.
-->

# Stabilization Audit and Issue Execution

## Foundation Extraction

This planning backlog was selectively transferred to
`david/refactor-foundation`, based on `origin/main` at `328b2b9`. The transfer
keeps the issue records and verification guidance without carrying the audit
snapshot's runtime, package, narration, or as-built documentation changes.
GitHub issue state and the latest `origin/main` remain authoritative.

This directory and `docs/refactor-checklist.md` are branch-local planning
artifacts. They stay on `david/refactor-foundation` and must never be included
in a pull request or merged into `main`. Issue code may be developed on the
foundation branch, but only separate deliverable commits are cherry-picked onto
a fresh issue branch based on current `main`.

## Snapshot Context

This directory is primarily an analysis artifact. It records problems found
during a broad architecture, security, control, performance, reliability, and
maintainability review. The findings are not a completed implementation, a
merge-ready change set, or proof that every proposed solution remains correct.

The local audit snapshot was created on 2026-09-02 with these Git facts:

- snapshot branch: `david/audit-snapshot-2026-09-02`
- local base before the snapshot commit: `5c52eab`
- live upstream `main` observed during the audit: `32459c4`
- upstream was 14 commits ahead of the local base
- upstream development overlapped several files changed by the audit

The snapshot deliberately preserves the complete local working state before
any fetch, rebase, conflict resolution, or selective extraction. It includes
the audit documents, architecture diagram, narration relocation, documentation
alignment, and supporting source and test edits that accumulated during the
analysis. Those parts have not yet been separated into reviewable issue-sized
changes.

## Interpretation Rules

- Treat every todo as a finding to revalidate against the latest upstream
  `main`, not as an automatically accepted task.
- Treat each proposed solution as the smallest known candidate, not as a final
  architecture decision.
- Close, replace, or rewrite findings that upstream work has already resolved
  or invalidated.
- Never merge this planning directory or the refactor checklist. Extract only
  reviewed deliverable commits into a fresh branch based on current upstream.
- Keep physical PC VR acceptance separate from desktop, test, type, lint, build,
  and headless benchmark evidence.

## Snapshot Validation

The complete snapshot was checked before its local checkpoint commit:

- `bun test`: passed, 348 tests and 0 failures
- `bun run check`: passed
- `bun run lint`: passed, 213 files checked and no fixes applied
- `bun run build`: passed; Vite reported the existing large-chunk warning
- `git diff --check`: passed
- `bunx fallow`: failed as expected for the recorded audit backlog

Fallow reported the unused `sharedEchoGrass` export, seven duplication groups,
and 18 complexity or health threshold breaches. These findings are evidence for
triage, not permission to combine their fixes into this snapshot. No browser,
Windows station, wired PC VR, or physical headset acceptance run was performed
for the snapshot.

## Local Audit Inventory

The local snapshot retains the following issue records. GitHub issue state may
have changed since the snapshot and must be checked before implementation.

| Issue | Local record | Finding |
| --- | --- | --- |
| #9 | `application-lifecycle.md` | Complete the application lifecycle |
| #11 | `fallow-boundary-rules.md` | Configure Fallow architecture boundaries |
| #12 | `flash-page-password-handling.md` | Stop persisting and logging Wi-Fi passwords |
| #13 | `grass-clipmap-single-owner.md` | Choose one Grass owner |
| #14 | `headset-diagnostics-lifecycle-config.md` | Bound headset diagnostics |
| #15 | `level-runtime-responsibilities.md` | Reduce Level Runtime responsibilities |
| #16 | `level-transition-cpu-spikes.md` | Eliminate cold-start CPU spikes |
| #17 | `m5-host-switch-state-reset.md` | Reset M5 state on host change |
| #18 | `m5-liveness-and-device-validation.md` | Enforce M5 liveness and device validation |
| #19 | `isolate-vr-test-conductor-entries.md` | Isolate VR, test, and conductor entries |
| #20 | `material-shader-patch-contract.md` | Tighten the material shader patch contract |
| #21 | `performance-merge-gate.md` | Enforce the performance merge gate |
| #23 | `remove-unused-shared-echo-grass-export.md` | Remove the unused shared Echo Grass export |
| #24 | `root-readme-scope.md` | Move the performance map out of the root README |
| #25 | `runtime-naming-consistency.md` | Standardize runtime boundary names |
| #26 | `scent-performance-budget.md` | Bring Scent within the frame budget |
| #27 | `scent-source-type-safety.md` | Tighten Scent source types |
| #28 | `shared-wind-consumer-validation.md` | Validate every shared Wind consumer |
| #29 | `smooth-animal-boundary-turns.md` | Smooth animal boundary turns |
| #32 | `thermal-fragment-budget.md` | Reduce Thermal fragment cost |
| #33 | `xr-flight-rig.md` | Add an XR Flight Rig |
| #34 | `level-state-and-show-composition.md` | Separate authored level states from show composition |
| #35 | `remove-redundant-test-ui.md` | Remove the redundant Test UI |
| #36 | `simplify-conductor.md` | Simplify the Conductor application |
| #37 | `replace-station-broker-with-broadcast-channel.md` | Verify removal of the superseded station transport |
| #38 | `m5-control-contract-cleanup.md` | Simplify the M5 control contract |
| #39 | `deduplicate-world-positive-modulo.md` | Deduplicate positive modulo in the World domain |
| #40 | `reuse-world-cell-random-in-grass.md` | Reuse the World cell random function in Grass |
| #41 | `static-population-runtime-duplication.md` | Reduce Rocks and Vegetation runtime duplication |
| #42 | `pcvr-black-screen-diagnostics.md` | Diagnose and harden PCVR session startup |

Issues #10, #22, #30, and #31 were part of the wider audit but no longer have a
local todo document in this snapshot. Their current GitHub state and the latest
upstream implementation remain authoritative for the next triage pass.

## Next Phase

The next phase is the deliberate, sequential implementation of confirmed
issues:

1. Refresh the foundation branch from the latest upstream `main`.
2. Reproduce or prove one issue against that exact revision.
3. Confirm scope, ownership, priority, and acceptance criteria.
4. Implement the smallest complete solution on the foundation branch, keeping
   deliverable work separate from todo and checklist updates.
5. Run focused checks and the repository-wide test, type, lint, build, and
   Fallow gates.
6. Verify the real browser, control, XR, or PC VR path required by the issue.
7. Create a fresh issue branch from current `main`, cherry-pick only the
   deliverable commits, and verify that no planning artifact entered its diff.
8. Submit one reviewable pull request linked to the issue before starting the
   next implementation. If upstream already resolved the issue and no
   deliverable diff remains, record the evidence and close it directly.

Security, control safety, installation, performance, reliability, and contract
defects take precedence over cosmetic cleanup. Performance-sensitive work is
not accepted without comparable evidence and the required physical PC VR gate.
