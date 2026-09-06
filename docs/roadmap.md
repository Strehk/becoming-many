# Refactor Roadmap

This is the single plan and current readiness/review checkpoint. Procedures live
in the [workflow](refactor-workflow.md), [test plan](refactor-test-plan.md) and
[engineering standards](engineering-standards.md). The user's
[target architecture](target-architecture.md) includes the binding decisions of
2026-09-06; only its explicitly remaining operational/content choices are open. Live issues own acceptance criteria.

## Resume Checkpoint — 2026-09-06

| Field | Current state |
| --- | --- |
| Branch / integration | `david_refactor` only; the user explicitly authorized focused local commits and continued issue work. Push, main and extra branches remain unauthorized. |
| Implemented | Previous blocks including #12/#74/#39 accepted. After opening the application in Chrome, the user confirmed on 2026-09-06 that it looks good and requested continuation. New block #80 → #73 → #20: 2/3 source changes implemented. #80 awaits cumulative review; #73 has an unresolved Show-clock verification failure; #20 is paused. |
| User feedback | Latest response accepts the presented browser/block review at `43133d7` (application unchanged from `3cb862e`, source digest `6d937a09592c5f147e5a9f10aa4eb956b0652ca5aedfbbc93a4867e7ac9ea6d5`). This is a global human confirmation, not a new record of individual scripted gestures or hardware measurements. |
| Current work | #12/#74/#39 are technically complete and now human accepted. Their retained final evidence: 484 tests, typecheck/lint/build/diff, zero boundary violations, production smoke 14/14. All nine quick counter/streaming records match #82; seven #78 references remain unchanged failures. #80 now removes the whole unused animal-link path: production logic −215, configuration −5, tests +6. 485 tests/26,660 assertions pass; type/lint/build/diff and zero boundaries pass, smoke 14/14. All nine quick reports preserve previous counters/queue except the explained Connections −64 triangles. Three full before/after runs show no repeatable timing regression; fixed ground view and normalized pool attributes agree. #73 removes 271 production lines and 39 exclusive test lines. Direct start/frame and World-owned preparation preserve ordering; 483 tests/26,657 assertions, type/lint/build/diff and boundaries pass. Smoke 14/14 and all nine counter/streaming records match #80. One Motion transition stalled Show time (+0.725 seconds in 10 seconds) while 599 frames continued; 14 other observations passed. Three initial instrumented Motion repetitions and 29 further fresh-context probes did not reproduce it; both audio clocks advanced and no extra pause was recorded. The unchanged f951ee0 snapshot also passed 16 transitions. A later diagnostic observer passed eight observations before interruption. These do not explain the original failure. #73 remains under investigation; #20 is paused. |
| Next gate | Cumulative human behavior/architecture/size review after at most three new implemented issues (#80/#73/#20), or an earlier visible/decision gate. Independent prior-wave review found application/Station/Vite −26 lines, tests +98, one obsolete file removed, no new owner/dependency. No physical or numerical-reference acceptance is inferred. |
| Acceptance audit | At clean `2db5755`, independent source/history review found no introduced architecture blocker: existing owners retain one loop/clock/queue; #77 removes the old import route, #79 bounds dispatch history, #82 rejects stale work and removes four redundant staging parameters. Existing startup/disposal gaps remain #73/#9; open target decisions remain open. Application TypeScript +65 lines, test TypeScript +1,300, documentation +1,766, JSON evidence +5,702, reference candidate +74, configuration +91: total +8,998 against `9bfb84b`. This is a qualified technical pass, not human or milestone acceptance. |
| Verified application evidence | Historical final EN/DE each521s without unexpected errors; smoke14/14; repeatable counters/queue, but seven stored #78 references still fail. Exact tested identities and limits are in [evidence](evidence/README.md). |
| Analyzer delta | After #73, Fallow remains exit 1: 4 dead-code, 11 clone groups, 24 health findings. The extra `ModuleRuntime.load` finding is false positive: `startLevel` directly calls it before activation; no suppression or wrapper was added. New test-only findings are five repeated assertions at distinct legacy-load/post-submit-reload boundaries and estimated CRAP for `checkFlash` (CC7/cognitive5). Independent review retained these meaningful checks without a helper or suppression. Real boundary violations: 0. Older 10/24 and 10/22 results remain historical. |
| Correction verification | 482 tests / 26,639 assertions / 64 files; typecheck, lint, build, real boundaries and diff pass. Smoke 14/14; eight sought cues × first/repeat = 16 transition observations pass. A thrown pageerror in generated `dist/test.html` makes the same smoke fail: 11 affected routes red, three untouched green, 11 failure trace/image pairs; artifact restored byte-for-byte. Logs: `benchmark-results/lean-refactor-20260906T062328Z`. These are functional correction checks, not new performance or full-show measurements. |
| Open acceptance | Current #12/#74/#39 human block review is accepted. Original #75 strict-start cause and #83 automated rejection remain unresolved historical observations; exact #78 reference and complete M0 acceptance remain open. |
| Decisions / current work | Binding decisions are recorded in `43133d7`; #85 owns explicit levels. #80 fixed anchor inventory preserves vegetation including bushes, rocks, fixed forest-clearing points and soil. Only moving-animal links are retired. Concrete restart/level-show/bank/content choices remain open. |
| External | Actual Windows-PCVR USB-C 90 Hz including transport/headset, M5/ICAROS and venue stations remain unaccepted. Basic #42 commissioning and #54 inventory move early; they do not wait on #14. |

After compression: branch/status, AGENTS, linked rules, this checkpoint, then the
relevant live issue. Continue the authorized bounded issue work; do not
restart the inventory or infer approval from green tests. #77's existing-file
placement was [authorized before implementation](https://github.com/Strehk/becoming-many/issues/77#issuecomment-5554801541).

## Human Review

On 2026-09-06, after the application was opened in Chrome, the user confirmed
that the presented application looks good and requested continuation. This
accepts the #12/#74/#39 browser/block review at `43133d7`; application code and
its retained evidence remain at `3cb862e`. No fresh per-action test record,
physical result or numerical reference approval is invented from this response.

The local block is #80 → #73 → #20, now at 2/3 source changes implemented. #80 is technically verified; #73
verification is blocked by the unexplained Show-clock observation; #20 is paused. Prepare
an earlier human check while the unexplained failure remains open: select Motion
in the production show, play/listen for at least ten seconds, then Hold/Play
and repeat. Note whether the clock and audio stop without a pause action.
The user has not yet accepted this candidate or the remaining uncertainty.
The current New visitor action remains a time/position reset, not complete Run
termination; #9 and its concrete operating proposal still own that target.
The exact #78 candidate remains unapplied; Windows-PCVR USB-C 90 Hz and full
Run disposal remain unaccepted. Essential previous measurements stay in their
live issues and [evidence index](evidence/README.md).

## Milestones and Ordered Work

All stages use the same three-implemented-issue cumulative human gate. An issue
may prepare a concrete proposal or gather read-only evidence while implementation
waits for its actual dependency. The previous 3/3 gate is accepted; count the new block from zero. Early physical commissioning is not deferred until the last milestone.

| Milestone | Ordered scope | Gate |
| --- | --- | --- |
| M0 | Retain #21/early #11/#75/#77/#79/#82 evidence; bounded #78 reference investigation | Exact inspected reference proposal and complete M0 acceptance remain open |
| M1 | Accepted #12/#74/#39; next local block #80 → #73 → #20; #27 before #26 | Next cumulative review after at most #80/#73/#20 |
| M2 | Early #42 commissioning + #54 inventory; #9 lifecycle and #16 preparation; #14 diagnostics; #85 explicit levels; #35 → #36 shared UI ownership; final #11 | Concrete restart and level/show proposals first; dependent lifecycle and physical checks below |
| M3 | #17 → #18 → #38 → #25; #46 visitor handoff → #33 physical flight | Actual Windows-PCVR/M5 calibration and operator acceptance |
| M4 | #26, #32; #13 → #72 → #71 → #81 → #41; verify #40 retirement and #28 final wind consumers | Comparable local evidence, bank-view choice, Windows-PCVR USB-C 90 Hz |
| M5 | Required #50 tutorial and #51 credits; decision-bound #29 and #47 → #48/#49 | Concrete content/timing/rights/input proposals and human review |
| M6 | Complete #42/#54, full operation and integration handover | Repeated visitors, real stations, failure recovery, exact proposed commit set |

[Tracker #76](https://github.com/Strehk/becoming-many/issues/76) mirrors this plan.
#84 CSS consolidation remains separately scoped and unscheduled; it does not
silently expand the current block. #13’s migration/removal stage precedes
#72/#71, but its final integrated acceptance may wait for those corrections;
do not require #13 to close before implementing its dependent corrections. #22 remains closed not planned: retain the
actively consumed Material override and its compatibility evidence.

## Immediate Work and Dependencies

| Work | Smallest scope / prerequisite |
| --- | --- |
| Current human gate | #12/#74/#39 accepted after the browser review; new block has two source changes (#80/#73); #73 verification is unresolved and #20 is paused. |
| #42 + #54, start early | Obtain the actual Windows/GPU/driver/browser/XR/streaming/USB/headset matrix and reproduce entry/re-entry/audio/operator behavior with existing tools. Basic commissioning does not require #14; later diagnostic detail can use it. No Mac substitute for physical results. |
| #78, bounded investigation | Fix a camera pose and comparable conditions, identify intended scene/available contents, repeat counters and explain significant differences. Then propose the exact checked reference. No exhaustive historical-triangle archaeology and no automatic baseline update. |
| #80, technically implemented | Remove animal–Mycelium producers, projections, contracts, wiring, reserved pool ranges, settings and exclusive tests together. First enumerate existing fixed anchor classes. Preserve animal animation/movement and Scent/Thermal data; no other content removal. |
| #73, source implemented; verification blocked | Flatten startup at existing Runtime/Composition owners, retaining one frame order and directly readable start/frame/end. This simplification alone does not claim complete teardown. |
| #20, after #73 | Tighten the existing shader-patch boundary without adding a new effect framework. Ends the next three-issue local block. |
| #9 | Use #73's direct startup. Present the smallest visitor restart sequence using #42 evidence before selecting its mechanism. Prepare owner-local cleanup, failed/cancelled starts and late results; only expose complete termination once every child/source lifetime is covered. A reload candidate is not approved automatically. |
| #16 | Reconcile the partly implemented cold-transition work first. Use one preparation/resource/background strategy and preserve the world during a visit. Measure first/repeated transitions; coordinate #9 lifetimes and #85 configuration, no per-level workaround. |
| #14 | Keep probes/renderers out of normal Experience operation. Diagnosis owns measurement/display; World exposes existing renderer facts by small reads. Can prepare this owner-local separation before #9, but complete cleanup acceptance depends on #9. Startup failures stay visible. |
| #85 (D3) | Before migration, present the smallest explicit level/show solution: one prepared world and no contradictory second show configuration. Compare effective settings; missing module is absent, optional settings use module defaults, invalid required settings fail during preparation. Remove layers, hidden overrides and exclusive helpers/tests together. |
| #35 → #36; final #11 | After relevant #9/#16/#14 work, remove metrics round trips and duplicate commands/reset rules. Show owns playback/language/time; existing Runtime owns visitor restart; UIs own input/display. Preserve the useful lazy Test loader. Finish boundary rules after entry/ownership changes, with no command bus or UI store. |
| #27 → #26 | Tighten Scent types before measured Scent work; remove its synchronous queue fallback inside existing owner/queue semantics. |
| #17 → #18 → #38 → #25 | Isolate M5 host lifetime, validate samples/calibration and one control boundary, then rename actual ownership. Physical polarity/rig evidence remains necessary. |
| #46 → #33 | After #9 and physical control chain, settle calibration/hold-or-play/flight sequence on the actual Windows-PCVR setup, then accept XR flight. Clock reset alone is insufficient. |
| #13 → #72 → #71 | Clipmap owner is decided. Remove complete legacy Grass path and exclusive tests in #13; compare bounds correction/culling disable in #72. World Surface owns shared continuous weights in #71. |
| #81 → #41 | Vegetation owns one placement decision used by rendering, Scent and Mycelium; World Surface supplies terrain/river/zones. Coordinate shared weights from #71. Compare a small bank view and settle clearance/crown overhang before changing appearance; then remove competing checks/fallback calculations. Reassess remaining Rocks/Vegetation duplication afterward. |
| #40, #28, #32 | #40 only verifies complete legacy deletion after #13; do not refactor retiring Grass. #28 checks every surviving wind consumer. #32 remains an independent measured Thermal issue. |
| #50, #51 | Tutorial and credits are required. Reuse existing Show/time/content ownership; settle concrete content, duration, rights, start/input and credit movement. #50 follows the #46 start procedure. No second tutorial, credit renderer or timeline. |
| #29, #47–#49 | Current animal arcs/passages already exceed older issue descriptions. Reconcile motion/gaze/timing/assets before code; no stale immediate-turn fix or parallel encounter implementation. |
| #54 completion | Begin inventory now; finish after #12/#33/#42, visitor flow and both station recovery tests. Versioned watchdog already exists; do not redesign it from a stale absence claim. |

## Remaining Decision Gates

The direction of D1/D2/D3/D4/D6 is confirmed, not a renewed approval question.
Present each remaining choice with a recommendation, concrete inspectable result
and consequences; resolve routine implementation choices directly.

| Decision | Evidence/proposal | Dependent work |
| --- | --- | --- |
| Visitor restart mechanism | On actual Windows-PCVR, compare the smallest complete restart path, including a page reload candidate: XR exit/re-entry, audio wake, staff actions and failures. Never assume automatic immersive re-entry. | #9 restart; #46 and final #36 operator behavior |
| Level/show construction | Small direct proposal for explicit independent levels and one prepared show world; compare effective settings and list removed indirection. Extra literal configuration is allowed when it replaces structures. | #85; coordinate #16 preparation |
| Bank appearance | Same small view, model-independent ground-distance recommendation and crown-overhang choice; species-specific values only in existing definitions when needed. | #81 visible placement change and subsequent #41 |
| Exact reference | Defined scene/pose/assets, repeatable counters and relevant difference explanation; current candidate remains unapproved. | #78 baseline update, complete M0 acceptance |
| Tutorial/credits details | Required content, duration, audio-use rights, start behavior and motion while credits are visible; preserve authoritative narration pending explicit content approval. | #50/#51 completion |
| Physical flow and encounters | Calibration, hold/play, flight and safety/see-through; separate existing #29 and #47–#49 motion/gaze/timing/asset choices. | Their respective issues only |

Windows-PCVR over USB-C is settled; standalone PICO belongs to another project
after this version. No alternate standalone infrastructure is authorized.
D4 animal-link removal is settled; document existing fixed anchor classes before
any further deletion. D5 Clipmap/World Surface ownership stays confirmed; #72's
precise correctness/cost choice remains evidence-based. A new owner, abstraction,
unplanned content change or unexplained production growth requires a concrete
decision under the existing workflow, not a new audit system.

## Coordinated Physical Evidence

Start with #42/#54's Windows-PCVR matrix and restart feasibility. Later combine
compatible #13/#16/#18/#26/#29/#32/#33/#35/#38/#46–#51/#71/#72 observations in a
physical session, recording each issue separately. Include exact source/build,
Windows/GPU/driver/browser/XR/streaming versions, cable/headset, refresh rate,
route/cue, frame and transport evidence, operator actions and recovery. Stable
90 Hz must hold on the installation including transfer and headset. Mac tests
remain development/regression evidence. Final #54 needs both real stations and
repeated fresh visitors, disconnects and failed-start recovery.

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
