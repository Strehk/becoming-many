<!--
Purpose: Provide the operational checklist for resolving the stabilization backlog one issue at a time.
Context: The audit findings must be revalidated against current main and delivered as small verified pull requests.
Responsibility: Define the session loop, completion evidence, and ordered issue queue.
Boundary: GitHub owns live issue and pull-request state; this file does not replace issue descriptions or technical task documents.
-->

# Refactor Checklist

Use this checklist for one issue and one pull request at a time. GitHub is the
authority for live issue state. An unchecked item is a candidate, not proof that
the finding still exists.

Check an issue only after its implementation and evidence satisfy the definition
of done and its pull request is ready to merge. A pull request with
`Closes #<number>` closes the GitHub issue when it merges.

## One Codex Session

### Start clean

- [ ] Select exactly one unchecked issue from the ordered queue.
- [ ] Read the GitHub issue, its local todo when present, the current owner code,
      tests, and affected documentation.
- [ ] Fetch the remote and verify the finding against the latest `origin/main`.
- [ ] If the finding is resolved or its proposed direction is obsolete, record
      the evidence and close or rescope the issue instead of writing code.
- [ ] Confirm that the worktree is clean and that unrelated user work is safe.
- [ ] Fast-forward local `main`, then create
      `david/issue-<number>-<short-slug>` from that revision.
- [ ] Record the base commit. If current baseline health is unknown, run
      `bun test` and a browser smoke test before editing.

### Implement the smallest complete change

- [ ] Reproduce or prove the problem before changing it.
- [ ] State the intended behavior, non-goals, affected owners, and acceptance
      criteria.
- [ ] Reuse an existing owner or contract before adding an abstraction or
      dependency.
- [ ] Add or update a focused regression test for changed behavior.
- [ ] Delete superseded code, tests, configuration, and documentation instead
      of retaining compatibility or no-op paths.
- [ ] Update only the affected as-built documentation and evidence.

### Prove the simplification

- [ ] List every removed or consolidated file, export, branch, dependency, or
      responsibility.
- [ ] Run and record a focused absence check, such as `rg` for a removed symbol
      or a file-existence check for a deleted path.
- [ ] Run Fallow and confirm the change introduces no dead export, dependency,
      duplication, complexity, or boundary regression.
- [ ] Review `git diff --stat` and the source-code delta. Explain any source
      growth; lower line count is a goal, not a substitute for correct tests and
      clear contracts.
- [ ] Confirm that no compatibility layer, speculative hook, duplicate owner,
      or commented-out implementation remains.

### Required verification

Run every gate. A new or worsened failure blocks the change. A pre-existing
failure may remain only when it is reproduced on the unchanged base, is not
worsened by the patch, and is linked to a separate open issue in the pull
request.

- [ ] Run the focused tests for the changed owner.
- [ ] Run `bun test`.
- [ ] Run `bun run check`.
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] Run `bunx fallow`.
- [ ] Run `git diff --check`.
- [ ] Browser-test the production build on the default production route and
      every affected route. Record the URLs, actions, result, and any console,
      page, or required-request errors.
- [ ] For rendered-level work, run at least
      `bun run benchmark --profile quick --level <affected-level>` after the
      production build.
- [ ] For performance-sensitive work, record comparable before-and-after
      evidence on the same route and rendering path.
- [ ] For XR, control, visual, lifecycle, or performance work, complete and
      record the required physical Windows/SteamVR/wired-PICO verification.

### Commit and pull request

- [ ] Review the complete diff and staged scope; no unrelated file belongs in
      the commit.
- [ ] Create an English imperative commit, for example
      `security: stop storing Wi-Fi passwords`.
- [ ] Verify branch status, commit contents, and ancestry after the commit.
- [ ] With user approval, push the issue branch and open a focused pull request
      targeting `main`.
- [ ] Include `Closes #<number>`, problem proof, change summary, test results,
      browser evidence, simplification evidence, source delta, and PCVR status
      in the pull-request description.
- [ ] Resolve review and CI findings on the same branch and rerun affected
      checks.
- [ ] Check the issue in the ordered queue only when all required evidence
      passes and the pull request is ready to merge.
- [ ] After merge, start the next Codex session by synchronizing `main` and
      creating a new issue branch. Do not continue from the merged branch.

## Ordered Issue Queue

### Known upstream changes

Before selecting #13, #14, #19, #33, #36, #37, or #42, revalidate its wording
against current `main`. Grass Clipmap, headset diagnostics, the Viewer Rig, and
the one-window Conductor architecture have landed since the findings were
written. Rewrite or close invalidated issues instead of implementing their
historical branch direction.

### 1. Resolve superseded scope

- [ ] [#37 Replace the Station Broker With BroadcastChannel](https://github.com/Strehk/becoming-many/issues/37)

### 2. Security and merge gates

- [ ] [#12 Stop Persisting and Logging Wi-Fi Passwords](https://github.com/Strehk/becoming-many/issues/12)
- [ ] [#21 Enforce the Performance Merge Gate](https://github.com/Strehk/becoming-many/issues/21)
- [ ] [#14 Bound Headset Diagnostics Before Merge](https://github.com/Strehk/becoming-many/issues/14)

### 3. PCVR, controls, and performance

- [ ] [#42 Diagnose and Harden PCVR Session Startup](https://github.com/Strehk/becoming-many/issues/42)
- [ ] [#17 Reset M5 State on Host Change](https://github.com/Strehk/becoming-many/issues/17)
- [ ] [#18 Enforce M5 Liveness and Device Validation](https://github.com/Strehk/becoming-many/issues/18)
- [ ] [#38 Simplify the M5 Control Contract](https://github.com/Strehk/becoming-many/issues/38)
- [ ] [#33 Add an XR Flight Rig](https://github.com/Strehk/becoming-many/issues/33)
- [ ] [#13 Choose One Grass Owner Before Merging Grass Clipmap](https://github.com/Strehk/becoming-many/issues/13)
- [ ] [#28 Validate Every Consumer of Shared Wind Changes](https://github.com/Strehk/becoming-many/issues/28)
- [ ] [#26 Bring Scent Within the Frame Budget](https://github.com/Strehk/becoming-many/issues/26)
- [ ] [#32 Reduce Thermal Fragment Cost](https://github.com/Strehk/becoming-many/issues/32)

### 4. Runtime ownership and lifecycle

- [ ] [#19 Isolate VR, Test, and Conductor Browser Entries](https://github.com/Strehk/becoming-many/issues/19)
- [ ] [#34 Separate Authored Level States From Show Composition](https://github.com/Strehk/becoming-many/issues/34)
- [ ] [#15 Reduce Level Runtime Responsibilities](https://github.com/Strehk/becoming-many/issues/15)
- [ ] [#16 Eliminate Cold-Start CPU Spikes at Level Transitions](https://github.com/Strehk/becoming-many/issues/16)
- [ ] [#35 Remove the Redundant Test UI](https://github.com/Strehk/becoming-many/issues/35)
- [ ] [#9 Complete the Application Lifecycle](https://github.com/Strehk/becoming-many/issues/9)
- [ ] [#25 Standardize Runtime Boundary Names](https://github.com/Strehk/becoming-many/issues/25)
- [ ] [#11 Configure Fallow Architecture Boundaries](https://github.com/Strehk/becoming-many/issues/11)
- [ ] [#36 Simplify the Conductor Application](https://github.com/Strehk/becoming-many/issues/36)

### 5. Contracts and bounded cleanup

- [ ] [#20 Tighten the Material Shader Patch Contract](https://github.com/Strehk/becoming-many/issues/20)
- [ ] [#27 Tighten Scent Source Types](https://github.com/Strehk/becoming-many/issues/27)
- [ ] [#39 Deduplicate Positive Modulo Inside the World Domain](https://github.com/Strehk/becoming-many/issues/39)
- [ ] [#40 Reuse the World Cell Random Function in Grass](https://github.com/Strehk/becoming-many/issues/40)
- [ ] [#41 Reduce Rocks and Vegetation Runtime Duplication](https://github.com/Strehk/becoming-many/issues/41)
- [ ] [#29 Smooth Animal Boundary Turns](https://github.com/Strehk/becoming-many/issues/29)
- [ ] [#23 Remove the Unused sharedEchoGrass Export](https://github.com/Strehk/becoming-many/issues/23)
- [ ] [#22 Remove the Unused `@material/web` Override](https://github.com/Strehk/becoming-many/issues/22)
- [ ] [#24 Move the Performance Map Out of the Root README](https://github.com/Strehk/becoming-many/issues/24)

### 6. Final documentation pass

- [ ] [#10 Align As-Built Documentation With the Runtime](https://github.com/Strehk/becoming-many/issues/10)

## Pull-Request Evidence Template

```md
Closes #<number>

## Problem proof

## Change

## Simplification proof
- Removed or consolidated:
- Absence check:
- Source delta:
- Fallow result:

## Verification
- Focused tests:
- `bun test`:
- `bun run check`:
- `bun run lint`:
- `bun run build`:
- `bunx fallow`:
- `git diff --check`:
- Browser routes and actions:
- Browser errors:
- Benchmark before/after:
- Physical PCVR: `passed`, `failed`, or `not yet tested`

## Remaining risk
```
