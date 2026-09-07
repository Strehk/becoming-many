# Engineering Standards

Use the [target architecture](target-architecture.md) for target owners and
removal obligations, [architecture](architecture.md) for current implementation,
and the [workflow](refactor-workflow.md) for implementation blocks, concise review and decision boundaries.
These standards guide readable code; they do not require new infrastructure.

## Simplify at the owner

- Prefer removal and reuse, then extending existing code, platform features and
  installed dependencies. Add a dependency only for a justified current need.
- Apply KISS, YAGNI and Separation of Concerns. Keep construction, live state,
  domain algorithms, UI and external data access distinct without forwarding
  layers that merely repackage the same arguments or results.
- Keep start, frame, end and visitor restart directly readable in existing
  owners. Do not move small private functions into files just to reduce length.
- Introduce a shared abstraction only when current consumers have the same
  semantics and lifetime, and it reduces the work needed to understand them.
- Do not retain two states for one fact. Derive facts from their owner; remove
  redundant arguments before inventing an options object or another interface.
- A structural refactor should remove obsolete concepts and paths, not merely
  move or rename them. Replace implementation, consumers, contracts, settings
  and exclusive tests together. Each block must leave the system smaller.
- Preserve clear formatting. Minifying, packing statements or moving files
  outside the count is not simplification.

## File names and architectural roles

Use `<domain-name>.<role>.ts` for files with an architectural role. The domain
name uses English lowercase kebab-case; the dot separates the role from the
subject. For example, `world-fade.effect.ts` names both the effect and its role.
The role describes the responsibility permitted in the file.

| Role | Example | Responsibility |
| --- | --- | --- |
| `level` | `connections.level.ts` | One self-contained literal level configuration, with type-only imports; no resource creation or runtime logic. |
| `runtime` | `show.runtime.ts`, `world.runtime.ts` | A running owner with state, operations and complete resource lifetime; only World owns the render loop. |
| `composition` | `level.composition.ts` | One-time concrete construction and connection of existing owners and content; no independent ongoing orchestration. |
| `module` | `vegetation.module.ts` | Content participating in the shared World module lifecycle, owning its resources and local behavior. |
| `effect` | `thermal.effect.ts` | A focused material or presentation effect with explicit ownership of its own resources and borrowed inputs. |
| `page` | `conductor.page.ts` | A composed UI with presentation, input bindings and UI cleanup; no experience startup or playback/reset policy. |
| `panel` | `transport.panel.ts` | A bounded UI region with rendering, gestures and calls to public owner commands; no experience orchestration. |
| `entry` | `conductor.entry.ts` | Browser bootstrap: resolve request/deployment facts, start or cancel a Run, mount UI and connect page exit to cleanup. Run owns the internal experience lifecycle. |

- This is the complete initial architectural role vocabulary. Extend it only
  for a concrete responsibility that existing roles or plain domain names do
  not express. A role does not mandate a class, interface or extra file.
- Domain algorithms may keep direct names such as `flight-ground-clearance.ts`.
  Small private helpers stay with their owner. Do not generate a companion
  `.types.ts`, `.service.ts`, `.state.ts` or `.config.ts` for every feature.
- Roles complement folder boundaries: page/panel code belongs to UI; runtimes
  own domain behavior; entries connect both. UI-local gestures, confirmation
  timers and display caches remain UI responsibilities.
- Keep tooling-specific extensions such as `.test.ts`, `.vert.glsl` and
  `.frag.glsl`. They do not introduce additional application architecture roles.

Confirmed 2026-09-07. Apply this convention to new role-bearing files and when
refactoring an existing owner. The examples are target names, not claims that
the current files have already been renamed. Migrate imports, entry references,
affected tooling paths and documentation together; remove the old path without
a forwarding alias. A rename alone is not a structural reduction, and this
convention does not authorize extra files or a repository-wide rename pass.

## TypeScript and authored configuration

- Use strict, precise TypeScript; avoid `any`, unsafe casts and suppression of
  real errors. Explicit types are most useful at ownership boundaries.
- Use English, intention-revealing domain names and units: `deltaSeconds`,
  `budgetMilliseconds`, `chunkX`, `slotCount`. Prefer early returns and little
  nesting; introduce a function when it explains a distinct operation.
- Use named constants for non-obvious values. Explain the invariant or measured
  reason, not the assignment. Do not turn every literal into an exported setting.
- Author configuration in typed TypeScript, never parallel JSON/YAML/environment
  application configuration. JSON in `public/` records asset provenance only.
- Derive a type from its authoritative settings value when no independent
  contract exists. Otherwise annotate with the existing shared contract.
- Put tunable settings near the top and briefly describe their effect/units.
  Level recipes explicitly name their modules and desired settings; remove
  layer spreads, inheritance and hidden override order. Extra configuration
  lines are justified by removed indirection and unchanged effective settings.
- An absent module is not requested; an omitted optional setting uses that
  module's documented default. Missing/invalid required settings fail clearly
  during preparation before the visit. Technical defaults belong once to the
  module, without deep merges or silent repair. Propose the smallest direct
  recipe/show relationship before migration; no competing show configuration.

## Names, contracts and reading order

Use `camelCase` for functions/variables, `PascalCase` for types/classes and
`UPPER_SNAKE_CASE` for named fixed constants. Names describe current effects:
`Run` is a complete experience lifetime, `Preset` is construction data, `Show`
owns dramaturgy, and `World` owns rendering. Do not use "level" interchangeably
for all three. A `ViewState` aggregates UI observations; it is not engine state.
`Sample` identifies a reading at an instant, `Frame` one processing step,
`Status` operational availability/validity, and `Request` an explicit operation
request. Keep meaningful distinctions such as material `Effect`, data `Source`
and resource-owning `Module`; no universal base object is required.

| Operation | Contract |
| --- | --- |
| `create…` | Construct an object/owner; document any asynchronous or deferred readiness. |
| `mount…` | Attach UI and return its cleanup or UI handle. |
| `start…` | Prepare and begin operation; awaited completion means the documented readiness has been reached. |
| `read…`, `sample` | Observe without consuming events or changing domain state. |
| `consume…` | Consume input explicitly; document its single-reader requirement. |
| `set…`, `play`, `pause`, `seekTo` | Apply a domain command at its owner; document limits and side effects. |
| `update`, `follow` | Perform externally driven work; create no private frame loop. |
| `subscribe` | Observe changes; document initial delivery and return unsubscribe. |
| `unload` | Completely end the project-owned lifetime; repeated calls are safe. |

`reset…` must name what is reset. `restart…` means a complete old lifetime ends
and a fresh one begins; a time/position reset does not satisfy it. Browser
reload is `reloadPage`, not a Show command. Keep library-native methods such as
Three.js `dispose()`; do not add a second project cleanup API for spelling alone.
Synchronous cleanup returns `void`; actual asynchronous completion uses a Promise.

Each boundary states its inputs, outputs, allowed mutations, units, validity
and owner of cleanup. Read-only types do not freeze objects or make borrowed
buffers permanent snapshots: document their validity window and prohibit
consumer mutation/retention where storage is reused. Network data is validated
at its existing adapter; expected off/stale states are observations, while
failed operations report their actual errors. Do not hide failure as success.

Public handles expose only a consumer's required capabilities. Prefer `Pick<>`
of existing owner contracts over forwarding objects. UI cannot consume M5
button edges or unload Run-owned M5/XR children. The Show clock stays internal
after all real UI/console consumers migrate to Show commands. Show followers
share one time sample per Show update; UI observations may be sampled separately.
Use subscription for existing event-driven state such as XR and bounded reads
for changing measurements; no universal observable store is required.

Keep a file readable in this order: imports, public contract, technical
constants, public factory/entry, owned state/setup, public operations and
frame work, cleanup, private domain helpers. Small local functions may follow
the public story without becoming files. Add an independent contract file only
for a real shared boundary. A feature needs no automatic `types`, `service`,
`state`, `config` or barrel companion. Preserve literal `.level.ts` files.

## UI, entry and engine separation

The [target architecture](target-architecture.md#3-target-structure) owns the
responsibility map and diagrams. Apply these boundaries during implementation:

- Entry resolves browser/deployment inputs, starts/cancels Run, mounts UI and
  connects page exit to cleanup. Experience startup/frame/end policy stays Run-owned.
- UI owns DOM, labels, gestures, confirmation timers and display caches. It
  calls owner commands and reads observations; no playback, restart, calibration
  or device-validity policy is defined in a page/panel.
- Engine owns Show, World, input, audio and content behavior in the browser.
  It imports no operator/test UI or browser entry. WebXR, Web Audio, canvas and
  input events at their actual resource adapters are not automatically UI.
- The Station backend delivers files, deployment facts and process health.
  It carries no Show clock, visitor state or command transport. Sharing pure
  route/configuration contracts does not permit importing browser runtimes.
- Composition alone connects concrete content factories through narrow
  contracts. Existing Fallow boundaries and focused behavior tests enforce the
  meaningful rules; do not introduce another analyzer for this convention.

## Application styling

The target stylesheet is `src/app.css`, imported by each browser entry. #84
migrates the current separate stylesheets and TypeScript style blocks together.
Keep shared color/typography/control rules once and scope actual page layouts
to their UI roots. Flash remains scrollable; only experience viewports receive
full-screen/canvas sizing. Preserve intentional operator touch-target sizes.

Authored DOM styling lives in this CSS file: no component stylesheets, inline
`style`, `cssText`, TypeScript-injected stylesheets or utility-class styling.
UI updates classes, semantic attributes and geometry. For continuously moving
timeline/M5 marks, use small SVG geometry attributes where needed; keep visual
presentation in CSS and preserve accessible HTML controls. Setting CSS custom
properties through `element.style` is still inline styling. Do not replace it
with generated percentage classes or a new styling framework.

Three.js materials, shaders and canvas-texture drawing remain with the content
owners; they are not DOM CSS. Respect third-party Shadow DOM boundaries and
use supported styling interfaces. Reuse the current TypeScript/DOM stack;
this cleanup does not introduce a frontend framework or component dependency.
Delete replaced stylesheet imports, rules, inline blocks and unused selectors
in the same block. Fix cascade/hidden-state causes rather than adding stronger
overrides. Report actual combined styling reduction; moving CSS is not removal.

## Boundaries and lifetime

- Keep one renderer/render loop and one Show-time authority. Concrete content
  modules do not import siblings; Composition connects directional contracts.
- The creator owns release. Borrowers do not dispose shared source assets.
  Account for partial startup, cancellation, late async publication and reload.
- Keep the prepared world throughout one visit. End it fully between visitors
  and create a fresh run; time/position reset alone is insufficient. Preparation
  and bounded background work share one strategy, not level-specific workarounds.
- Show owns playback/language/time; Runtime owns visitor restart. Surfaces own
  input/display and use those same commands, without forwarding-only adapters,
  repeated reset rules, command buses or extra UI stores.
- Diagnostic surfaces own measurement/display. World exposes needed existing
  renderer facts read-only; normal operation adds no probe renderer or expensive
  diagnostic measurement. Keep operating state and clear startup errors visible.
- Keep runtime work and memory bounded through existing capacities, pools,
  recycled buffers and frame-budgeted work. Avoid new coordination mechanisms
  when existing queue, lifecycle or assignment contracts serve the need.
- Do not add global mutable state, event buses, service locators or hidden
  singletons. Separate input locomotion from headset-local pose and keep
  untrusted device data validation at its existing boundary.
- Do not silently change confirmed ownership or implement an open product or
  architecture decision. Use [confirmed decisions](architecture-decisions.md).

## Library and rendering work

- Inspect installed versions and current official documentation before changing
  library-specific behavior; use Context7 first where available and matching
  library source/examples when needed. Prefer documented platform/library APIs.
- Keep Three.js addon imports under `three/addons/...`; examples are focused
  implementation references, not a reason to introduce their entire architecture.
- Reuse geometry/material/texture resources and release owned GPU resources,
  observers and listeners. Prioritize draw calls, shader cost on the target installation,
  transparency, allocations and bounded per-frame work before clever tuning.
- Validate performance through the [test plan](refactor-test-plan.md). Physical
  acceptance and measured exceptions are not inferred from a desktop pass.

## Comments, documentation and tests

- Keep code self-explanatory. Add short JSDoc/comments for public contracts,
  lifetime, side effects, difficult algorithms and non-obvious constraints.
  Do not require a boilerplate header when the code already explains its role.
- Write repository code/docs in English; preserve authored narration/content.
  Folder READMEs explain boundaries, not another copy of implementation details.
- Keep one authority per mutable fact. Update only affected canonical documents;
  replace stale descriptions instead of appending corrections indefinitely.
- Tests live under `tests/` and protect current behavior. Apply the test plan's
  retention/deletion rules: temporary probes and replaced implementation tests
  should leave with their purpose, while still-relevant regressions remain.
- Use existing verification commands. Do not add a checker, framework, schema
  or report for a rule that a short review of the actual diff can enforce.
