# AGENTS.md

Guidance for AI coding agents working in this repository. Humans are welcome to
read it too.

## Project Status

- **Becoming Many** is a speculative VR experience about layered, non-human
  perception. See [README.md](README.md) for the concept.
- The core experience and its level sequence are largely implemented. Current
  work focuses on measured performance improvements, stability, code cleanup,
  and issue fixes.
- Small product additions remain possible when they answer a concrete current
  need, have a dedicated issue, and can be delivered as a small testable step.
- `src/` and `public/` are the source of truth. The current as-built state is
  documented in [docs/current-status.md](docs/current-status.md), while
  [docs/roadmap.md](docs/roadmap.md) mirrors the remaining issue-backed work.
- Product direction is kept in [docs/direction/](docs/direction/README.md).
  Never implement an open product or deployment decision silently.

## Language

Everything committed to this repository is written in English: code,
identifiers, file names, comments, commit messages, documentation, and log
output. German is limited to experience content such as `script/de.md`,
narration assets, and audience-facing copy.

## Working Method

- Work on one issue at a time. Before changing code, verify that the issue still
  describes the current checkout, reproduce the problem where possible, and
  identify the smallest complete fix.
- Follow [docs/engineering-standards.md](docs/engineering-standards.md). Prefer
  removal, reuse, and simplification before adding abstractions or dependencies.
- Keep changes focused. Do not combine unrelated cleanup with an issue fix.
- Ask when work depends on an unwritten or open decision. Do not hide product or
  architecture choices inside implementation details.
- Update affected documentation and issue descriptions when code changes make
  them stale. Keep current facts, plans, and historical evidence separate.
- Finish each change with its relevant verification gates passing, or state
  exactly what remains unverified.
- Develop on feature branches. Do not commit or push unless asked.

## Architecture Boundaries

- Contracts and modularity are primary constraints. Small modules own their
  resources and complete lifecycle, and data crosses ownership boundaries only
  through narrow TypeScript contracts.
- Concrete modules never import sibling modules. Extend an existing boundary
  instead of reaching around it or creating a parallel runtime.
- Keep one Three.js render loop. The creator of a resource disposes it.
- Keep runtime work and memory bounded through fixed capacities, pooling,
  recycling, and frame-budgeted jobs.
- All authored configuration is typed TypeScript. JSON under `public/` records
  asset provenance only; do not add JSON, YAML, or environment configuration to
  the application.
- README-only source folders are reserved extension boundaries. Keep their
  READMEs until that product area is either implemented or explicitly retired.

## Toolchain and Verification

- Bun manages packages and tests; Vite builds the application; Biome checks
  formatting and lint; Fallow reports export, dependency, duplication, and
  complexity findings.
- Development commands: `bun run dev`, `bun run station`, and
  `docker compose up -d --build` for a complete station container.
- Before checkpoints and commits, run `bun test`, `bun run check`,
  `bun run lint`, `bun run build`, and `bunx fallow`.
- `bun run benchmark` replays a deterministic browser route after a current
  build. It is separate from the standard test suite.

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
