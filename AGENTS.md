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

## Git and Issue Workflow

- Use [Refactor Checklist](docs/refactor-checklist.md) as the operational queue.
  GitHub issue state and the latest `origin/main` remain authoritative.
- Revalidate one selected issue against the latest `origin/main` before editing.
  Close or rescope findings that upstream work has resolved or invalidated.
- Keep the audit snapshot as reference only. Start every implementation from a
  clean, current `main` on a fresh branch named
  `david/issue-<number>-<short-slug>`.
- Work on exactly one confirmed issue per branch and pull request. Do not stack
  the next issue on an unmerged branch or mix opportunistic cleanup into it.
- Commit locally only after every required verification has run. New or
  worsened failures block completion; a pre-existing failure may remain only
  when it is reproduced on the unchanged base, is not worsened by the patch,
  and is linked to a separate open issue. Push the branch and open the pull
  request only when the user asks. The pull request must link the issue with
  `Closes #<number>` and report tests, browser evidence, simplification
  evidence, and any required PCVR evidence.
- Mark the checklist item complete only when the change satisfies its definition
  of done and the pull request is ready to merge. GitHub closes the issue when
  the pull request merges. Start the next session from freshly synchronized
  `main`, never from the previous issue branch.

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

Keep `main` clean and merge only verified work. Do not commit or push unless the
user asks. `docs/narration/` is authoritative voiceover content; do not reword
it during code or cleanup work.
