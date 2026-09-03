<!--
Purpose: Define the outcome-based order for the remaining Becoming Many stabilization work.
Context: The live issue queue changes more often than the product milestones it serves.
Responsibility: Group confirmed work into dependency-aware milestones and state their exit criteria.
Boundary: The Refactor Checklist owns exact issue order; current behavior and completed work belong in current-status.md.
-->

# Stabilization Roadmap

The [Refactor Checklist](refactor-checklist.md) is the operational queue: it
lists every open issue exactly once and governs one-issue branches and pull
requests. This roadmap only groups that work by outcome. GitHub issue state and
the latest `origin/main` remain authoritative.

## 0. Revalidate Historical Findings

**Goal:** Do not implement proposals that newer upstream work has already
superseded.

Start with
[#37 Replace the Station Broker With BroadcastChannel](todo/replace-station-broker-with-broadcast-channel.md).
The current one-window Conductor has already removed the broker and the
cross-window wire. Prove that state against current `main`, then close or
rescope the issue instead of adding a new transport.

Apply the same revalidation rule to issues #13, #14, #19, #33, #36, and #42.
Grass Clipmap, headset diagnostics, the Viewer Rig, XR-context hardening, and
the one-window Conductor landed after the original audit. An obsolete issue is
completed by recording the evidence and correcting the queue, not by changing
working code.

**Exit:** every historically sensitive issue has current evidence and a valid
scope before implementation begins.

## 1. Security and Merge Gates

**Goal:** Unsafe handling and unverified runtime changes cannot reach `main`.

- [#12 Stop Persisting and Logging Wi-Fi Passwords](todo/flash-page-password-handling.md)
- [#21 Enforce the Performance Merge Gate](todo/performance-merge-gate.md)
- [#14 Bound Headset Diagnostics Before Merge](todo/headset-diagnostics-lifecycle-config.md),
  if revalidation confirms remaining work

**Exit:** security-sensitive data is bounded, all repository gates run in the
delivery workflow, and required browser and physical PCVR evidence is explicit.

## 2. Make the Physical PCVR Path Safe and Viable

**Goal:** The complete Windows, SteamVR, wired PICO Business Streaming, and
PICO presentation path is controllable and meets the performance gate.

- Revalidate and finish [#42 PCVR session startup](todo/pcvr-black-screen-diagnostics.md).
- Make M5 control safe through
  [#17 host-change reset](todo/m5-host-switch-state-reset.md),
  [#18 liveness and device validation](todo/m5-liveness-and-device-validation.md),
  and [#38 contract simplification](todo/m5-control-contract-cleanup.md).
- Confirm whether [#33 XR Flight Rig](todo/xr-flight-rig.md) still has any
  unimplemented acceptance criteria.
- Resolve the active performance risks in
  [#13 Grass ownership](todo/grass-clipmap-single-owner.md),
  [#26 Scent](todo/scent-performance-budget.md), and
  [#32 Thermal](todo/thermal-fragment-budget.md).
- Verify shared runtime facts through
  [#28 Wind consumer validation](todo/shared-wind-consumer-validation.md).

**Exit:** a pinned station matrix passes the complete show path, recovery, and
the required physical performance profile. Desktop and headless evidence alone
cannot satisfy this milestone.

## 3. Simplify Runtime Ownership and Lifecycle

**Goal:** Show, level, operator, and lifecycle responsibilities have one clear
owner without a parallel runtime or coordination framework.

- Revalidate [#19 browser entries](todo/isolate-vr-test-conductor-entries.md)
  and [#36 Conductor simplification](todo/simplify-conductor.md) against the
  one-window design.
- Separate authored data from runtime composition in
  [#34 level state and show composition](todo/level-state-and-show-composition.md).
- Reduce the composition hotspot in
  [#15 Level Runtime responsibilities](todo/level-runtime-responsibilities.md).
- Remove transition spikes and redundant diagnostics through
  [#16 cold transitions](todo/level-transition-cpu-spikes.md) and
  [#35 redundant Test UI](todo/remove-redundant-test-ui.md).
- Finish [#9 application lifecycle](todo/application-lifecycle.md),
  [#25 boundary naming](todo/runtime-naming-consistency.md), and
  [#11 Fallow boundary rules](todo/fallow-boundary-rules.md).

**Exit:** one composition root and one render loop remain, every resource owner
has complete idempotent teardown, and no duplicate control or diagnostics path
survives.

## 4. Tighten Contracts and Remove Bounded Debt

**Goal:** Remove known duplication, dead surface area, and loose contracts
without broad rewrites.

- Tighten [#20 shader patching](todo/material-shader-patch-contract.md) and
  [#27 Scent source types](todo/scent-source-type-safety.md).
- Consolidate world-domain duplication in
  [#39 positive modulo](todo/deduplicate-world-positive-modulo.md),
  [#40 cell randomness](todo/reuse-world-cell-random-in-grass.md), and
  [#41 static populations](todo/static-population-runtime-duplication.md).
- Resolve [#29 animal boundary turns](todo/smooth-animal-boundary-turns.md).
- Delete the unused surfaces tracked by #23 and #22, and move the root README
  performance detail under #24.

**Exit:** each issue records what was removed or consolidated, an absence check,
the source delta, and a non-regressing Fallow result.

## 5. Reconcile Documentation

**Goal:** The repository describes one verified system after the structural
work settles.

- Complete #10 only after the preceding changes have landed.
- Keep `current-status.md` factual, `architecture.md` implementation-based,
  this roadmap forward-looking, and architecture decisions limited to confirmed
  constraints.

**Exit:** no open issue, current document, or direction document contradicts
the implemented runtime or selected PCVR delivery topology.

## Pull-Request Completion Gate

Every implementation follows the same loop:

```text
revalidate issue → prove problem → implement smallest complete change
→ run tests and production browser checks → prove simplification
→ run physical PCVR checks where required → review diff → pull request
```

One issue uses one branch and one pull request. Start the next session from a
freshly synchronized `main`, never from the previous issue branch.
