# Control

This folder contains input, navigation, and operator-control logic.

`desktop-controls.ts` provides the first MVP adapter: click the canvas to capture
the mouse, look around with the mouse, fly in the viewing direction with WASD
or the arrow keys, and press Escape to release the pointer.

`flight-ground-clearance.ts` keeps that flight position at least one metre above
the deterministic ground in levels that expose a visible world surface.

`m5-flight.ts` applies an M5 ControlFrame as ICAROS glider flight: constant
forward glide, roll yaws the heading about world-up (the horizon never banks),
pitch climbs or descends (the view never pitches). It runs every frame while
an M5 host is configured — a quality-0 frame is neutral steering, straight and
level, so a dropped poll never stops the flight. Keyboard movement returns
when the host is cleared; the frames come from `src/m5`, and the same
headset-pose caveat below applies.

`flight-reset.ts` returns the flight to the pose a level starts from, which the
conductor page reaches over the station link. It is desktop rehearsal only:
inside an `immersive-vr` session Three.js overwrites the camera position and
orientation from the headset pose every frame, so a reset has no effect there
until the camera sits under a rig. That is the same reason
`flight-ground-clearance.ts` does not clamp in the headset today.

Control code must not own content modules, world rendering, or its own frame
loop.
