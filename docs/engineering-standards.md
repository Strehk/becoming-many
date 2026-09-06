# Engineering Standards

Use the [target architecture](target-architecture.md) for target owners and
removal obligations, [architecture](architecture.md) for current implementation,
and the [workflow](refactor-workflow.md) for scope, size review and human gates.
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
