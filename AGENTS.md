# AGENTS.md

Guidance for AI coding agents working in this repository. Humans are welcome to read it too.

## What this project is

**Becoming Many** is a speculative VR experience about layered, non-human perception — see
[README.md](README.md) for the concept. The working basis is the codebase imported from
[becoming_many_new](https://github.com/dweigend/becoming_many_new) (2026-08-25). The
authoritative target architecture is [docs/architecture.md](docs/architecture.md); the
imported code's as-built structure is described in
[docs/code-architecture.md](docs/code-architecture.md). Where they disagree, the target
architecture takes priority.

## Language rule

**Everything in this repository is written in English.** That covers code, identifiers, type
names, file and directory names, comments, commit messages, documentation, log output, and
UI-facing strings unless a string is deliberately part of the German-language experience content
(voiceover text, on-screen copy for the audience).

This holds regardless of the language of the conversation. If the chat is in German, the answer
may be in German — the artifacts that land in the repo are still English. Do not translate
identifiers or comments to match the language of the request.

## Working agreements

- **Ask before assuming.** The project's design decisions are not all in the repo yet. If a task
  depends on an unwritten decision, ask rather than inventing one and burying it in code.
- **Finish what you start.** Leave the repo in a state where the gates pass. If you cannot
  finish, say what is unfinished rather than leaving it silently broken.
- **Small, self-contained modules.** Modules communicate through typed data structures and
  explicit interfaces, never through shared globals.
- **Write down decisions.** Anything a future agent would otherwise have to guess belongs in
  this file or in `docs/`, not only in a commit message.
- **Do not commit or push unless asked.**

## Repository conventions

- Documentation lives in `docs/`; this file stays short and points there.
- `README.md` describes the piece for a reader who has never seen it. Keep the vision text and
  the implementation notes separate.
- `script/` holds the narration text (`en.md`, `de.md`). It is the authoritative wording of the
  voiceover — treat it as content, not as a draft, and do not reword it while working on code.

## Toolchain and quality gates

- **Bun** is the package manager and test runner; **Vite** builds; **Biome** lints and
  formats; **Fallow** analyzes exports (config in `.fallowrc.jsonc`). Run all Bun, Vite,
  and Fallow checks before checkpoints and commits.
- Commands: `bun run dev` (dev server), `bun test`, `bun run check` (typecheck),
  `bun run lint` (Biome), `bun run build` (typecheck + production build).
- Strict TypeScript and strict linting throughout. Follow
  [docs/engineering-standards.md](docs/engineering-standards.md) for coding, architecture,
  Three.js, documentation, and validation conventions.
- Build the smallest viable MVP. Follow KISS and YAGNI. Plan every change before
  implementation; work one step at a time.
- Keep `main` clean: develop features on dedicated branches and merge only verified work.

## Performance rules

- Target PICO 4. Performance is the highest priority; target stable 90 FPS. Any
  performance regression blocks completion.
- Always choose the simplest, most GPU-friendly solution.
- Keep shaders mobile-first and minimal: prefer opaque, unlit, or baked lighting; minimize
  fragment work, texture samples, variants, and overdraw; avoid dynamic branches and loops.
  Store shaders only in dedicated GLSL ES 3.00 files (`*.vert.glsl`, `*.frag.glsl`); never
  inline them.
- Minimize draw calls. Use Three.js `InstancedMesh` for repeated geometry and materials,
  and `BatchedMesh` for varied geometry sharing a material. Reuse geometry, materials, and
  buffers.
- Stream procedural content in bounded, distance-based chunks. Generate only nearby
  content; pool and recycle instances, use LOD and frustum culling, prefer KTX2 textures,
  and always dispose unused GPU resources.
