# Project Documentation

The current `src/` and `public/` trees define the running system. These
documents explain that implementation and keep future product direction
separate from verified technical status.

## Current System

- [Current Status](current-status.md) — implemented runtime, verification state, known gaps, and recommended next steps.
- [Engineering Standards](engineering-standards.md) — coding, architecture, Three.js, documentation, and validation rules.
- [Architecture](architecture.md) — current project structure, ownership boundaries, contracts, and lifecycle.
- [World Streaming](world-streaming.md) — current chunk window, stream queue, Air Particles consumer, and extension rules.
- [Landscape Module Contracts](landscape-modules.md) — current boundaries for Rivers, Vegetation, Grass, Rocks, and Animals.
- [Performance](performance.md) — current evidence, target metrics, and acceptance gates.
- [Browser Performance Audit — 2026-08-24](performance-audit-2026-08-24.md) — measured browser bottlenecks, diagnostic A/B runs, and prioritized fixes.
- [Performance Review — grass-clipmap (PR #8) — 2026-09-02](performance-review-grass-clipmap-2026-09-02.md) — verified review findings held as an improvement backlog; reconcile against the parallel performance rewrite before acting.
- [Refactor Checklist](refactor-checklist.md) — operational issue queue and the required session, verification, simplification, and pull-request workflow.
- [Stabilization Todo](todo/README.md) — audit findings to revalidate against current code before implementation.

## Product and Delivery Direction

- [Experience](experience.md) — continuous flight, world states, audio, and AR/VR transitions.
- [Levels](levels/README.md) — detailed intent, behavior, transitions, and future art-direction structure for every world state.
- [Platforms](platforms.md) — selected Windows/SteamVR/wired-PICO delivery target and acceptance boundary.
- [Roadmap](roadmap.md) — outcome-based order for the stabilization backlog.
- [Architecture Decisions](architecture-decisions.md) — confirmed decisions that constrain future implementation.
- [Installation Direction](direction/README.md) — where the piece is headed at the Futurium: deployment, senses, dramaturgy, controls, operator, headset. Subordinate to the current-system documents; conflicts are tracked in [Open Decisions](direction/open-decisions.md).

## Assets and Visual References

- [Animal Assets](assets/animals.md) — verified source models, current integration, and animation requirements.
- [Rock Assets](assets/rocks.md) — CC0 source models and current instanced runtime use.
- [Tree and Shrub Assets](assets/trees.md) — verified vegetation sets and current instanced runtime use.
- [World Look and Moodboard References](moodboards/world-look-and-moodboard-references.md) — supplied visual references for atmosphere, perception cues, and runtime direction.
- [Stylized World Mood References](moodboards/stylized-world-mood-references.md) — abstract network, contrast, flow, and fauna directions.

## Reference Projects

Existing repositories are principle sources, not architectures to copy:

- [pico-remote-control](https://github.com/dweigend/pico-remote-control) — PICO operations, remote commands, and telemetry.
- [EZ-Tree-Demo](https://github.com/dweigend/EZ-Tree-Demo) — streamed terrain, ecology fields, flight, and benchmarks.
- [magnetic-sense-webxr](https://github.com/dweigend/magnetic-sense-webxr) — GPU clipmaps, instanced grass, and magnetic shaders.
- [scent-particles](https://github.com/dweigend/scent-particles) — GPU scent particles and simple animal routes.
- [wurzeln](https://github.com/dweigend/wurzeln) — procedural root and mycelium networks.

Keep documentation short. Update it only when a decision changes or measured evidence becomes available.
