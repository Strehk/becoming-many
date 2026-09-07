# Refactor Roadmap

This is the single plan and current readiness/review checkpoint. Procedures live
in the [workflow](refactor-workflow.md), [test plan](refactor-test-plan.md) and
[engineering standards](engineering-standards.md). The user's
[target architecture](target-architecture.md) includes the binding decisions of
2026-09-06; only its explicitly remaining operational/content choices are open. Live issues own acceptance criteria.

## Resume Checkpoint — 2026-09-07

| Field | Current state |
| --- | --- |
| Branch / integration | `david_refactor` only; the user authorizes commits and pushes of completed, targeted-tested issues/blocks to `origin/david_refactor` without repeated permission. Verify synchronization; main, force-push and extra branches remain prohibited. |
| Implemented | Checkpoint `49f48ac` preserves the state before tutorial-readiness work. Previous #27/#26/#32 block is committed; #17 → #18 → #38 block accepted at `1434f45`. New block #25 → #85 → #9 is technically implemented: #25 clarifies `activeLevel`, #85 removes duplicate construction, #9 connects awaited child/source lifetime. The size gate remains unmet; ready reduction issues continue. #17 is closed at `eec55bd`; #18 is committed at `b3eeea3`; #18/#38 still await physical acceptance. |
| User feedback | On 2026-09-07 the user said the prepared result looked good and requested continuation, accepting the #17/#18/#38 block and the presented #85 composition proposal. Physical 90 Hz, calibration and #73 uncertainty remain unaccepted. |
| Previous block evidence | #80/#73/#20: production −473, configuration −5, tests +24; no new files/dependencies/owners, three files removed. #20 adds 13 production lines for compile-time validation. Final gates: 487 tests/26,704 assertions, type/lint/build/diff, zero boundaries, smoke 14/14; all nine counters/queue records match #73, with seven inherited #78 reference failures. EN transitions pass 16/16. The earlier #73 Motion observation (+0.725 Show seconds in ten seconds while 599 frames continued) remains unexplained. Exact identities and limits live in [#20](https://github.com/Strehk/becoming-many/issues/20) and [#73](https://github.com/Strehk/becoming-many/issues/73). |
| Next gate | Complete the current issue, test its combined diff, then commit, push and verify synchronization before continuing. #85 construction is decided; concrete visitor restart remains open. |
| Current work | #35 is pushed at `e811596`: Run diagnostic forwarding removed (production −16). #13 is pushed at `34f3e02`: legacy Grass and its exclusive paths retired (production −672, tests −418); #40 closed by that removal. #72 is pushed at `37b801b`: conservative bounds (+20 production), with six fewer draws than disabled culling in both compared views; no timing-speedup claim. #71 adds shared World Surface influences, removes hard visual selection and duplicate smoothing (+46 production, +207 tests). #28 validates both surviving wind consumers with existing tests and a real peak-gust browser run; no code/test additions. #81 implements the approved 1 m lateral clearance with canopy overhang allowed (production −30, tests +16); 27 focused tests, lint/build and 42-candidate browser/projection comparison pass. Next: #41 consolidates proven identical Rocks/Vegetation mechanics. Integrated #13/#71/#72 visual and Windows-PCVR acceptance remain open. |
| Acceptance audit | At clean `2db5755`, independent source/history review found no introduced architecture blocker: existing owners retain one loop/clock/queue; #77 removes the old import route, #79 bounds dispatch history, #82 rejects stale work and removes four redundant staging parameters. Existing startup/disposal gaps remain #73/#9; open target decisions remain open. Application TypeScript +65 lines, test TypeScript +1,300, documentation +1,766, JSON evidence +5,702, reference candidate +74, configuration +91: total +8,998 against `9bfb84b`. This is a qualified technical pass, not human or milestone acceptance. |
| Verified application evidence | Historical final EN/DE each521s without unexpected errors; smoke14/14; repeatable counters/queue, but seven stored #78 references still fail. Exact tested identities and limits are in [evidence](evidence/README.md). |
| Analyzer delta | After #26, Fallow exits 1: 4 dead-code, 11 clone groups, 26 health findings. Two additional estimated-CRAP findings cover bounded retry and its regression scenario; independent review retains the necessary branches without suppression. The extra `ModuleRuntime.load` finding is false positive: `startLevel` directly calls it before activation; no suppression or wrapper was added. New test-only findings are five repeated assertions at distinct legacy-load/post-submit-reload boundaries and estimated CRAP for `checkFlash` (CC7/cognitive5). Independent review retained these meaningful checks without a helper or suppression. Real boundary violations: 0. Older 10/24 and 10/22 results remain historical. |
| Correction verification | 482 tests / 26,639 assertions / 64 files; typecheck, lint, build, real boundaries and diff pass. Smoke 14/14; eight sought cues × first/repeat = 16 transition observations pass. A thrown pageerror in generated `dist/test.html` makes the same smoke fail: 11 affected routes red, three untouched green, 11 failure trace/image pairs; artifact restored byte-for-byte. Logs: `benchmark-results/lean-refactor-20260906T062328Z`. These are functional correction checks, not new performance or full-show measurements. |
| Open acceptance | #80/#73 presented browser feedback accepted; #73 technical verification remains unresolved. #80 physical acceptance, original #75 strict-start cause, #83 automated rejection, exact #78 reference and complete M0 acceptance remain open. |
| Decisions / current work | Binding decisions are recorded in `43133d7`; #85 owns explicit levels. #80 fixed anchor inventory preserves vegetation including bushes, rocks, fixed forest-clearing points and soil. Only moving-animal links are retired. Connections-to-Show construction is confirmed; concrete restart/content choices remain open; #81 bank clearance is approved. |
| External | Actual Windows-PCVR USB-C 90 Hz including transport/headset, M5/ICAROS and venue stations remain unaccepted. Basic #42 commissioning and #54 inventory move early; they do not wait on #14. |

After compression: branch/status, AGENTS, linked rules, this checkpoint, then the
relevant live issue. Continue the authorized bounded issue work; do not
restart the inventory or infer approval from green tests. #77's existing-file
placement was [authorized before implementation](https://github.com/Strehk/becoming-many/issues/77#issuecomment-5554801541).

## Autonomous Review

On 2026-09-07 the user authorized autonomous continuation through the active
goal below, without mandatory user testing or intermediate human acceptance.
The subsequent implementation-first instruction also removes fixed review
cadences: implement a coherent issue, test its combined changes, fix failures,
then commit, push and verify synchronization before continuing. The workflow and test plan own check
selection; do not restart inventories or repeat intermediate checks. Explicitly
open decisions remain binding. Missing hardware evidence blocks only genuinely dependent work and
must not be reported as verified. See the [workflow](refactor-workflow.md).

The user accepted the prepared #17/#18/#38 block at `1434f45` and requested
continuation with the presented #85 proposal. `49f48ac` remains the earlier
checkpoint. The #25/#85/#9 cumulative review preserves the existing owners and removes forwarding, but records net production growth; physical, listening and unresolved #73
clock acceptance remain separate.

Readability review: Runtime tells startup and input/Show/frame coordination;
World owns preparation and render; the old forwarding chain and unused animal
link capability are gone. #20 only validates at the existing compile hook.
The current New visitor action remains a time/position reset, not complete Run
termination; #9 and its concrete operating proposal still own that target.
The exact #78 candidate remains unapplied; Windows-PCVR USB-C 90 Hz remain unaccepted. #9 software lifetime evidence is recorded; the concrete visitor operation stays open. Essential previous measurements stay in their
live issues and [evidence index](evidence/README.md).

## Milestones and Ordered Work

All stages follow implementation blocks and targeted final checks under the
workflow and test plan, without fixed milestone reviews or routine user stops.
Continue ready prerequisites toward the active goal. Early physical commissioning remains relevant where equipment
is available; document missing evidence and continue independent work.

| Milestone | Ordered scope | Gate |
| --- | --- | --- |
| M0 | Retain #21/early #11/#75/#77/#79/#82 evidence; bounded #78 reference investigation | Exact inspected reference proposal and complete M0 acceptance remain open |
| M1 | Committed #80/#73/#20 with continuation authorized; #27 before independent measured #26/#32 work | Targeted verification of the completed issue; no routine user stop |
| M2 | Early #42 commissioning + #54 inventory; #9 lifecycle and #16 preparation; #14 diagnostics; #85 explicit levels; #35 → #36 shared UI ownership; final #11 | Concrete restart proposal first; #85 construction approved; dependent lifecycle and physical checks below |
| M3 | #17 → #18 → #38 → #25; #46 visitor handoff → #33 physical flight | Actual Windows-PCVR/M5 calibration and operator acceptance |
| M4 | #26, #32; #13 → #72 → #71 → #81 → #41; verify #40 retirement and #28 final wind consumers | Comparable local evidence, approved bank-rule parity, Windows-PCVR USB-C 90 Hz |
| M5 | Required #50 tutorial and #51 credits; decision-bound #29 and #47 → #48/#49 | Explicit content/timing/rights/input decisions before dependent work |
| M6 | Complete #42/#54, full operation and integration handover | Repeated visitors, real stations, failure recovery, exact proposed commit set |

[Tracker #76](https://github.com/Strehk/becoming-many/issues/76) mirrors this plan.
#13 migration follows #35 to remove the largest ready duplicate implementation; its #71/#72 and physical acceptance remain separate. #84 CSS consolidation remains separately scoped and unscheduled; it does not
silently expand the current block. #13’s migration/removal stage precedes
#72/#71, but its final integrated acceptance may wait for those corrections;
do not require #13 to close before implementing its dependent corrections. #22 remains closed not planned: retain the
actively consumed Material override and its compatibility evidence.

### Active goal: prepare the opening tutorial

Resolve the important prerequisites so the existing system can host the opening
tutorial. Tutorial content and implementation (#50), and unrelated product
additions, are outside this goal. Do not count proposals or pending acceptance
as resolved issues. Every implementation block must reduce production code.

| Priority | Existing issues | Readiness requirement |
| --- | --- | --- |
| 1 | #17 → #18 → #38; #25 only if still needed | One validated flight-input path with complete host replacement and clear ownership. |
| 2 | #9, #16, #14, #85 | Complete Run lifetime, one prepared world, bounded diagnostics and explicit level/show construction. Restart choice precedes dependent implementation; #85 construction approved. |
| 3 | #35 → #36, #42/#54 → #46 | Shared commands and a validated visitor start/calibration flow. Obtain Windows-PCVR operating facts early. |
| 4 | #73, #26/#32 and relevant rendering blockers | Resolve clock uncertainty and verify target installation performance; local browser checks alone are insufficient. |

#25/#85/#14 and #35 software removal are complete; #9 software lifetime and #16 cold-upload preparation are implemented. #13 retires legacy Grass; continue #72/#71 while physical and restart acceptance remain open.
Prepare the concrete visitor restart before dependent changes.
Keep the tutorial's content, duration, audio rights and learning tasks open.

## Immediate Work and Dependencies

| Work | Smallest scope / prerequisite |
| --- | --- |
| Autonomous continuation | #17/#18/#38 accepted at `1434f45`; continue #25/#85 and ready prerequisites through the active goal without mandatory user tests. Separate physical, listening and #73 uncertainty gates stay open. |
| #42 + #54, start early | Obtain the actual Windows/GPU/driver/browser/XR/streaming/USB/headset matrix and reproduce entry/re-entry/audio/operator behavior with existing tools. Basic commissioning does not require #14; later diagnostic detail can use it. No Mac substitute for physical results. |
| #78, bounded investigation | Fix a camera pose and comparable conditions, identify intended scene/available contents, repeat counters and explain significant differences. Then propose the exact checked reference. No exhaustive historical-triangle archaeology and no automatic baseline update. |
| #80, technically implemented | Remove animal–Mycelium producers, projections, contracts, wiring, reserved pool ranges, settings and exclusive tests together. First enumerate existing fixed anchor classes. Preserve animal animation/movement and Scent/Thermal data; no other content removal. |
| #73, source implemented; verification blocked | Flatten startup at existing Runtime/Composition owners, retaining one frame order and directly readable start/frame/end. This simplification alone does not claim complete teardown. |
| #20, locally verified | Active anchors fail explicitly before partial mutation; valid shader output is unchanged. Continuation authorized after the cumulative report; issue-specific acceptance remains in GitHub. |
| #9 | Use #73's direct startup. Present the smallest visitor restart sequence using #42 evidence before selecting its mechanism. Prepare owner-local cleanup, failed/cancelled starts and late results; only expose complete termination once every child/source lifetime is covered. A reload candidate is not approved automatically. |
| #16 | Reconcile the partly implemented cold-transition work first. Use one preparation/resource/background strategy and preserve the world during a visit. Measure first/repeated transitions; coordinate #9 lifetimes and #85 configuration, no per-level workaround. |
| #14 | Keep probes/renderers out of normal Experience operation. Diagnosis owns measurement/display; World exposes existing renderer facts by small reads. Can prepare this owner-local separation before #9, but complete cleanup acceptance depends on #9. Startup failures stay visible. |
| #85 (D3) | Approved: explicit Connections preset constructs the Show once; states retain presentation/timing. Delete the separate Show recipe/type/request field. Compare effective settings; missing module is absent, optional settings use module defaults, invalid required settings fail during preparation. Remove layers, hidden overrides and exclusive helpers/tests together. |
| #35 → #36; final #11 | After relevant #9/#16/#14 work, remove metrics round trips and duplicate commands/reset rules. Show owns playback/language/time; existing Runtime owns visitor restart; UIs own input/display. Preserve the useful lazy Test loader. Finish boundary rules after entry/ownership changes, with no command bus or UI store. |
| #27 → #26 | #27 locally verified; #26 has fresh comparable Scent measurements and removes the synchronous queue fallback inside existing owner/queue semantics. Investigate long replay intervals separately; retain comparison failures and actual physical acceptance. |
| #17 → #18 → #38 → #25 | Isolate M5 host lifetime, validate samples/calibration and one control boundary, then rename actual ownership. Physical polarity/rig evidence remains necessary. |
| #46 → #33 | After #9 and physical control chain, settle calibration/hold-or-play/flight sequence on the actual Windows-PCVR setup, then accept XR flight. Clock reset alone is insufficient. |
| #13 → #72 → #71 | Clipmap owner is decided. Remove complete legacy Grass path and exclusive tests in #13; compare bounds correction/culling disable in #72. World Surface owns shared continuous weights in #71. |
| #81 → #41 | Vegetation owns one placement decision used by rendering, Scent and Mycelium; World Surface supplies terrain/river/zones. Coordinate shared weights from #71. Apply the approved 1 m lateral clearance from the existing analytic channel boundary, canopy overhang allowed; remove competing checks, model footprints and fallback calculations. Reassess remaining Rocks/Vegetation duplication afterward. |
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
