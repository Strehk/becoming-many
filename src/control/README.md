# Control

This folder contains input, navigation, and operator-control logic.

`desktop-controls.ts` provides the desktop adapter: click the canvas to capture
the mouse, look around with the mouse, fly in the viewing direction with WASD
or the arrow keys, and press Escape to release the pointer.

`flight-settings.ts` is the typed base configuration for ICAROS speed, climb,
yaw, neutral descent bias, minimum ground clearance, and upward view
assistance. `flight-ground-clearance.ts` constrains altitude relative to the
deterministic ground: the shared minimum applies where a level exposes a world
surface, while each level authors its own optional maximum.

`m5-flight.ts` applies an M5 ControlFrame as ICAROS glider flight: constant
forward glide, roll yaws the heading about world-up (the horizon never banks),
and pitch climbs or descends around the configured downward bias. It runs every
frame while an M5 host is configured — a quality-0 frame is neutral steering,
so a dropped poll continues the glide and gentle descent. Keyboard movement
returns when the host is cleared; the frames come from `src/m5`.

`flight-reset.ts` returns the flight rig to the pose a level starts from, which
the in-process conductor page reaches through `RunningLevel`. Reset and height limits stay
effective in immersive VR because they move the rig, not the headset-owned
camera pose.

Control code must not own content modules, world rendering, or its own frame
loop.
