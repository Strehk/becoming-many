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
- [docs/todo/](docs/todo/README.md) contains candidate cleanup and
  stabilization work, and the
  [Refactor Checklist](docs/refactor-checklist.md) is its operational queue.
  Read the relevant task before editing, but verify every claim against the
  latest `origin/main` and current GitHub issue state.
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

## Current Phase: Stabilize and Simplify

- Work on one confirmed issue at a time. Prioritize security, control safety,
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

## Git and Issue Workflow

- Use the branch-local
  [Refactor Checklist](docs/refactor-checklist.md) as the operational queue.
  GitHub issue state and the latest `origin/main` remain authoritative.
- `david/refactor-foundation` is the long-lived planning and working branch.
  `docs/todo/**` and `docs/refactor-checklist.md` belong only to that branch:
  never include them in a pull request or merge them into `main`.
- Revalidate one selected issue against the latest `origin/main` before editing
  on the foundation branch. Close or rescope findings that upstream work has
  resolved or invalidated.
- Work on exactly one confirmed issue at a time. Keep its deliverable code,
  tests, and affected as-built documentation in commits separate from updates
  to the branch-local todo and checklist. Do not mix opportunistic cleanup into
  those commits.
- To deliver an issue, create `david/issue-<number>-<short-slug>` from a clean,
  current `main` and cherry-pick only the deliverable commits. Before opening
  the pull request, verify that its diff contains neither `docs/todo/**` nor
  `docs/refactor-checklist.md`.
- Commit locally only after every required verification has run. New or
  worsened failures block completion; a pre-existing failure may remain only
  when it is reproduced on the unchanged base, is not worsened by the patch,
  and is linked to a separate open issue. Push the branch and open the pull
  request only when the user asks. The pull request must link the issue with
  `Closes #<number>` and report tests, browser evidence, simplification
  evidence, and any required PCVR evidence.
- Mark the branch-local checklist item complete only when the change satisfies
  its definition of done and the pull request is ready to merge. If current
  `main` already resolved the issue and no deliverable diff remains, record the
  required evidence and close it directly instead. After merge or direct
  closure, refresh the foundation branch from `main` before selecting the next
  issue; never continue work on a merged delivery branch.

## Toolchain

- **Bun** (packages, tests), **Vite** (build), **Biome** (lint + format),
  **Fallow** (export analysis, `.fallowrc.jsonc`).
- `bun run dev` · `bun test` · `bun run check` (typecheck) · `bun run lint` ·
  `bun run build` (typecheck + production build).
- `bun run benchmark` replays a fixed route in Chromium and writes a report
  artifact. It needs a current `bun run build` and is not part of `bun test`.
- `bun run station` starts the station server: it serves the built pages from
  `dist/` and the deployment facts at `/config`. The station window is the
  conductor page (`/conductor.html`), which hosts the show in-process; `/`
  stays the bare rehearsal and development page. The server is a Bun process,
  not part of the app bundle, and the show runs without it.
  `docker compose up -d --build` runs a whole built station in one
  container — see [station/README.md](station/README.md) and `.env.example`
  for the per-station env vars (M5 host, device id, station name).
- Run all Bun, Vite, and Fallow checks before checkpoints and commits.

## Delivery Platform

- This repository targets only the Windows PC VR installation.
- The Three.js/WebXR application runs and renders on the station PC. SteamVR
  is the selected PC VR runtime, and PICO Business Streaming carries the
  session to a PICO headset over a wired USB connection.
- The headset is a streamed display and tracking endpoint, not the application
  runtime. Do not add standalone Android/PICO builds, mobile platform profiles,
  or on-headset application code here.
- A later standalone PICO edition belongs in a separate, reduced fork. Keep
  shared Experience code independent from PC-only operator and diagnostic
  composition so that fork can remove those concerns cleanly.

## Performance rules

- Performance is the highest priority; target stable 90 FPS across the complete
  Windows, SteamVR, wired-streaming, and PICO presentation chain. Any
  performance regression blocks completion.
- For performance-sensitive work, record comparable before-and-after evidence
  on the same route and rendering path. Run the deterministic benchmark and the
  physical target-device path required by the issue before merge.
- Desktop and headless results are diagnostic evidence, not physical PCVR
  acceptance. Do not claim a target frame rate without a complete wired run
  that includes rendering, encoding, USB transport, decoding, and headset
  presentation.
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

## Workflow and Completion

1. Inspect the relevant todo, owning modules, contracts, tests, and current
   documentation. Check installed library versions and official documentation
   before relying on an API.
2. If the selected path has no current baseline evidence, run `bun test` and a
   browser smoke test before editing so pre-existing failures are recorded
   separately from the change.
3. Plan and implement the smallest complete patch. Do not mix unrelated todos
   or broad cleanup into it. Add a focused regression test for changed behavior.
4. Prove simplification explicitly. Name the files, exports, branches, or
   duplicated responsibilities removed or consolidated, then verify their
   absence with a focused `rg` or file-existence check and with Fallow. Record
   the source-code delta, but do not use lower line count as the only quality
   measure because tests and clearer contracts may add necessary lines.
5. Run focused tests during development. After the final change and before a
   checkpoint, run `bun test`, `bun run check`, `bun run lint`, `bun run build`,
   `bunx fallow`, and `git diff --check`. A new or worsened failure blocks the
   change. Record any unchanged baseline failure with its owning issue.
6. Always run a browser test against the production build after the final
   change. Smoke-test the default production route and every affected route,
   record the command and result, and treat page errors, console errors, failed
   requests required by the feature, or missing expected UI as failures. For a
   rendered level, the minimum repeatable browser run is
   `bun run benchmark --profile quick --level <level>`; UI and navigation work
   also needs a focused Playwright interaction through the affected flow.
7. For XR, control, lifecycle, visual, or performance behavior, also verify the
   real runtime path required by the task. Passing static and desktop-browser
   gates alone is insufficient where physical PCVR acceptance applies.
8. Update only affected as-built documentation and measured evidence. Remove
   stale statements instead of documenting contradictions.

## Repository conventions

- Documentation lives in `docs/` ([docs/README.md](docs/README.md) is the
  index); this file stays short and points there.
- `README.md` describes the piece for a reader who has never seen it. Keep the
  vision text and implementation notes separate.
- `script/` holds the narration (`en.md`, `de.md`). It is the authoritative
  voiceover wording — content, not a draft; do not reword it while working on
  code.
