<!--
Purpose: Define the engineering standards used throughout Becoming Many.
Context: The largely implemented experience is in performance, stability, and cleanup work.
Responsibility: Keep coding, architecture, Three.js, documentation, and validation rules in one concise reference.
Boundary: Current implementation details remain in architecture.md and current-status.md.
-->

# Engineering Standards

These rules describe how the project is already being built and how new work
should extend it. They are defaults, not reasons to add infrastructure.

## Core Approach

- Start with the smallest change that produces a testable result.
- Apply KISS and YAGNI: remove or avoid code before introducing another layer.
- Reuse the standard library, Three.js, and existing project code before adding
  a dependency or custom framework.
- Add an abstraction only for a concrete current need. A possible future use is
  not sufficient.
- Keep performance work measurable. Desktop behavior is useful evidence, but
  physical PICO validation is required for headset performance claims.

## Naming and Types

- Use English names that state intent, not implementation history.
- Include units or coordinate meaning where ambiguity is possible. Existing
  examples include `deltaSeconds`, `budgetMilliseconds`, `viewDistance`,
  `chunkX`, `originZ`, and `slotCount`.
- Prefix booleans and predicates with terms such as `is`, `has`, `can`, or
  `should` when that improves readability.
- Replace unexplained literal values with named constants close to their owner.
  Comments should explain why the value exists or how it was measured.
- Use explicit TypeScript contracts at ownership boundaries. Prefer `readonly`
  data and narrow unions when they prevent invalid states.
- Keep all authored configuration in typed TypeScript files: settings,
  presets, and module definitions. Do not introduce JSON, YAML, or
  environment-variable configuration; JSON under `public/` records asset
  provenance, not configuration.
- Do not write the same settings structure as both a value and an interface.
  When the settings object is the source of truth, derive its type with
  `export type Settings = typeof SETTINGS;`.
- Use a direct type annotation such as
  `export const SETTINGS: SharedContract = { ... };` only when the contract
  exists independently and is shared by multiple authored configurations.
- In a settings file, place the editable settings block directly after the file
  header and imports. Supporting contracts may follow below it so readers see
  the values they can tune first.
- Add a short inline comment after every tunable setting. Explain what changing
  the value does, including its unit or valid direction where relevant.
- Keep level presets sparse. A level defines only the values and modules it
  actually needs.

## Files and Functions

- Give every nontrivial new source or test file one clear responsibility.
- Start it with `Purpose`, `Context`, `Responsibility`, and `Boundary` so a
  reader understands why the file exists before reading its implementation.
- Prefer one public concept per file and keep exports deliberately small.
- Use small named functions, early returns, and little nesting. Split work when
  a function mixes responsibilities, becomes difficult to scan, or needs more
  than three parameters without a coherent options object.
- Avoid nested control-flow loops. Use a flat traversal or named helper unless
  the algorithm genuinely requires nesting and the reason is documented.
- Avoid generic `manager`, `service`, `helper`, or `utils` abstractions when a
  domain-specific name can express ownership more clearly.
- Write comments for invariants, tradeoffs, lifecycle decisions, and surprising
  behavior. Do not restate readable code line by line.
- Keep TODOs concrete and local. Do not use comments to pre-design speculative
  systems.

## Architecture

- `src/main.ts` remains the minimal rehearsal-show entry; `src/test-main.ts`
  owns standalone level, benchmark, diagnostics, and direct-M5 requests.
  `src/levels/level-runtime.ts` is the single startup and frame-coordination
  root. `src/levels/level-composition.ts` connects authored composition to
  concrete content modules without creating a parallel runtime.
- `src/world` owns permanent execution mechanisms. `src/modules` owns
  unloadable content, `src/control` owns input and navigation, and `src/levels`
  contains data-only presets.
- Keep dependencies explicit through parameters and small contracts. Do not add
  global mutable state, a global event bus, service locators, or hidden
  singletons.
- Keep contract flow directional. Stable world facts may feed content modules;
  content modules do not write back into those facts or import concrete sibling
  modules.
- A shared contract describes information crossing an ownership boundary. Keep
  consumer-specific placement, rendering, and settings inside the consumer.
- Reuse existing lifecycle, query, assignment, and scheduling contracts before
  inventing a broader module interface. Extract shared generation logic only
  after a second real consumer duplicates the same operation.
- Keep one Three.js render loop. Modules never create private animation loops.
- The code that creates a resource owns its complete lifecycle and releases
  event listeners, Three.js objects, and GPU resources when disposed or
  unloaded.
- Keep spatial assignment, work scheduling, content generation, and rendering
  as separate responsibilities.
- Bound runtime work and memory. Prefer fixed pools, recycled buffers, stable
  capacities, and small frame-budgeted jobs over unbounded growth.
- Extend an existing boundary before creating a parallel runtime or generic
  framework.

## Three.js Development

- Check the installed Three.js version before relying on an API or example.
- Research in this order: official [API documentation](https://threejs.org/docs/),
  official manual, matching [Three.js examples](https://threejs.org/examples/),
  then official addon or source code.
- Prefer maintained Three.js APIs and addons over local replacements. Current
  examples are `PointerLockControls`, `VRButton`, `Timer`, and
  `renderer.setAnimationLoop()`.
- Treat examples as focused implementation references, not architectures to
  copy wholesale. Adapt only the smallest relevant pattern to the project's
  ownership boundaries.
- Import addons through `three/addons/...` and keep version-specific behavior
  aligned with the installed package.
- Reuse geometries, materials, buffers, and render objects. Dispose owned
  geometries, materials, textures, render targets, controls, and listeners when
  their lifecycle ends.
- Keep shaders and rendering mobile-first. Reduce draw calls, allocations,
  material variants, transparency, overdraw, texture work, and per-frame CPU
  work before adding more complex optimization systems.

## Documentation

- Write project documentation in English and keep it concise.
- Treat the current `src/` and `public/` trees as the source of truth for runtime
  behavior and assets.
- Separate verified current behavior from planned product direction. Never
  describe a proposal, folder placeholder, or reference project as implemented.
- Record physical PICO results separately from desktop or browser results.
- Use folder READMEs to explain ownership and boundaries, not to duplicate
  implementation walkthroughs.
- Keep `current-status.md` factual, `architecture.md` implementation-based,
  `roadmap.md` forward-looking, and `architecture-decisions.md` limited to
  confirmed decisions.
- Update only the documents affected by a change. Remove stale statements
  instead of explaining contradictions between old plans and current code.

## Tests and Checkpoints

- Keep tests under top-level `tests/`, mirroring production ownership areas.
- Test observable contracts and invariants rather than private implementation
  details.
- Add a regression test when a shared contract or previously failing behavior
  changes.
- Before a checkpoint or commit, run `bun test`, `bun run check`,
  `bun run lint`, `bun run build`, and Fallow.
- A performance-sensitive milestone is complete only after its relevant metrics
  and target-device acceptance have been recorded.
