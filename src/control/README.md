# Control

This folder contains input, navigation, and operator-control logic.

`desktop-controls.ts` provides the first MVP adapter: click the canvas to capture
the mouse, look around with the mouse, fly in the viewing direction with WASD
or the arrow keys, and press Escape to release the pointer.

`flight-ground-clearance.ts` keeps that flight position at least one metre above
the deterministic ground in levels that expose a visible world surface.

`flight-reset.ts` returns the flight to the pose a level starts from, which the
conductor page reaches over the station link. It is desktop rehearsal only:
inside an `immersive-vr` session Three.js overwrites the camera position and
orientation from the headset pose every frame, so a reset has no effect there
until the camera sits under a rig. That is the same reason
`flight-ground-clearance.ts` does not clamp in the headset today.

Control code must not own content modules, world rendering, or its own frame
loop.
