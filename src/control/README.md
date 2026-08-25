# Control

This folder contains input, navigation, and operator-control logic.

`desktop-controls.ts` provides the first MVP adapter: click the canvas to capture
the mouse, look around with the mouse, fly in the viewing direction with WASD
or the arrow keys, and press Escape to release the pointer.

`flight-ground-clearance.ts` keeps that flight position at least one metre above
the deterministic ground in levels that expose a visible world surface.

Control code must not own content modules, world rendering, or its own frame
loop.
