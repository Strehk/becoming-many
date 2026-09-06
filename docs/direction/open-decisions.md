# Open Decisions

The [target architecture](../target-architecture.md) and [confirmed decisions](../architecture-decisions.md)
record the approved direction. This document lists only remaining choices;
[roadmap](../roadmap.md) owns execution order and current acceptance.

| Decision | Concrete proposal and evidence required | Blocks |
| --- | --- | --- |
| Visitor restart and operator sequence | Evaluate a full-page reload on Windows-PCVR over USB-C: XR termination/re-entry, audio permission, staff actions and failure recovery. Recommend the smallest working sequence. Complete old-run termination and fresh startup are mandatory; reload is not yet selected. | #9 restart implementation; #46 visitor handoff; final #36 operations |
| Independent level/show construction | Present the smallest direct way for explicit TypeScript levels to prepare one world per visit without a contradictory second configuration. Compare current effective settings, document module defaults and preparation errors; remove layer/spread helpers together. | D3 level migration; coordinate preparation with #16 |
| Vegetation ground clearance | Show the same small bank area using one model-independent ground-distance rule. Recommend a distance and whether crown overhang is allowed; species-specific distances belong to existing definitions only when necessary. Vegetation alone owns acceptance. | #81 visible placement change; subsequent #41 consolidation |
| Benchmark reference | #78 uses a defined pose, intended scene/assets, repeated counters and a bounded explanation of significant differences. Propose the exact checked scene/reference afterward; the existing candidate is not approved. | Reference update and complete M0 acceptance |
| Required tutorial | Present content, duration, audio-use rights and start/input behavior using existing show ownership. Whether a tutorial is needed is settled. | #50 final implementation after #46 flow |
| Required credits | Present final copy/order, longest-language duration, audio-use rights, start and flight behavior. Consolidate existing credits under the show clock. | #51 completion |
| Animal motion and encounters | Reconcile current #29 arc/lookahead behavior; for #47–#49 propose course-relative versus gaze-guaranteed passages, cue overlap and approved Bat asset. | Only those motion/encounter changes |
| Physical operation | Exact Windows/GPU/driver/browser/XR/streaming/cable/headset matrix, M5 polarity/calibration, safety/see-through procedures, venue network and recovery duration. | #42/#33/#18/#38/#46/#54 physical acceptance |

Windows-PCVR over USB-C is decided, with stable 90 Hz measured across the actual
installation. Standalone PICO is a later separate project. Do not reopen a platform
contest or prebuild standalone paths. Early #42/#54 evidence informs restart;
basic commissioning does not depend on completing #14's diagnostic cleanup.

D1/D2/D6 lifecycle, shared commands and diagnostic separation are approved.
D3 explicit levels and D4 animal–Mycelium removal are approved. D4 must inventory
existing fixed anchor classes before removing anything beyond animal links;
animal animation, movement, Scent and Thermal information remain intact.

No additional runtime, command bus, UI state store, general world-object manager
or audit framework is authorized. An Android agent or technician CLI needs a
concrete unmet requirement and a separate owner/consumer/removal decision. Routine
implementation choices remain with the implementer; new ownership, unexplained
production growth and unplanned content changes require a concrete proposal.
