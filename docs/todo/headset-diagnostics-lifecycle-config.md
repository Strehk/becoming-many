<!--
Purpose: Track lifecycle and configuration drift in the unmerged headset diagnostics.
Context: The branch globally wraps console methods, leaves listeners installed, and reads env configuration.
Responsibility: Bound diagnostics to one disposable development feature.
Boundary: This issue applies to origin/grass-clipmap and is not a current-main defect.
-->

# Bound Headset Diagnostics Before Merge

**Status:** Open
**Priority:** Before merge
**Branch:** `origin/grass-clipmap`
**Audited commit:** `ab526b487bbd427fcfbea00f278551fad0d676b4`

## Problem

At the audited commit, headset diagnostics permanently replace `console.warn/error`, retain global
listeners, create an extra WebGL context, and use `DEV_HTTPS_KEY` and
`DEV_HTTPS_CERT` despite the TypeScript-only configuration rule.

## Affected Files

- `origin/grass-clipmap:src/dev/headset-diagnostics.ts`
- `origin/grass-clipmap:src/main.ts`
- `origin/grass-clipmap:vite.config.ts`
- `origin/grass-clipmap:docs/architecture.md`

## Smallest YAGNI Solution

Return one `unload()` that restores console methods and removes listeners.
Read graphics facts from the existing renderer after creation. Put optional dev
certificate paths in one ignored TypeScript settings file or documented CLI
arguments. Do not add a logging service or diagnostics framework.

## Verification

Enable and unload diagnostics twice without duplicate output, leaked listeners,
or an additional persistent WebGL context.

Re-audit the branch head if it moves; this task describes the pinned commit,
not an assumed future state of the mutable remote branch.
