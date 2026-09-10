# Development

Implement the smallest readable solution at the existing owner. Prefer removal
and reuse over wrappers, new abstractions, or parallel mechanisms.

## Workflow

1. Define the concrete visible result and affected files. Verify
   `git branch --show-current` is exactly `david_refactor`, inspect status, and
   preserve unrelated changes.
2. Name each affected owner, its inputs, outputs, necessary state, and resource
   cleanup. Read the current issue, prerequisites, and relevant history.
3. Implement one coherent issue or agreed block at the existing owners. Reuse
   first; remove duplicate state, pure forwarding, and replaced code together.
4. Simplify the result: review direct calculations, dependency edges,
   start/frame/end paths, and size. A move or rename alone is not simplification.
5. Run repository lint and one targeted verification pass, including the real
   interaction for browser work. Repair failures and rerun only affected checks.
6. Record the concise result and limitations in the owning issue, update only
   affected canonical facts, commit, push to `origin/david_refactor`, and verify
   synchronization.

Never change, merge, rebase, or push `main`; create no additional feature branch
or worktree and never force-push. Completed targeted blocks may be committed and
pushed under the standing project authorization.

## Verification selection

Lint once at the end of every implementation block. For TypeScript changes, run
either `bun run check` or `bun run build`; build already includes type checking.

| Change | Minimum additional verification |
| --- | --- |
| Documentation only | Review text and links; `git diff --check` |
| Logic or configuration | Focused existing Bun tests and effective-value comparison |
| Browser UI or runtime | Affected real interaction, including start/frame/end |
| Resource or async lifetime | Changed lifetime plus the concrete failure/restart case |
| Rendering, streaming, or audio | Comparable before/after measurement and visible behavior |
| Shared architecture boundary | Relevant tests, build, lint, Fallow, and one negative boundary probe |
| Physical acceptance | Exact installation hardware; record unavailable evidence as open |

Run broad suites, full shows, and extended browser checks only when the changed
boundary or issue acceptance requires them. Never weaken a test, suppress a
finding, or update a benchmark reference merely to obtain a pass.

## Simplicity and structure

- Follow the [integration and local stars](architecture.md). Only Composition
  imports concrete leaves; domain owners connect their internal components.
- Keep business logic, UI, data access, configuration, and orchestration
  separate. Prefer composition over inheritance.
- Do not retain two states for one fact. Derive observations from their owner.
- Introduce a shared abstraction only for current consumers with the same
  semantics and lifetime, and only when it reduces total understanding cost.
- Keep one responsibility and one abstraction level per function. Prefer early
  returns and explicit domain names with units.
- Under the Start refactor, every affected function, method, factory, callback,
  and GLSL function has at most 30 non-empty code lines, two nested control-flow
  levels, and three parameters. Do not satisfy this by packing or forwarding.

## File roles and contracts

Architectural files use `<domain>.<role>.ts` only when the role adds information:

| Role | Responsibility |
| --- | --- |
| `level` | One literal level recipe; no runtime logic |
| `runtime` | Live state, operations, and complete owned lifetime |
| `composition` | One-time construction and wiring; no live orchestration |
| `module` | Content under the World module lifecycle |
| `effect` | Focused material or presentation behavior and owned resources |
| `entry` | Browser bootstrap and connection of UI to one Run |
| `page` / `panel` | UI composition or one bounded UI region |

Domain algorithms keep direct descriptive names. Do not manufacture `service`,
`manager`, `types`, `state`, `config`, or barrel files for symmetry.

Use `create` for construction, `mount` for UI attachment, `read`/`sample` for
non-consuming observation, `consume` for explicit single-reader input, `update`
for externally driven work, and `unload` for complete project-owned cleanup.
`reset` names exactly what is reset; `restart` means complete old lifetime and a
fresh new lifetime.

Public contracts document inputs, outputs, units, mutations, validity, failure,
and cleanup ownership. Prefer a narrow existing contract to a forwarding object.

## UI and documentation

Authored browser HTML/SVG lives under `src/ui/`; controllers bind behavior and
update observations without markup strings or authored DOM construction. Shared
styling lives in `src/ui/app.css`. Three.js materials, shaders, and rendering
canvases remain with their content owners.

Keep documentation factual and short. Stable rules live in canonical docs;
mutable work and acceptance live in issues. Replace stale statements instead of
adding dated corrections. Preserve product narration verbatim in `script/`.
