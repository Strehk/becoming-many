<!--
Purpose: Track the missing XR locomotion owner and world-space viewer position.
Context: Controls and camera-centred modules currently treat the base camera transform as a world transform.
Responsibility: Define the smallest correction that makes flight and streaming agree in immersive VR.
Boundary: This does not add a locomotion framework, custom XR reference spaces, or a general view-state model.
-->

# Add an XR Flight Rig

**Status:** Open
**Priority:** Installation blocker

## Problem

M5 flight, flight reset, and ground clearance mutate the base camera. During an
immersive XR session Three.js replaces that pose with the headset pose, so the
ICAROS controller does not move the visitor through the world.

Parenting the camera to a flight rig fixes rendering but is not sufficient by
itself. `camera.position` then becomes the headset's local position inside the
rig. Terrain, Grass, Vegetation, Rocks, Animals, Air Particles, Scent,
Connections, Motion, and the Magnetic sky currently read that local value for
camera-centred placement or streaming. They would therefore remain near the XR
tracking origin while the rendered visitor flies away.

## Affected Files

- `src/world/world-runtime.ts`
- `src/control/desktop-controls.ts`
- `src/control/m5-flight.ts`
- `src/control/flight-reset.ts`
- `src/levels/level-runtime.ts`
- Camera-centred consumers under `src/modules/`
- `tests/control/m5-flight.test.ts`
- Focused runtime and module contract tests

## Smallest YAGNI Solution

Use two transforms with one explicit responsibility each:

- Create one long-lived Three.js `Group` as the navigation root, add it to the
  scene, and parent the camera to it. The root owns application locomotion:
  flight position and heading. The camera owns only desktop look or the local
  headset pose supplied by WebXR.
- Keep the existing `ControlFrame` and flight rates. M5 glide, yaw, reset, and
  the translation part of desktop movement write the navigation root. Desktop
  pointer look remains on the camera. Do not add another input mode.
- Create one long-lived `Vector3` for the viewer's world position. Refresh it
  with `camera.getWorldPosition(...)` after navigation and before module
  updates. Ground clearance queries this value, raises the navigation root by
  only the missing vertical distance, and updates the shared value by the same
  delta.
- Expose the vector through the existing `WorldContext` boundary as a narrow
  read-only `{ x, y, z }` contract. The runtime retains the mutable `Vector3`;
  consumers cannot move it. Every camera-centred placement, distance,
  streaming, and sky consumer reads it instead of `camera.position`. The render
  camera remains available only where projection or rendering actually needs a
  camera.

This adds one scene node, one reused vector, and one matrix-derived position per
frame. It allocates nothing in the hot path and keeps Three.js's automatic XR
camera update. The module update may observe headset translation from the
preceding render, at most one frame old; that is sufficient for chunk streaming
and bounded by the existing one-metre ground clearance. Calling
`WebXRManager.updateCamera()` a second time or replacing the reference space
would add version-sensitive control flow without a current need.

Do not add a generic `ViewState`, locomotion engine, reference-space wrapper,
movement-mode hierarchy, or per-module `getWorldPosition()` calls. If a future
consumer needs world orientation, add that fact to the same narrow boundary
when the concrete need exists.

## Three.js and WebXR Basis

- Installed Three.js is `0.185.1`. Its `WebXRManager` composes the XR cameras
  with the supplied camera's parent transform, so a single parent group is a
  supported fit for application locomotion.
- `Object3D.getWorldPosition(target)` explicitly writes the computed world
  position into a caller-owned vector, matching the allocation-free shared
  value required here: <https://threejs.org/docs/pages/Object3D.html#getWorldPosition>
- Three.js documents `WebXRManager.getCamera()` as the active per-view XR
  camera and keeps `cameraAutoUpdate` enabled by default. There is no need to
  take over that lifecycle for this fix:
  <https://threejs.org/docs/pages/WebXRManager.html>
- WebXR also supports application transforms through offset reference spaces,
  but that lower-level mechanism is unnecessary while the application has no
  tracked controllers or other spaces that need the same transform:
  <https://immersive-web.github.io/webxr/spatial-tracking-explainer.html#application-supplied-transforms>

## Verification

- Unit-test that navigation-root translation plus a local camera offset produces
  the expected shared world position.
- Unit-test that M5 yaw/glide and reset mutate the navigation root, not the
  tracked camera transform.
- Regression-test representative horizontal and vertical camera-centred
  consumers against the shared world position. Search all remaining
  `camera.position` reads and justify each rendering-only use.
- Verify desktop pointer look and WASD movement remain unchanged.
- On the wired PICO-through-SteamVR path, verify M5 steering, reset, and ground
  clearance move the rendered visitor. Also move the headset within the tracked
  space and confirm Terrain/Grass streaming, nearby Animals, and the Magnetic
  sky follow the resulting world position.
- Record comparable benchmark evidence before and after. The expected runtime
  cost is one parent matrix composition and one reused world-position query per
  frame, with no new draw calls or allocations.
