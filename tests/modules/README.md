<!--
Purpose: Explain the streamed module test scope.
Context: Modules own rendering resources while consuming shared World Engine contracts.
Responsibility: Route module integration tests without placing them in src.
Boundary: Shared grid and scheduler behavior belongs in ../world.
-->

# Module Tests

This folder verifies how concrete content modules use the shared lifecycle,
chunk assignments, stream queue, and Three.js resources.

Tests focus on stable resource counts, bounded updates, and complete cleanup.
Air Particles cover deterministic generated volumes, vertical recycling, and
surface exclusion. Scent Particles cover both layers: shader patches and rejected
timings, deterministic per-plant emission inside each plant's own volume,
one signature color per family, the hidden capacity no plant needed, prints
that stay where an animal left them, ring bounds, and stepped chunk writes. Grass covers deterministic roots, authored zone visibility,
fixed instancing, partial chunk updates, GPU animation, and disposal. Terrain
covers height-only geometry generation, cooperative row streaming,
shared-border equality, stale-job rejection, and GPU resource disposal. Zone
Visualizer verifies its five diagnostic colors, continuous condition input,
and shader wiring. Magnetic Sense verifies its sky-dome lifecycle, that the ported
shimmer math and the previous version's saved values survive, the field axis
and palette reaching the uniforms, the clock wrap, and parameter
validation. Visual quality and target-device performance still
require browser and physical PICO acceptance.
