# Project Documentation

The current `src/` and `public/` trees define the running system. Documentation
separates verified implementation, forward work, installation direction, and
dated evidence.

## Refactor Workstream

- [Target Architecture](target-architecture.md) — binding target responsibilities,
  diagrams for backend/browser separation, lifetime ownership and direct commands;
  start/frame/end flows, deletion ledger and explicitly open decisions.

- [Roadmap](roadmap.md) — the binding plan, resume checkpoint, issue order,
  M0 checklist, and milestones; start here after context compression.
- [Refactor Workflow](refactor-workflow.md) — implementation-first issue blocks,
  concise GitHub results and completion rules.
- [Refactor Test Plan](refactor-test-plan.md) — targeted checks after a complete issue, browser scenarios,
  performance comparisons and evidence rules.

## Current System

- [Current Status](current-status.md) — implemented behavior; readiness and verification history live elsewhere.
- [Architecture](architecture.md) — runtime composition, ownership, lifecycle,
  and contracts.
- [Architecture Decisions](architecture-decisions.md) — current decisions that
  constrain changes.
- [Engineering Standards](engineering-standards.md) — coding, architecture,
  filename roles, contract vocabulary, file reading order, central CSS and
  documentation rules.
- [Experience](experience.md) — the implemented narrative and interaction flow.
- [Levels](levels/README.md) — the current world-state sequence and presets.
- [World Streaming](world-streaming.md) — fixed windows, scheduling, and
  generation rules.
- [Landscape Modules](landscape-modules.md) — current module ownership and
  cross-module contracts.
- [Platforms](platforms.md) — browser, station, PICO, and PCVR status.
- [Performance](performance.md) — accepted evidence, targets, and open risks.

## Installation Direction

[docs/direction](direction/README.md) contains product and delivery direction
for the Futurium installation. Every statement there is labelled as current,
planned, or open. Open decisions remain in
[Open Decisions](direction/open-decisions.md) and must not be resolved silently.

## Evidence and References

- [Refactor Evidence](evidence/README.md) — dated results and shared run metadata,
  with individual measurements retained under their originating issue.

- [Browser Performance Audit — 2026-09-08](performance-audit-2026-09-08.md)
  records full-show, ten-level, CPU/GPU and loading findings with focused removal-first work packages.
- [Browser Performance Audit — 2026-08-24](performance-audit-2026-08-24.md)
  preserves its dated desktop measurements.
- [Grass Clipmap Review — 2026-09-02](performance-review-grass-clipmap-2026-09-02.md)
  preserves findings against the reviewed revision; current issues decide what
  still applies.
- [Assets](assets/README.md) records shipping structure, provenance and current asset use.
- [Moodboards](moodboards/) preserve visual references, not implementation
  claims.

Keep documents concise. Replace stale claims instead of accumulating competing
histories; keep dated evidence only when its date and scope remain explicit.
