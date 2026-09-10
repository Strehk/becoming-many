# Architecture

This document defines the binding architecture for current and future work.
The code may still contain issue-backed migration debt; new work must not add
exceptions. GitHub issues own the removal sequence and acceptance evidence.

## Integration star

The existing Run and Level Composition form one two-phase integration centre.
Composition constructs and connects once. Run owns the live experience lifetime
and frame integration. This is not a reason to introduce another application
owner.

```mermaid
flowchart TD
  Entry["Entry"] --> UI["UI"]
  Entry --> Run["Run: lifetime and frame integration"]
  Run --> Composition["Composition: one-time construction and wiring"]
  Composition --> Show["Show"]
  Composition --> World["World"]
  Composition --> Control["Control and M5"]
  Composition --> Sound["Sound"]
  Composition --> Content["Content modules"]
  Show -.->|commands and observations| Run
  World -.->|viewpoint and rendering facts| Run
  Control -.->|rig movement| Run
  Sound -.->|readiness and playback facts| Run
  Content -.->|module contracts| Run
```

The centre is deliberately small:

- `level-composition.ts` may import concrete leaf factories and connect their
  narrow contracts. It owns no clock, frame loop, runtime policy, or persistent
  domain state.
- `level.runtime.ts` owns startup, frame integration, handoff, cancellation,
  restart, and complete end. It contains no geometry, audio, UI, or content
  algorithms.
- No `Application`, coordinator, command bus, event bus, service locator,
  plugin system, or global mutable store is added around these owners.

## Import rules

Concrete leaves never import concrete peers. Forbidden examples include
Content to Content, Start to Control, Show to Start, Sound to Content, UI to an
Engine implementation, and World to Content. A type-only import from another
leaf's implementation file is still a peer dependency.

| From | Allowed production dependencies |
| --- | --- |
| Entry | UI, the public Run contract, deployment contracts, selected presets |
| UI | Pure view queries and public handle types; no Engine implementation |
| Run | Composition and public contracts for Show, World, Control, M5, and Sound |
| Composition | Level recipes, concrete factories, and neutral contracts |
| Show | Dramaturgy and Sound contracts; no concrete Content or World |
| World | World internals and narrow technical utilities; no Content, Show, or UI |
| Content | Its own domain, World/WorldSurface contracts, and neutral module contracts |
| Control and M5 | Their own internals plus rig, surface, and wire contracts; no Start or Show |
| Sound | Sound internals and Dramaturgy queries; no concrete Content |
| Station | Platform-neutral contracts under `shared/` only |

External libraries may be imported where the owning implementation uses them.
They do not provide a route around project boundaries.

## Contracts and data flow

- Put a contract at the owner of the fact or at an existing neutral boundary,
  never inside an unrelated consumer implementation.
- Composition injects concrete implementations. Leaves receive only the
  commands, observations, read-only facts, or resource capabilities they use.
- A public handle exposes the smallest current consumer surface. Do not pass a
  broad owner and rely on convention, create a forwarding wrapper, or hide
  dependencies behind a re-export barrel.
- World-only facts are not sufficient to justify a shared contract. Add one only
  for a real production boundary with an identified owner and consumer.
- Reused mutable buffers are borrowed for the documented validity window. Their
  consumers do not retain or mutate them.

The principal live flow is:

```text
input -> Control -> viewer rig movement
Show -> presentation and playback decisions
Run -> one shared frame sample and integration
World -> publish viewpoint -> update active modules -> bounded stream work
World -> render once
```

World publishes viewpoint and rendering facts. Control maps input to rig
movement. Show owns time, language, narration, and presentation policy. Content
and Sound consume injected facts without reaching into those implementations.

## Local domain stars

Each substantial domain repeats the same pattern: one domain owner connects
specialised components, while those components do not import one another.

For Start, `start.module.ts` is the only local learning orchestrator. It connects
Course, Motion, Crossing, Arrows, and particle presentation through narrow local
contracts. Course owns cue geometry, Motion owns movement observations, Arrows
owns reusable arrow slots, Crossing owns passage calculation, and the particle
effect owns graphics resources. None may acquire Control, Show, Sound, or a
sibling implementation directly.

The Start structure is a stable architectural constraint, not the product plan.
The protected Start concept, transition design, guidance, visual treatment, and
physical acceptance remain in their dedicated issues and design documents.

## Owners and lifetime

- Entry resolves browser/deployment input, starts or cancels one Run, mounts UI,
  and connects page exit to cleanup.
- UI owns declared DOM, gestures, display state, listeners, and UI cleanup. It
  invokes owner commands and reads observations; it defines no experience policy.
- Show owns one clock, transport, language, narration, and dramaturgy.
- World owns one renderer, one animation loop, XR, resize, viewpoint publication,
  module execution, bounded streaming, and renderer disposal.
- Control owns input mapping and locomotion. The viewer rig separates locomotion
  from desktop or headset-local pose.
- Content modules own their CPU/GPU resources and participate in the shared
  load/activate/update/deactivate/unload lifecycle.
- Sound owners release their nodes before the owner of a shared audio context
  closes it.
- Station serves files, deployment facts, and process health. It owns no Show
  clock, browser Run, transport command, or visitor state.

The creator of a resource releases it. Run stops live work before releasing
children and shared sources. Partial startup, cancellation, late asynchronous
results, handoff, and repeated end calls follow the same ownership path.

## Configuration and bounded work

Authored application configuration is typed TypeScript. Each level is one
self-contained literal parameter object with type-only imports, no spreads,
inheritance, helpers, or hidden override order. JSON under `public/` records
asset or firmware provenance only.

Runtime memory and work remain bounded through fixed capacities, pooling,
recycling, assignment revisions, and frame-budgeted jobs. There is one renderer,
one render loop, one Show-time authority, and one Run lifetime per application.

## Enforcement and migration

`.fallowrc.jsonc` must encode this matrix. Split broad zones such as `levels`
into Run, Composition, Show, presets, and contracts as their issue-backed
refactors remove current violations. Auto-discovered content and local-domain
zones must reject sibling imports. Activate each stricter rule in the same
coherent change that removes its existing violations; do not add baselines or
suppressions.

Fallow is the import-boundary authority. Focused tests may protect public
capability shapes and meaningful negative examples, but no second dependency
analyser is introduced. Architectural completion requires zero forbidden
production imports and a passing intentional-negative boundary probe.
