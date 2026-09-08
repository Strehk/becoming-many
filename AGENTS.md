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
- Do not create or use additional feature branches. Preserve existing local changes.
- The user authorizes ongoing commits and pushes of completed, targeted-tested
  issues or coherent blocks to `origin/david_refactor`. Verify push success;
  never force-push. Follow the existing workflow, without repeated permission requests.

## Required Reading

Read the workflow, test plan and roadmap checkpoint when starting or resuming;
then read only the architecture sections relevant to the current issue.
Implement a coherent issue first, test the combined change once, repair actual
failures, then commit when authorized. Do not test every edit or turn issue
maintenance into the main work. The workflow and test plan own process and
verification cadence; historical checklists do not add recurring gates. Keep
procedures in those documents, not here.

- [Target Architecture](docs/target-architecture.md): binding refactor direction and
  deletion ledger. Explicitly open decisions remain open; the roadmap identifies
  dependencies and remaining product or physical acceptance.
- [Refactor Workflow](docs/refactor-workflow.md): implementation-first execution,
  concise GitHub results and completion rules.
- [Refactor Test Plan](docs/refactor-test-plan.md): local checks, browser
  acceptance, performance comparisons, and evidence requirements.
- [Roadmap](docs/roadmap.md): resume checkpoint, M0 preparation, ordered issues,
  milestones, and external dependencies. Start at its resume checkpoint.
- [Engineering Standards](docs/engineering-standards.md),
  [Architecture](docs/architecture.md), and
  [Architecture Decisions](docs/architecture-decisions.md): implementation
  rules and confirmed ownership boundaries.

## Architecture Boundaries

- Follow the [Engineering Standards](docs/engineering-standards.md) for
  architectural filename roles, contract names, file reading order and central
  styling. Keep Entry, UI, browser Engine and Station backend responsibilities
  separate as defined by the [Target Architecture](docs/target-architecture.md).
- Conductor pages/panels own input and display only. Entry connects browser
  startup to Run; Show and Run own playback and experience lifecycle policy.
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
  the application. Each level is one self-contained literal parameter object:
  type-only imports are allowed; value imports, helpers, spreads and inheritance
  are not. Repeated authored values are preferable to hidden configuration.
- README-only source folders are reserved extension boundaries. Keep their
  READMEs until that product area is either implemented or explicitly retired.

## Declarative UI

- All authored browser HTML/SVG structure and UI controllers live under `src/ui/`.
  HTML declares fixed controls and templates; TypeScript binds behavior and updates
  observations without markup strings, parsing sinks or authored DOM constructors.
- Browser bootstrap lives under `src/entry/`; pure deployment/route contracts live
  in `shared/`. Station imports no browser source.
- World borrows the declared canvas and viewport. UI owns DOM placement; World
  owns WebGL, resize and renderer lifetime. Off-document texture canvases remain
  rendering resources with their content owner.
- Each UI controller ends its listeners, subscriptions, timers and gestures;
  cleanup preserves static document structure.

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
- Target stable 90 Hz on the actual Windows-PCVR installation over USB-C,
  including transport and headset. Mac browser and deterministic benchmark
  results detect regressions but do not prove installation acceptance. Standalone
  PICO belongs to a later separate project; do not build paths for it here.
- Prefer the simplest GPU-friendly path: shared resources, low draw-call count,
  minimal low-cost opaque shaders, bounded streaming, LOD, culling, and
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
