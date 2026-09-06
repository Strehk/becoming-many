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
| Implemented | Historical #21/early #11/#75 and #77/#79/#82 blocks reviewed. After the independent review and prepared human checks, the user confirmed all presented behavior works and authorized commits and the next wave. New wave count: 3/3 (#12/#74/#39); cumulative human review now due. |
| User feedback | On 2026-09-06 the user confirmed all three presented browser checks work: mouse look/Escape/relock, Connections movement/standstill, and Echo pause/backward seek/resume with EN/DE listening. This accepts the reviewed local behavior at `0e064cb` (application unchanged from `2db5755`). No physical-device result or exact numerical reference approval was reported. |
| Current work | Human acceptance committed as `2c8bdaa`. #12 removes persisted/restored passwords and redacts logs; independent review, 482 tests/static gates and headed smoke 14/14 pass. Its regression fails on the old application (Flash only, 13 other routes pass). #74 removes the development proxy and unused port wrapper; 482 tests/static gates, development and production smoke each 14/14, and empty/configured Station browser checks pass. #39 removes the second World modulo implementation; 484 tests, typecheck/lint/build/diff, zero boundary violations and production smoke 14/14 pass. All nine quick counter/streaming records match retained #82 exactly; `--check` still fails only the seven unchanged #78 references. Wave complete technically; await cumulative human review before the reordered next local block #80 → #73 → #20. #83 human input now passes; the prior automated rejection remains preserved without an assigned cause. #22 remains closed not planned. |
| Next gate | The user explicitly authorized the next wave after accepting the presented block. This scoped continuation proceeds while #78 remains open and its baseline unchanged; it does not declare complete M0/reference acceptance. Cumulative human review of #12/#74/#39 is now due before further implementation. Independent cumulative review passes: application/Station/Vite net −26 lines, test TypeScript +98, one obsolete file deleted, no new files/dependencies/runtime owners. |
| Acceptance audit | At clean `2db5755`, independent source/history review found no introduced architecture blocker: existing owners retain one loop/clock/queue; #77 removes the old import route, #79 bounds dispatch history, #82 rejects stale work and removes four redundant staging parameters. Existing startup/disposal gaps remain #73/#9; open target decisions remain open. Application TypeScript +65 lines, test TypeScript +1,300, documentation +1,766, JSON evidence +5,702, reference candidate +74, configuration +91: total +8,998 against `9bfb84b`. This is a qualified technical pass, not human or milestone acceptance. |
| Verified application evidence | Historical final EN/DE each521s without unexpected errors; smoke14/14; repeatable counters/queue, but seven stored #78 references still fail. Exact tested identities and limits are in [evidence](evidence/README.md). |
| Analyzer delta | After #12, Fallow remains exit 1: 3 dead-code, 11 clone groups, 25 health findings. New test-only findings are five repeated assertions at distinct legacy-load/post-submit-reload boundaries and estimated CRAP for `checkFlash` (CC7/cognitive5). Independent review retained these meaningful checks without a helper or suppression. Real boundary violations: 0. Older 10/24 and 10/22 results remain historical. |
| Correction verification | 482 tests / 26,639 assertions / 64 files; typecheck, lint, build, real boundaries and diff pass. Smoke 14/14; eight sought cues × first/repeat = 16 transition observations pass. A thrown pageerror in generated `dist/test.html` makes the same smoke fail: 11 affected routes red, three untouched green, 11 failure trace/image pairs; artifact restored byte-for-byte. Logs: `benchmark-results/lean-refactor-20260906T062328Z`. These are functional correction checks, not new performance or full-show measurements. |
| Open acceptance | The previous block’s human browser/visual/listening and cumulative review are accepted; current #12/#74/#39 review remains due. Original #75 strict-start cause remains unassigned despite a distinct #79 fix; the #83 automated failure remains historical evidence. Exact #78 reference approval and complete M0 acceptance remain open. |
| Decisions / current work | D1/D2/D3/D4/D6, one Vegetation placement owner, Windows-PCVR USB-C and required tutorial/credits are confirmed on 2026-09-06. Canonical documents and live issues replace contrary statements. This is not implementation or acceptance of the current 3/3 wave. #85 owns D3; concrete remaining decisions are listed below. |
| External | Actual Windows-PCVR USB-C 90 Hz including transport/headset, M5/ICAROS and venue stations remain unaccepted. Basic #42 commissioning and #54 inventory move early; they do not wait on #14. |

After compression: branch/status, AGENTS, linked rules, this checkpoint, then the
relevant live issue. Continue the authorized bounded issue work; do not
restart the inventory or infer approval from green tests. #77's existing-file
placement was [authorized before implementation](https://github.com/Strehk/becoming-many/issues/77#issuecomment-5554801541).

## Human Review

The user accepted the previous block on 2026-09-06 at `0e064cb` and authorized
this wave. The current #12/#74/#39 wave is technically complete and awaits its
own cumulative review. Production Station is available at `http://localhost:4180`.
The tested source digest is
`6d937a09592c5f147e5a9f10aa4eb956b0652ca5aedfbbc93a4867e7ac9ea6d5`;
subsequent checkpoint edits are documentation only. Live issues retain the
commands, exact identities and essential results; raw output stays ignored.

| Action | Expected behavior / review |
| --- | --- |
| Open `/flash.html`, then reload | Familiar setup interface; password field stays empty. SSID/device identity may be remembered. Automated real-form/isolated-port checks prove legacy-secret removal, unchanged serial delivery and redacted logging; no physical flashing is requested. |
| Conductor wake, Play/Hold, EN/DE and New visitor | Controls remain usable; new visitor returns to paused time zero. Development and configured production were checked separately under #74. |
| Test/Connections: move, then stand still | Existing scene/streaming behavior remains intact. #39 changes only where the identical slot arithmetic is defined. |
| Review the three focused changes | Passwords are transient at Flash; Station owns its port; both chunk windows reuse one existing World function. No new owner or dependency. Application/Station/Vite −26 lines; purposeful test TypeScript +98. |

The [exact #78 candidate](evidence/issue-78/quick-reference-candidate.diff) remains
unapplied; [historical attribution and uncertainty](evidence/issue-78/README.md)
remain open despite matching current counters. Actual Windows-PCVR USB-C 90 Hz and full
Run disposal are not established by this wave. D4/#80 removal is now authorized,
but the cumulative human gate remains: do not start the next implementation
before reviewing #12/#74/#39. The current New visitor action above remains only
a time/position reset; it does not meet the newly confirmed full restart target.

## Milestones and Ordered Work

All stages use the same three-implemented-issue cumulative human gate. An issue
may prepare a concrete proposal or gather read-only evidence while implementation
waits for its actual dependency. No new production code crosses the current 3/3
gate. Early physical commissioning is not deferred until the last milestone.

| Milestone | Ordered scope | Gate |
| --- | --- | --- |
| M0 | Retain #21/early #11/#75/#77/#79/#82 evidence; bounded #78 reference investigation | Exact inspected reference proposal and complete M0 acceptance remain open |
| M1 | Review implemented #12/#74/#39; next local block #80 → #73 → #20; #27 before #26 | Human 3/3 review before new code, then next cumulative review after #80/#73/#20 |
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
| Current human gate | Review #12/#74/#39 using the prepared actions above. User decisions about future architecture do not count as this behavior review. |
| #42 + #54, start early | Obtain the actual Windows/GPU/driver/browser/XR/streaming/USB/headset matrix and reproduce entry/re-entry/audio/operator behavior with existing tools. Basic commissioning does not require #14; later diagnostic detail can use it. No Mac substitute for physical results. |
| #78, bounded investigation | Fix a camera pose and comparable conditions, identify intended scene/available contents, repeat counters and explain significant differences. Then propose the exact checked reference. No exhaustive historical-triangle archaeology and no automatic baseline update. |
| #80, next local issue after gate | Remove animal–Mycelium producers, projections, contracts, wiring, reserved pool ranges, settings and exclusive tests together. First enumerate existing fixed anchor classes. Preserve animal animation/movement and Scent/Thermal data; no other content removal. |
| #73, after #80 | Flatten startup at existing Runtime/Composition owners, retaining one frame order and directly readable start/frame/end. This simplification alone does not claim complete teardown. |
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
