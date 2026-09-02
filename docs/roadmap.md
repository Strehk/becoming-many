<!--
Purpose: Define the execution order for the remaining Becoming Many work.
Context: Current behavior, architecture, and product direction have separate authoritative documents.
Responsibility: Group open tasks into five forward-looking, dependency-aware milestones.
Boundary: This file does not record completed features, current implementation details, historical evidence, or long-term ideas.
-->

# MVP Roadmap

This roadmap contains only the order of open work. See
[Current Status](current-status.md) for verified behavior,
[Architecture](architecture.md) for the implemented system, and
[Installation Direction](direction/README.md) for product direction.

## 1. Security and Acceptance Gates

**Goal:** Security and acceptance rules apply before further runtime work is
integrated.

1. [Stop Persisting and Logging Wi-Fi Passwords](todo/flash-page-password-handling.md)
2. [Enforce the Performance Merge Gate](todo/performance-merge-gate.md)

## 2. Isolate Applications and Evidence Paths

**Goal:** `/vr/`, `/test/`, and `/conductor/` are separate applications, and
performance evidence has one explicit owner.

1. [Isolate VR, Test, and Conductor Browser Entries](todo/isolate-vr-test-conductor-entries.md)
2. [Eliminate Cold-Start CPU Spikes](todo/level-transition-cpu-spikes.md),
   including the fresh-context cold-transition profile
3. [Remove the Redundant Test UI](todo/remove-redundant-test-ui.md)

This order is required: the entry split establishes the Test application, the
transition work establishes its durable evidence path, and only then can the
temporary overlay and frame-metrics path be deleted.

## 3. Simplify Runtime and Operator Boundaries

**Goal:** Show, level, operator, and application lifecycle responsibilities are
explicit without introducing another framework.

1. [Separate Authored Level States From Show Composition](todo/level-state-and-show-composition.md)
2. [Reduce Level Runtime Responsibilities](todo/level-runtime-responsibilities.md)
3. [Replace the Station Broker With BroadcastChannel](todo/replace-station-broker-with-broadcast-channel.md)
4. [Simplify the Conductor Application](todo/simplify-conductor.md)
5. [Complete the Application Lifecycle](todo/application-lifecycle.md)
6. [Standardize Runtime Boundary Names](todo/runtime-naming-consistency.md)
7. [Configure Fallow Architecture Boundaries](todo/fallow-boundary-rules.md)

Coordinate the Test-preset move and preset-contract extraction with milestone
2 so the same files are not reorganized twice.

## 4. Make the Physical PCVR Path Safe and Viable

**Goal:** The complete Windows, SteamVR, USB-C, and PICO path is controllable
and meets the performance gates.

1. [Reset M5 State on Host Change](todo/m5-host-switch-state-reset.md)
2. [Enforce M5 Liveness and Device Validation](todo/m5-liveness-and-device-validation.md)
3. [Simplify the M5 Control Contract](todo/m5-control-contract-cleanup.md)
4. [Add an XR Flight Rig](todo/xr-flight-rig.md)
5. [Bring Scent Within the Frame Budget](todo/scent-performance-budget.md)
6. [Reduce Thermal Fragment Cost](todo/thermal-fragment-budget.md)
7. [Validate Every Consumer of Shared Wind Changes](todo/shared-wind-consumer-validation.md)

This milestone ends with a complete show run on the physical installation.
The run must pass at 90 Hz; 72 Hz is acceptable only as an explicitly measured
product decision.

## 5. Contract and Cleanup Backlog

**Goal:** Remove bounded contract and maintenance debt after the blockers.
Take a task earlier only when it directly overlaps the active change.

- [Tighten the Material Shader Patch Contract](todo/material-shader-patch-contract.md)
  and [Tighten Scent Source Types](todo/scent-source-type-safety.md)
- [Smooth Animal Boundary Turns](todo/smooth-animal-boundary-turns.md)
- [Deduplicate Positive Modulo Inside the World Domain](todo/deduplicate-world-positive-modulo.md)
  and [Reuse the World Cell Random Function in Grass](todo/reuse-world-cell-random-in-grass.md)
- [Reduce Rocks and Vegetation Runtime Duplication](todo/static-population-runtime-duplication.md)
- [Remove the Unused `sharedEchoGrass` Export](todo/remove-unused-shared-echo-grass-export.md)

### Conditional Branch Work

Activate these tasks only if `origin/grass-clipmap` is being considered for
integration:

- [Choose One Grass Owner Before Merging Grass Clipmap](todo/grass-clipmap-single-owner.md)
- [Bound Headset Diagnostics Before Merge](todo/headset-diagnostics-lifecycle-config.md)
