# Project Documentation

The current `src/` and `public/` trees define the running system. Documentation
separates verified implementation, forward work, installation direction, and
dated evidence.

## Current System

- [Current Status](current-status.md) — concise implementation and verification
  snapshot.
- [Architecture](architecture.md) — runtime composition, ownership, lifecycle,
  and contracts.
- [Architecture Decisions](architecture-decisions.md) — current decisions that
  constrain changes.
- [Engineering Standards](engineering-standards.md) — coding, architecture,
  documentation, and validation rules.
- [Experience](experience.md) — the implemented narrative and interaction flow.
- [Levels](levels/README.md) — the current world-state sequence and presets.
- [World Streaming](world-streaming.md) — fixed windows, scheduling, and
  generation rules.
- [Landscape Modules](landscape-modules.md) — current module ownership and
  cross-module contracts.
- [Platforms](platforms.md) — browser, station, PICO, and PCVR status.
- [Performance](performance.md) — accepted evidence, targets, and open risks.
- [Roadmap](roadmap.md) — remaining issue-backed work only.

## Installation Direction

[docs/direction](direction/README.md) contains product and delivery direction
for the Futurium installation. Every statement there is labelled as current,
planned, or open. Open decisions remain in
[Open Decisions](direction/open-decisions.md) and must not be resolved silently.

## Evidence and References

- [Browser Performance Audit — 2026-08-24](performance-audit-2026-08-24.md)
  preserves its dated desktop measurements.
- [Grass Clipmap Review — 2026-09-02](performance-review-grass-clipmap-2026-09-02.md)
  preserves findings against the reviewed revision; current issues decide what
  still applies.
- [Assets](assets/) records provenance and current asset use.
- [Moodboards](moodboards/) preserve visual references, not implementation
  claims.

Keep documents concise. Replace stale claims instead of accumulating competing
histories; keep dated evidence only when its date and scope remain explicit.
