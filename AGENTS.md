# AGENTS.md

Guidance for AI coding agents working in this repository. Humans are welcome to
read it too.

## Orientation

- **Becoming Many** is a speculative VR experience about layered, non-human
  perception — see [README.md](README.md) for the concept.
- The code in `src/` and `public/` is the source of truth. The as-built
  documentation — [docs/architecture.md](docs/architecture.md),
  [docs/engineering-standards.md](docs/engineering-standards.md),
  [docs/architecture-decisions.md](docs/architecture-decisions.md),
  [docs/current-status.md](docs/current-status.md),
  [docs/roadmap.md](docs/roadmap.md) — describes and governs it, and
  **takes priority**.
- [docs/direction/](docs/direction/README.md) describes where the piece is
  headed as a Futurium installation. Conflicts between direction and current
  code are tracked in
  [docs/direction/open-decisions.md](docs/direction/open-decisions.md) —
  never resolve one silently in code; ask.

## Language rule

**Everything committed to this repository is written in English**: code,
identifiers, file names, comments, commit messages, documentation, and log
output. German exists only as experience content (`script/de.md`, narration
assets, audience-facing copy). This holds regardless of the conversation
language — a German chat still produces English artifacts.

## How to work

- Follow [docs/engineering-standards.md](docs/engineering-standards.md) for
  coding, architecture, Three.js, documentation, and validation conventions.
- **Contracts and modularity are of utmost importance.** Small,
  self-contained modules own their resources and complete lifecycle; data
  crosses an ownership boundary only through a small, strict TypeScript
  contract; concrete modules never import sibling modules. Extending a
  contract cleanly always beats reaching around one.
- **All configuration is TypeScript.** Settings, presets, definitions, and
  tunables live in typed `.ts` files (`*-settings.ts`, `*.level.ts`, module
  definitions) — never in JSON, YAML, or environment formats. JSON under
  `public/` records asset provenance only.
- Build the smallest viable step. Follow KISS and YAGNI. Plan every change
  before implementing; work one step at a time.
- **Ask before assuming.** If a task depends on an unwritten or open decision,
  ask rather than inventing one and burying it in code.
- **Finish what you start.** Leave the repo with the gates passing, or say
  explicitly what is unfinished.
- **Write down decisions** in `docs/`, not only in commit messages.
- Keep `main` clean: develop on feature branches and merge only verified work.
  **Do not commit or push unless asked.**

## Toolchain

- **Bun** (packages, tests), **Vite** (build), **Biome** (lint + format),
  **Fallow** (export analysis, `.fallowrc.jsonc`).
- `bun run dev` · `bun test` · `bun run check` (typecheck) · `bun run lint` ·
  `bun run build` (typecheck + production build).
- `bun run benchmark` replays a fixed route in Chromium and writes a report
  artifact. It needs a current `bun run build` and is not part of `bun test`.
- `bun run station` starts the station server that joins the show window
  (the default page at `/`; its link connects by itself) to the conductor page
  (`/conductor.html`), and serves the built pages from `dist/` when present.
  It is a Bun process, not part of the app bundle, and the show runs without
  it. `docker compose up -d --build` runs a whole built station in one
  container — see [station/README.md](station/README.md) and `.env.example`
  for the per-station env vars (M5 host, device id, station name).
- Run all Bun, Vite, and Fallow checks before checkpoints and commits.

## Performance rules

The delivery platform question is open
([open decision 1](docs/direction/open-decisions.md)); until it is decided,
these rules stand unchanged:

- Target PICO 4. Performance is the highest priority; target stable 90 FPS.
  Any performance regression blocks completion.
- Always choose the simplest, most GPU-friendly solution.
- Keep shaders mobile-first and minimal: prefer opaque, unlit, or baked
  lighting; minimize fragment work, texture samples, variants, and overdraw;
  avoid dynamic branches and loops. Store shaders only in dedicated GLSL ES
  3.00 files (`*.vert.glsl`, `*.frag.glsl`); never inline them.
- Minimize draw calls. Use `InstancedMesh` for repeated geometry and
  materials, `BatchedMesh` for varied geometry sharing a material. Reuse
  geometry, materials, and buffers.
- Stream procedural content in bounded, distance-based chunks. Pool and
  recycle instances, use LOD and frustum culling, prefer KTX2 textures, and
  always dispose unused GPU resources.

## Repository conventions

- Documentation lives in `docs/` ([docs/README.md](docs/README.md) is the
  index); this file stays short and points there.
- `README.md` describes the piece for a reader who has never seen it. Keep the
  vision text and implementation notes separate.
- `script/` holds the narration (`en.md`, `de.md`). It is the authoritative
  voiceover wording — content, not a draft; do not reword it while working on
  code.
