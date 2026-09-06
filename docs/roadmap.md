# Refactor Roadmap

This is the single plan and current readiness/review checkpoint. Procedures live
in the [workflow](refactor-workflow.md), [test plan](refactor-test-plan.md) and
[engineering standards](engineering-standards.md). The user's
[target architecture](target-architecture.md) is unchanged; its open choices
are not implementation approval. Live issues own acceptance criteria.

## Resume Checkpoint — 2026-09-06

| Field | Current state |
| --- | --- |
| Branch / integration | `david_refactor` only; the user explicitly authorized focused local commits and continued issue work. Push, main and extra branches remain unauthorized. |
| Implemented | Historical #21/early #11/#75 and #77/#79/#82 blocks reviewed. After the independent review and prepared human checks, the user confirmed all presented behavior works and authorized commits and the next wave. New wave count: 0/3, ordered #12 → #74 → #39. |
| User feedback | On 2026-09-06 the user confirmed all three presented browser checks work: mouse look/Escape/relock, Connections movement/standstill, and Echo pause/backward seek/resume with EN/DE listening. This accepts the reviewed local behavior at `0e064cb` (application unchanged from `2db5755`). No physical-device result or exact numerical reference approval was reported. |
| Current work | Record and commit human acceptance, then execute the explicitly authorized independent local wave #12 → #74 → #39. #83 human input now passes; the prior automated rejection remains preserved without an assigned cause. #22 remains closed not planned. |
| Next gate | The user explicitly authorized the next wave after accepting the presented block. This scoped continuation proceeds while #78 remains open and its baseline unchanged; it does not declare complete M0/reference acceptance. Next cumulative human review after #12/#74/#39, before further implementation. |
| Acceptance audit | At clean `2db5755`, independent source/history review found no introduced architecture blocker: existing owners retain one loop/clock/queue; #77 removes the old import route, #79 bounds dispatch history, #82 rejects stale work and removes four redundant staging parameters. Existing startup/disposal gaps remain #73/#9; open target decisions remain open. Application TypeScript +65 lines, test TypeScript +1,300, documentation +1,766, JSON evidence +5,702, reference candidate +74, configuration +91: total +8,998 against `9bfb84b`. This is a qualified technical pass, not human or milestone acceptance. |
| Verified application evidence | Historical final EN/DE each521s without unexpected errors; smoke14/14; repeatable counters/queue, but seven stored #78 references still fail. Exact tested identities and limits are in [evidence](evidence/README.md). |
| Analyzer delta | Fallow 3.21/3.22 remains exit 1: 3 dead-code, 10 clone groups, 24 health findings. The +2 health entries follow deliberate inlining in smoke `main`/`runSmokeRoute`; independent review found the same necessary error paths and no owner violation. No suppression or performance exception. Older 22-health measurements remain historical. |
| Correction verification | 482 tests / 26,639 assertions / 64 files; typecheck, lint, build, real boundaries and diff pass. Smoke 14/14; eight sought cues × first/repeat = 16 transition observations pass. A thrown pageerror in generated `dist/test.html` makes the same smoke fail: 11 affected routes red, three untouched green, 11 failure trace/image pairs; artifact restored byte-for-byte. Logs: `benchmark-results/lean-refactor-20260906T062328Z`. These are functional correction checks, not new performance or full-show measurements. |
| Open acceptance | Human browser/visual/listening and cumulative block review are accepted. Original #75 strict-start cause remains unassigned despite a distinct #79 fix; the #83 automated failure remains historical evidence. Exact #78 reference approval and complete M0 acceptance remain open. |
| External | Physical PICO 90 Hz, M5/ICAROS, Windows PCVR and venue stations remain unaccepted |

After compression: branch/status, AGENTS, linked rules, this checkpoint, then the
relevant live issue. Continue the authorized bounded issue work; do not
restart the inventory or infer approval from green tests. #77's existing-file
placement was [authorized before implementation](https://github.com/Strehk/becoming-many/issues/77#issuecomment-5554801541).

## Human Review

The production Station was restarted for this acceptance review at
`http://localhost:4180`; the Test route was opened in ordinary Chrome. The reviewed
source at `2db5755` has digest
`d901a111db0408b048439e2ea0a0ddd689570590d79eb200cdf602a34ff6db1a`, unchanged from
the prior functional checks and #83 probe. Later acceptance-record edits are
documentation only; historical measurements retain their own identities.
The user subsequently confirmed every presented action below works and requested
commits and the next issue wave. This records human acceptance on the unchanged
application at `0e064cb`; no new automated measurement is claimed.

| Action | Concrete observation / code |
| --- | --- |
| Test initial scene and actual canvas/mouse input | Accepted by the user: startup view and actual mouse look/Escape/relock. Prior automated #83 failure remains recorded. #77: existing material-effect contract and Terrain/Mycelium callers. |
| Connections move, then stand still, only after input works | Accepted by the user: ground/network continuity during movement and standstill. #82: `mycelium.ts` and existing regressions; no full-topology claim from fixed counters. |
| Echo Play/Hold/short backward seek/resume | Accepted by the user: recurring organ through pause/backward seek/resume, without unintended overlap. #79: `organ-runtime.ts`, `organ-timeline.ts`, existing tests; callback dispatch may be silent. |
| EN/DE change and Play | Accepted by the user: correct EN/DE narration and organ without unintended overlap. |

Review the [exact #78 candidate](evidence/issue-78/quick-reference-candidate.diff)
with its [attribution and uncertainty](evidence/issue-78/README.md). Full context/
late-import disposal remains #9/D6; D4/#80 animal retirement is unapproved.
New visitor reuses the world, not complete Run dispose/start.

## Milestones and Ordered Work

| Milestone | Scope | Human gate |
| --- | --- | --- |
| M0 | #21, early#11, #75, #77, #79, #82, #78 | Current correction/review, exact reference decision, browser/audio evidence |
| M1 | #12 → #74 → #39 → #20 → #27 → #29 | Browser review and remaining animal decision |
| M2 | #73 → #9 → #14 → local#16 → #35 → final#11 → #36 | Lifecycle, controls/audio/language, operator requirements |
| M3 | #17 → #18 → #38 → #25 → #46 → #33 | Physical control/XR and visitor handoff |
| M4 | #26 → #32 → #13 → #72 → #71 → #40 → #81 → #41 → #28 | Clipmap migration, visual and physical frame evidence |
| M5 | #50 → #47 → #48 → #49 → #51 after decisions | Tutorial/encounters/credits/full experience |
| M6 | #42/#54 and integration handover | Both real stations, recovery, exact proposed commit set |

The local human block review is accepted; no complete milestone or numerical
reference acceptance is inferred. The next local wave is explicitly authorized
with #78 retained open. [Tracker#76](https://github.com/Strehk/becoming-many/issues/76)
and [milestones](https://github.com/Strehk/becoming-many/milestones) mirror this plan.
M0 accepts only early stages of #11/#21; #11 stays open for M2, avoiding a circular
gate. #42 can proceed after #14 when its real hardware exists; collect #54 inventory
early. Readiness below: Local=desktop, Mixed=local+physical, External=hardware,
Decision=explicit product/ownership choice first.

## Reconciliation Required Before Code

- [#21](https://github.com/Strehk/becoming-many/issues/21) now applies its
  evidence record to direct-branch issues and the later integration set. Its
  actual next-performance-change and PR review remain pending.
- [#22](https://github.com/Strehk/becoming-many/issues/22) is closed not planned:
  the Material override is installed, actively consumed by Flash dependencies,
  and has a recorded compatibility rationale. No dependency change was made.
- [#29](https://github.com/Strehk/becoming-many/issues/29) describes a minimal
  turn-rate fix that current code has already exceeded with target headings,
  look-ahead, species-specific curves, and frame-rate tests. Reconcile the
  intended motion model before editing it.
- [#35](https://github.com/Strehk/becoming-many/issues/35) still describes the
  pre-#19 entry graph. The root show no longer samples Test UI metrics. Scope
  remaining work to Test and Conductor metrics without deleting the separate
  lazy test-module loader.
- [#16](https://github.com/Strehk/becoming-many/issues/16) is partially
  implemented; its recent comments are more current than the original problem
  statement. Re-establish the remaining cold-transition baseline first.
- [#26](https://github.com/Strehk/becoming-many/issues/26) names the removed
  `shared-level-values.ts`; current Scent settings live under
  `src/levels/authored/`.
- [#28](https://github.com/Strehk/becoming-many/issues/28) omits Grass Clipmap
  from the current shared-wind consumers.
- [#46](https://github.com/Strehk/becoming-many/issues/46) says New Visitor
  continues playback, but the current action already resets and pauses. The
  missing scope is XR calibration.
- [#47](https://github.com/Strehk/becoming-many/issues/47),
  [#48](https://github.com/Strehk/becoming-many/issues/48), and
  [#49](https://github.com/Strehk/becoming-many/issues/49) overlap the existing
  timed Animal Passages. Those passages are not gaze-guaranteed, use different
  timing, and the Bat lacks the requested recorded CC0 provenance. Decide
  whether to replace, adapt, or accept the current passages.
- [#50](https://github.com/Strehk/becoming-many/issues/50) mandates a tutorial
  although current product direction still makes it conditional on visitor
  testing. Resolve that product decision and the source-audio permission first.
- [#51](https://github.com/Strehk/becoming-many/issues/51) is partially
  implemented. Credits and CanvasTexture rendering exist, but final copy,
  longest-language timing, flight behavior, and PICO readability remain open.
- [#54](https://github.com/Strehk/becoming-many/issues/54) says the Watchdog is
  absent, while `watchdog/` is now versioned. Reconcile the body, then collect
  the real two-station inventory rather than redesigning that subsystem.
- [#11](https://github.com/Strehk/becoming-many/issues/11) still coordinates
  with #19, which is closed. Enforce stable boundaries in M0, then complete
  the entry/lifecycle rules after #73 and #35. Keep both stages in #11.

## Dependency-Aware Execution Order

### 1. Establish M0 before product changes

1. [#21 — Enforce the Performance Merge Gate](https://github.com/Strehk/becoming-many/issues/21)
   (**Decision/Mixed**): reconcile the direct-branch workflow, then establish
   the evidence format before performance-sensitive changes.
2. Complete the remaining M0 checklist above through separately scoped issues,
   including the early stage of #11. Complete M0 acceptance normally gates the sequence below; the user explicitly
   authorized the first local wave after the human block review, with #78 still open.

### 2. Independent local cleanup and contracts

1. [#12 — Stop Persisting and Logging Wi-Fi Passwords](https://github.com/Strehk/becoming-many/issues/12)
   (**Local**): resolve the credential leak before lower-risk cleanup.
2. [#74 — Remove the Unnecessary Vite /config Proxy](https://github.com/Strehk/becoming-many/issues/74)
   (**Local**): simplify development before repeated browser checks.
3. [#39 — Deduplicate positive modulo inside the World domain](https://github.com/Strehk/becoming-many/issues/39)
   (**Local**).
4. [#20 — Tighten the Material Shader Patch Contract](https://github.com/Strehk/becoming-many/issues/20)
   (**Local**).
5. [#27 — Tighten Scent Source Types](https://github.com/Strehk/becoming-many/issues/27)
   (**Local**), before Scent performance work in #26.
6. [#29 — Smooth Animal Boundary Turns](https://github.com/Strehk/becoming-many/issues/29)
   (**Decision/Mixed**): reconcile current behavior, then perform visual and
   PICO acceptance if work remains.

### 3. Startup, lifecycle, diagnostics, and entry ownership

1. [#73 — Simplify level startup by removing the setup callback chain](https://github.com/Strehk/becoming-many/issues/73)
   (**Local**) before the lifecycle contract changes.
2. [#9 — Complete the Application Lifecycle](https://github.com/Strehk/becoming-many/issues/9)
   (**Local**) on the explicit startup API from #73.
3. [#14 — Bound Headset Diagnostics Lifecycle and GPU Probing](https://github.com/Strehk/becoming-many/issues/14)
   (**Local**) using the lifecycle and existing renderer from #9.
4. [#16 — Eliminate Cold-Start CPU Spikes at Level Transitions](https://github.com/Strehk/becoming-many/issues/16)
   (**Mixed**) before removing the remaining diagnostic metrics needed to
   classify first-use work.
5. [#35 — Remove Redundant Test UI Runtime Cost](https://github.com/Strehk/becoming-many/issues/35)
   (**Decision/Mixed**) after #16; #19 is already closed.
6. [#11 — Configure Fallow Architecture Boundaries](https://github.com/Strehk/becoming-many/issues/11)
   (**Local**, final stage) after #73 and #35 stabilize the entry graph;
   retain and extend the M0 rules instead of replacing their baseline.
7. [#36 — Simplify Conductor Ownership and State Flow](https://github.com/Strehk/becoming-many/issues/36)
   (**Local**) after #9 and #35.

### 4. M5 control, vocabulary, and visitor start

1. [#17 — Reset M5 State on Host Change](https://github.com/Strehk/becoming-many/issues/17)
   (**Local**).
2. [#18 — Enforce M5 Liveness, Identity, Sequence, and Calibration](https://github.com/Strehk/becoming-many/issues/18)
   (**Mixed**) after #17; implementation is local and final policy needs the
   calibrated rig.
3. [#38 — Tighten the M5 Control Boundary](https://github.com/Strehk/becoming-many/issues/38)
   (**Mixed**) after #17 and #18; confirm physical polarity with #33.
4. [#25 — Rename Runtime Concepts by Current Ownership](https://github.com/Strehk/becoming-many/issues/25)
   (**Local**) only after #38; #34 is already closed.
5. [#46 — Auto-center the headset before every visitor flight](https://github.com/Strehk/becoming-many/issues/46)
   (**Decision/Mixed**) after #9 and the M5 control chain.
6. [#33 — Validate XR Flight on a Physical PICO](https://github.com/Strehk/becoming-many/issues/33)
   (**External**) after #46 and physical M5 polarity are stable.

### 5. Measured performance

1. [#26 — Bring Scent Within the Frame Budget](https://github.com/Strehk/becoming-many/issues/26)
   (**Mixed**) after #27.
2. [#32 — Reduce Thermal Fragment Cost](https://github.com/Strehk/becoming-many/issues/32)
   (**Mixed**).

Both require comparable desktop before/after evidence and physical PICO
acceptance. Keep their evidence and tuning independent.

### 6. Grass, zones, shared mechanics, and wind

1. [#13 — Migrate all Grass consumers to Clipmap and remove legacy Grass](https://github.com/Strehk/becoming-many/issues/13)
   (**Mixed**): D5 settles the renderer choice. Migrate Test/Design Test and remove
   legacy implementation, contracts, configuration, loader and exclusive tests
   together; retain visual/performance evidence and physical acceptance.
2. [#72 — Fix Grass Clipmap CPU Culling Bounds](https://github.com/Strehk/becoming-many/issues/72)
   (**Mixed**): compare conservative bounds with disabling incorrect CPU culling
   inside Clipmap; choose the correction from correctness/cost evidence.
3. [#71 — Use Continuous Zone Influences for Visual Habitat Transitions](https://github.com/Strehk/becoming-many/issues/71)
   (**Mixed**): World Surface owns shared continuous weights; Clipmap, Vegetation
   and Rocks replace their hard visual density/coverage branches together.
4. [#40 — Reuse the World cell random function in Grass](https://github.com/Strehk/becoming-many/issues/40)
   (**Removal verification**): do not refactor the retiring legacy renderer.
   Close only after #13 proves its entire legacy-only target was removed.
5. [#81 — Unify Vegetation placement acceptance across rendering, Scent and Connections](https://github.com/Strehk/becoming-many/issues/81)
   (**Decision/Mixed**) after #71. Decide the footprint representation before
   consolidating the three placement projections inside Vegetation; remove the
   competing acceptance approximations together.
6. [#41 — Reduce Rocks and Vegetation runtime duplication](https://github.com/Strehk/becoming-many/issues/41)
   (**Local**) after #71 and #81 establish the placement semantics; reassess
   remaining shared mechanics before the final extraction.
7. [#28 — Validate Every Consumer of Shared Wind Changes](https://github.com/Strehk/becoming-many/issues/28)
   (**Local**) after #13 leaves the final consumer graph.

### 7. PCVR diagnosis and visitor-facing work

1. [#42 — Diagnose Wired PCVR Startup on Windows, SteamVR, and PICO](https://github.com/Strehk/becoming-many/issues/42)
   (**External**) after #14 provides bounded diagnostics. Diagnose before
   changing application code. Pull this forward after #14 when hardware is available.
2. [#50 — Rewrite and Integrate the Flight Tutorial](https://github.com/Strehk/becoming-many/issues/50)
   (**Decision/Mixed**) after tutorial approval and #46.
3. [#47 — Add a View-Guaranteed Encounter Module](https://github.com/Strehk/becoming-many/issues/47)
   (**Decision/Mixed**) after the encounter-direction decision.
4. [#48 — Add the Timed Bat Encounter](https://github.com/Strehk/becoming-many/issues/48)
   (**Decision/Mixed**) after #47 and the asset/timing decision.
5. [#49 — Add the Timed Mosquito Swarm Encounter](https://github.com/Strehk/becoming-many/issues/49)
   (**Decision/Mixed**) after #47 and the timing decision.
6. [#51 — Show End Credits in Immersive VR](https://github.com/Strehk/becoming-many/issues/51)
   (**Decision/Mixed**) after final copy and timing approval.

### 8. Installation and handover

1. [#54 — Create the Technical Installation and Troubleshooting Runbook](https://github.com/Strehk/becoming-many/issues/54)
   (**External**): begin the hardware/software inventory early, but finish only
   after #12, #33, #42, the delivery decision, and the final session flow.

The #13 diagnostic-migration/legacy-removal stage must precede #72 and #71. Its final
acceptance waits for the selected owner's visual corrections and physical
measurements; keep #13 open across those separately verified issues. Do not
create a circular requirement that #13 must be closed before its corrections.

## Unscheduled Architecture Candidate

[#80 — Retire the unauthored moving-animal Connections path](https://github.com/Strehk/becoming-many/issues/80)
records the proposed D4 pilot, with code/history evidence and complete removal
criteria. It is blocked on explicit capability-retirement approval and has no
milestone or execution slot. Recording it does not insert it before the M0
review or change the existing issue sequence.

## Decision Register

Before the corresponding implementation, record explicit answers for:

1. review the implemented #21 direct-branch policy and M0 evidence; the unchanged
   `TerrainMaterialEffect` placement under #77 is now authorized. Review #78
   workload attribution before accepting any baseline changes;
2. #22 is resolved as not planned; preserve its active override. Any future
   dependency upgrade needs its own demonstrated scope;
3. D5 renderer and shared zone-weight ownership are confirmed; retain the open
   Vegetation footprint choice in #81 and #72 correctness/cost comparison, not
   another Grass renderer contest;
4. whether the existing Animal Passages remain course-relative or become
   gaze-guaranteed, whether Bat and Mosquito must end before their narration,
   whether Bird joins that contract, and which Bat asset is approved;
5. whether the tutorial is required after visitor testing and whether its
   source audio is licensed for this repository;
6. final credit copy, ordering, longest-language timing, and flight behavior;
7. standalone PICO versus wired PCVR, passthrough, and the exact venue hardware
   and software matrix;
8. whether D4's unauthored moving-animal Connections capability may be retired
   under #80; approval must precede scheduling the pilot. Other explicitly open
   target choices, including optional D3 recipe membership, remain decisions in
   [target architecture](target-architecture.md), not implicit implementation tasks.

## Coordinated Physical Evidence

A planned PICO/ICAROS session can collect evidence for #13, #16, #18, #26,
#29, #32, #33, #35, #38, #46, #47, #48, #49, #50, #51, #71, and #72. Record
revision, device/runtime versions, refresh rate, route or cue, frame evidence,
and observations separately for each issue. #42 additionally requires the
Windows, GPU/driver, SteamVR, PICO Business Streaming, OpenXR, cable, and log
matrix. #54 requires both real stations and their recovery cycles.

## Baseline Findings Without Dedicated Issues

The full Fallow dead-code scan currently reports:

- unused export `BAT_PASSAGE`;
- unused export `STEP_LOOKAHEAD_SECONDS`;
- duplicate export name `ReadSwarmCrossing`.

Do not silently fold these into unrelated work. Before changing them, either
associate each finding with an existing issue whose scope genuinely owns it or
create a dedicated issue.

## Integration Coordination

At the preparation snapshot, open PRs #62, #63, #64, #65, #68, and #70 target
`main` from other branches. Re-read their status and overlap before handover;
these are not part of this refactor merely because they touch related areas.
Never check out those branches or merge them as part of issue reconciliation.
The workflow defines focused commit mapping and later maintainer integration.
