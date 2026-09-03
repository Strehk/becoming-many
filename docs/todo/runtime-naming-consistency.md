<!--
Purpose: Track overloaded names across station, controller, state, status, and level concepts.
Context: The types are mostly explicit but use the same words for different ownership layers.
Responsibility: Establish a small vocabulary at existing boundaries.
Boundary: This does not rename the product, level titles, or every internal variable.
-->

# Standardize Runtime Boundary Names

**Status:** Open
**Priority:** Maintainability

## Problem

`station` names a machine, broker, link, and adapter; `controller` can mean M5
or conductor; `state` names raw payloads and connection status; `level` names a
preset and a live show state. `ShowStatus.levelName` is an unrestricted string.

## Affected Files

- `src/m5/protocol.ts`
- `src/m5/control-source.ts`
- `src/station/station-protocol.ts`
- `src/station/show-station.ts`
- `station/station-server.ts`
- `src/levels/level-runtime.ts`
- `src/dramaturgy/narration-schedule.ts`

## Smallest YAGNI Solution

Rename only public boundary concepts: raw `M5State` to `M5Snapshot`, duplicated
link state to one `M5ConnectionStatus`, and `levelName` to typed
`activeWorldState: ShowLevelName`. Leave private locals unchanged unless the
compiler requires them. Do not perform a repository-wide terminology rewrite.

## Verification

Use TypeScript errors to update all consumers and confirm station round-trip
tests reject world-state names outside the show union.
