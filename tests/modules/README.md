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
surface exclusion. Grass covers deterministic roots, authored zone visibility,
fixed instancing, partial chunk updates, GPU animation, and disposal. Terrain
covers height-only geometry generation, cooperative row streaming,
shared-border equality, stale-job rejection, and GPU resource disposal. Zone
Visualizer verifies its five diagnostic colors, continuous condition input,
and shader wiring. Magnetic Sense verifies its world-space line shader, base
color preservation, Zone Visualizer composition, field direction, flow time,
and parameter validation. Visual quality and target-device performance still
require browser and physical PICO acceptance.
