<!--
Purpose: Explain the World Engine test scope.
Context: Chunk coordinates and scheduling are shared by every streamed module.
Responsibility: Describe the invariants protected by tests in this folder.
Boundary: Visual module behavior and physical PICO acceptance live elsewhere.
-->

# World Tests

These tests protect the content-independent World Engine contracts.

`chunk-system.test.ts` verifies the aligned chunk hierarchy, dynamic resident
windows, fixed slot reuse, negative coordinates, and revision invalidation.
`volume-chunk-window.test.ts` verifies the matching X/Y/Z pool, vertical face
recycling, negative heights, and revision invalidation.
`stream-queue.test.ts` verifies bounded capacity, replacement of stale slot
work, cooperative multi-frame jobs, and the per-frame deadline.

Module tests should remain with their matching test area. Browser checks and
physical PICO performance measurements are separate acceptance steps.
