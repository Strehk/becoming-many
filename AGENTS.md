# AGENTS.md

Guidance for AI coding agents working in this repository. Humans are welcome to
read it too.

## Project Status

- **Becoming Many** is a speculative VR experience about layered, non-human
  perception. See [README.md](README.md) for the concept.
- The core experience and its level sequence are largely implemented. Treat
  this entire workstream as a controlled refactor: consolidate ownership,
  preserve clear contracts, and fix causes inside the responsible component.
  Behavior changes remain explicitly identified as bug fixes or features.
- Small product additions remain possible when they answer a concrete current
  need, have a dedicated issue, and can be delivered as a small testable step.
- `src/` and `public/` are the source of truth. The current as-built state is
  documented in [docs/current-status.md](docs/current-status.md), while
  [docs/roadmap.md](docs/roadmap.md) mirrors the remaining issue-backed work.
- Product direction is kept in [docs/direction/](docs/direction/README.md).
  Never implement an open product or deployment decision silently.

## Language

Chat with the user in German.

Everything committed to this repository is written in English: code,
identifiers, file names, comments, commit messages, documentation, and log
output. German is limited to experience content such as `script/de.md`,
narration assets, and audience-facing copy.

## Branch Protection

- Work exclusively on the `david_refactor` branch. Before any file change,
  commit, pull, rebase, merge, or push, verify that `git branch --show-current`
  returns `david_refactor`; stop immediately if it does not.
- Never check out, modify, merge into, rebase, commit to, or push to `main`. All work,
  commits, pulls, rebases, and pushes for this refactor target
  `origin/david_refactor` only.
- Do not create or use additional feature branches. Do not commit or push unless
  explicitly authorized. Preserve existing local changes.

## Required Reading

The linked workflow and test plan are mandatory, including after context
compression. Keep procedures and checklists in those documents, not here.

- [Target Architecture](docs/target-architecture.md): binding refactor direction and
  deletion ledger. Explicitly open decisions remain open; implementation and human
  acceptance follow the roadmap gates.
- [Refactor Workflow](docs/refactor-workflow.md): issue execution, architecture
  review, human gates, GitHub feedback, and completion rules.
- [Refactor Test Plan](docs/refactor-test-plan.md): local checks, browser
  acceptance, performance comparisons, and evidence requirements.
- [Roadmap](docs/roadmap.md): resume checkpoint, M0 preparation, ordered issues,
  milestones, and external dependencies. Start at its resume checkpoint.
- [Engineering Standards](docs/engineering-standards.md),
  [Architecture](docs/architecture.md), and
  [Architecture Decisions](docs/architecture-decisions.md): implementation
  rules and confirmed ownership boundaries.

## Architecture Boundaries

- Contracts and modularity are primary constraints. Small modules own their
  resources and complete lifecycle, and data crosses ownership boundaries only
  through narrow TypeScript contracts.
- Concrete modules never import sibling modules. Extend an existing boundary
  instead of reaching around it or creating a parallel runtime.
- Keep one renderer, one Three.js render loop, and one show-time authority per
  running application. The creator of a resource disposes it.
- Confirmed architecture boundaries are binding. Do not silently change them,
  add competing owners, or conceal a workaround behind a new abstraction.
- Keep runtime work and memory bounded through fixed capacities, pooling,
  recycling, and frame-budgeted jobs.
- All authored configuration is typed TypeScript. JSON under `public/` records
  asset provenance only; do not add JSON, YAML, or environment configuration to
  the application.
- README-only source folders are reserved extension boundaries. Keep their
  READMEs until that product area is either implemented or explicitly retired.

## Toolchain

- Bun manages packages and tests; Vite builds the application; Biome checks
  formatting and lint; Fallow reports export, dependency, duplication, and
  complexity findings.
- Development commands: `bun run dev`, `bun run station`, and
  `docker compose up -d --build` for a complete station container.
- Verification commands and their required cadence live in the test plan.

## Performance

- Performance is the primary product requirement. Follow
  [docs/performance.md](docs/performance.md).
- Target stable 90 Hz on a physical PICO 4. Desktop and deterministic benchmark
  results detect regressions but do not prove headset acceptance.
- Prefer the simplest GPU-friendly path: shared resources, low draw-call count,
  minimal opaque mobile-first shaders, bounded streaming, LOD, culling, and
  explicit disposal.
- A measured performance regression blocks completion until removed or
  explicitly accepted with evidence.

## Documentation and Content

- Documentation lives in `docs/`; [docs/README.md](docs/README.md) is its index.
- Keep `current-status.md` factual, `architecture.md` implementation-based,
  `performance.md` evidence-based, `roadmap.md` forward-looking, and
  `architecture-decisions.md` limited to current confirmed decisions.
- `README.md` introduces the piece to a new reader. Keep vision separate from
  implementation detail.
- `script/en.md` and `script/de.md` are the authoritative narration. Do not
  reword them during engineering or documentation work.
