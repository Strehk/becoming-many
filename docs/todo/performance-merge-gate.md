<!--
Purpose: Track the gap between performance rules and merge behavior.
Context: Branches with documented unmeasured regressions were merged into main.
Responsibility: Define a small evidence gate for performance-sensitive changes.
Boundary: This does not add a full CI performance laboratory.
-->

# Enforce the Performance Merge Gate

**Status:** Open
**Priority:** Process blocker

## Problem

The repository declares 90 Hz and target-device regressions blocking, but
`terrain-finetuning` and Scent changes were merged with known unmeasured costs
or measurements already above 11.11 ms.

## Affected Files

- `AGENTS.md`
- `docs/performance.md`
- `docs/current-status.md`
- `.github/` only if a lightweight check already exists or is added

## Smallest YAGNI Solution

Add a pull-request checklist with two explicit gates:

1. Every performance-sensitive change includes comparable before/after results
   from a headed production build on the same machine. A measured regression
   blocks merge unless a documented product decision accepts that exact cost.
2. Every change to rendering, streaming, XR navigation, or show transitions
   passes on the physical Windows station, USB-C connection, SteamVR stack, and
   PICO headset before merge. Record the device and software matrix with the
   result.

`not yet tested` is allowed only while a pull request remains a draft or for a
change whose diff cannot affect the runtime path. It is never a merge or
milestone acceptance state. A failing or incomplete benchmark artifact also
blocks the gate; absence of measurement must not look like absence of a
regression.

Do not build a dashboard, benchmark service, bot, or adaptive quality system.

## Verification

Use the checklist on the next performance-sensitive PR and confirm that its
browser artifact and physical PCVR record are understandable without reading
commit messages. Prove once that a missing artifact and a failed target-device
status both block the lightweight repository check.
