<!--
Purpose: Reserve a module boundary for authored or generated paths.
Context: The current experience has no rendered path system.
Responsibility: State what a future concrete module would own.
Boundary: This folder currently contains documentation only and claims no runtime behavior.
-->

# Paths

This is a README-only reserved extension boundary. There is no Paths module in
the current runtime.

A future issue may place or render paths by consuming read-only World Surface
and streaming contracts. The module would own path-specific geometry,
materials, capacity, and disposal. It must not control flight, navigation,
Terrain, or the shared stream scheduler.
