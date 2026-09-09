# Refactor Evidence

Dated results belong to the issue that produced them. Current readiness and
human decisions live only in the [roadmap](../roadmap.md).

| Packet | Scope |
| --- | --- |
| [2026-09-09 session handoff](2026-09-09-session-handoff.md) | Phone-feedback closeout: commit map, corrected assumptions, reported front-USB recovery and next desktop review |
| [#50 required flight tutorial](issue-50/README.md) | Spatial course, independent performance review, reset preparation and screenshots; open content/physical acceptance |
| [2026-09-08 performance audit](../performance-audit-2026-09-08.md) | Frozen-build full show, ten-level CPU/GPU diagnostics, source attribution and [measurement summary](performance-audit-2026-09-08/summary.json) |
| [UI consolidation](ui-consolidation/README.md) | Declarative surfaces, shared gestures, Entry/World ownership; production/dev browser acceptance and screenshots |
| [#75](issue-75/README.md) | Original tooling gates, smoke, all-level replay, sought transitions and failed English attempt |
| [#77](issue-77/README.md) | Type-only contract relocation, identical build manifest, boundary proof |
| [#78](issue-78/README.md) | Historical counter attribution and unapproved reference diff |
| [#79](issue-79/README.md) | Audio diagnosis/correction, before/after rendering and ordinary final EN/DE |
| [#81](https://github.com/Strehk/becoming-many/issues/81) | Riverbank comparison: [approved 1 m clearance](issue-81-clearance-1m.png), [2.5 m alternative](issue-81-clearance-2_5m.png); source `19308ff`. User approved 1 m lateral clearance from the existing analytic channel boundary with canopy overhang on 2026-09-07; captures precede implementation |
| [#82](issue-82/README.md) | Gather recovery, regression proof, rendering comparison and failed pointer-lock view |

JSON packets keep records under their original report names. References resolve
through [run-contexts.json](run-contexts.json): `identityRef` supplies revision,
source/diff hashes, the shared host and one exact `dirtyFiles` set; `rendererRef`
supplies the actual GPU descriptor; `messageRef` plus `count` preserves repeated
warnings in order; `displayRef` supplies the observed display description.
All individual performance, counter and streaming values remain in their runs.
This is a data index, not a new generator or application format.

Only the oversized exception lexical dump was reduced to the full error stack,
exact scheduling times, relevant state timeline/context and raw capture hash.
Other records reconstruct to their previous values using the shared metadata.
Original full captures remain in ignored `benchmark-results/`; essential facts
are retained here. These records are evidence, not integration or acceptance.
