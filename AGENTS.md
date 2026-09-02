# AGENTS.md

Guidance for AI coding agents working in this repository.

## Authority

- `src/` and `public/` are the source of truth for implemented behavior and
  assets.
- Follow [Engineering Standards](docs/engineering-standards.md),
  [Architecture](docs/architecture.md),
  [Architecture Decisions](docs/architecture-decisions.md), and
  [Performance](docs/performance.md). Keep
  [Current Status](docs/current-status.md) factual and
  [Roadmap](docs/roadmap.md) forward-looking.
- [Todo](docs/todo/) defines the scoped cleanup and stabilization work. Read the
  relevant task before editing, but verify its claims against the current code.
- Future installation direction lives in [docs/direction](docs/direction/).
  Never resolve an [open decision](docs/direction/open-decisions.md) silently.

## Language

Everything committed to this repository is written in English: code,
identifiers, file names, comments, logs, documentation, and commit messages.
German is limited to audience-facing content such as
`docs/narration/de.md`.

## Current Phase: Stabilize and Simplify

- Work on one open todo at a time. Prioritize security, control safety,
  installation, performance, reliability, and contract defects before cosmetic
  cleanup.
- Reproduce or prove the problem before changing code. Preserve behavior unless
  the task explicitly changes it, and add a regression test for a bug fix.
- Make the smallest testable change. Prefer deletion, consolidation, and an
  existing owner over a new abstraction, dependency, framework, or parallel
  runtime.
- Remove superseded code, tests, configuration, and documentation completely.
  Do not retain compatibility layers, no-op hooks, or speculative extension
  points without a current consumer.
- Keep ownership boundaries strict: one composition root, one render loop,
  small explicit TypeScript contracts, no concrete sibling-module imports, and
  no global mutable state, event bus, service locator, or hidden singleton.
- Resource creators own complete, idempotent teardown. Runtime work and memory
  stay bounded; hot paths remain allocation-free where practical.
- Validate every consumer when changing a shared contract, setting, shader,
  world fact, lifecycle, or control path.
- Keep authored configuration in typed TypeScript. JSON under `public/` records
  asset provenance only.

## Delivery Platform

- This repository targets only the Windows PC VR installation.
- The Three.js/WebXR application runs and renders on the station PC. SteamVR is
  the selected PC VR runtime, and PICO Business Streaming carries the session
  to a PICO headset over a wired USB connection.
- The headset is a streamed display and tracking endpoint, not the application
  runtime. Do not add standalone Android/PICO builds, mobile platform profiles,
  or on-headset application code here.
- A later standalone PICO edition will be implemented in a separate, reduced
  fork. Keep shared Experience code independent from PC-only operator and
  diagnostic composition so that fork can remove those concerns cleanly.

## Performance Gate

- Performance regressions block completion. Use the targets, evidence rules,
  and current limitations in [Performance](docs/performance.md).
- For performance-sensitive work, record comparable before-and-after evidence
  on the same route and rendering path. Run the deterministic benchmark and
  require a `passed` physical PCVR result before merge. `not yet tested` is a
  draft state only, or a final state for work whose diff cannot affect the
  runtime path; it is never performance acceptance.
- Desktop and headless results are diagnostic evidence, not physical-headset
  acceptance. Do not claim a target frame rate without a complete wired PC VR
  run that includes rendering, encoding, USB transport, decoding, and headset
  presentation.
- Reduce work, content, draw calls, shader cost, allocations, and overdraw
  before adding LOD systems, workers, adaptive quality, extra passes, or new
  rendering architecture.

## Workflow and Completion

1. Inspect the relevant todo, owning modules, contracts, tests, and current
   documentation. Check installed library versions and official documentation
   before relying on an API.
2. Plan and implement the smallest complete patch. Do not mix unrelated todos
   or broad cleanup into it.
3. Run focused tests during development. Before a checkpoint, run `bun test`,
   `bun run check`, `bun run lint`, `bun run build`, and `fallow`.
4. For browser, XR, control, lifecycle, visual, or performance behavior, also
   verify the real runtime path required by the task. Passing static gates alone
   is insufficient.
5. Update only affected as-built documentation and measured evidence. Remove
   stale statements instead of documenting contradictions.

Keep `main` clean and merge only verified work. Do not commit or push unless the
user asks. `docs/narration/` is authoritative voiceover content; do not reword
it during code or cleanup work.
