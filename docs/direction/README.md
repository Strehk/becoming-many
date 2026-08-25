# Installation Direction

The as-built documentation ([architecture](../architecture.md),
[engineering standards](../engineering-standards.md),
[architecture decisions](../architecture-decisions.md),
[current status](../current-status.md), [roadmap](../roadmap.md)) describes and
governs the current code — **it takes priority**.

These direction documents describe where the piece is headed as a Futurium
installation: deployment, dramaturgy, controls, operations, and headset
integration. They were distilled from the pre-import design sessions
(2026-08-21/22) and the reference-project findings. Where a direction conflicts
with the current implementation or standards, the conflict is recorded in
[Open Decisions](open-decisions.md) and resolved by discussion — never silently
in code.

Each document is self-contained so a task can load only the module it needs.

## Documents

- [Open Decisions](open-decisions.md) — unresolved conflicts and TODOs. Read
  this first before starting work that touches one of them.
- [Deployment](deployment.md) — the two-station Futurium topology and its
  consequences.
- [Senses](senses.md) — the sense-layer model, module contract direction, and
  the reference-project extraction map.
- [Dramaturgy and Audio](dramaturgy-audio.md) — schedule, narration languages,
  audio direction.
- [Controls and M5](controls-m5.md) — ICAROS rig input, the M5 transport,
  firmware, and setup tooling.
- [Session and Operator](session-operator.md) — session state machine and
  operator page.
- [Headset](headset.md) — PICO integration: see-through switching, headset
  agent, provisioning, rejected alternatives.
- [Rendering Constraints](rendering-constraints.md) — hard-won GPU/WebXR
  constraints that hold regardless of the open stack decisions.
- [Quality and Operations](quality-operations.md) — spikes, evidence rules, CI
  and station-acceptance direction.
- [Architecture Review — 2026-08-22](architecture-review-2026-08-22.md) — dated
  critical review of the pre-import architecture draft (historical context).

## Sequencing

Near-term implementation follows the [roadmap](../roadmap.md). The installation
work phases in after the landscape and performance milestones, roughly: senses
and dramaturgy → session/operator → hardware (M5 firmware, headset agent,
provisioning) → station acceptance. The spikes in
[Quality and Operations](quality-operations.md) run before the work that
depends on them.
