# Control

This folder owns visitor input and rig locomotion. Composition creates ordered
input sources once; Run supplies each frame step, active speed and height
limits. Show transport and visitor replacement remain with Show and Run.

- `control-contract.ts` defines the complete source sample: `forwardTilt` and
  `rightTilt`, each normalized to −1..1. Every source returns both axes on every
  read; inactive, disconnected and stale states return zero rather than another
  shape. The flight model samples all connected sources each live frame, adds
  them in Composition's fixed order (M5, then desktop today), and clamps each
  sum to −1..1. This deterministic rule has no exclusive desktop/M5 mode and no
  source priority. A future source such as a gamepad can implement the same
  contract and be wired by Composition without changing Run or flight logic.
- `desktop-controller.ts` owns pointer lock, held keys and one reusable input
  sample. Mouse changes only the camera's local look and contributes no tilt.
  W/↑ means forward tilt and descent; S/↓ means backward tilt and climb; A/←
  means left tilt and a left turn; D/→ means right tilt and a right turn. It
  never translates the camera or rig. Keydown applies its target immediately;
  after keyup, only this adapter returns the released axis linearly to exact zero
  at 4 units/s (0.25 s from full tilt), using the supplied frame delta. Blur,
  pointer-lock loss, and unload neutralize it immediately. This creates no timer
  or second loop.
- `m5-controller.ts` adapts normalized M5 pitch/roll into the same two tilt
  axes. It ignores the frame delta and adds no rebound; missing, disconnected,
  or stale M5 input contributes neutral axes.
- `flight-control.ts` combines every source and owns the only reusable flight
  math that mutates the viewer rig. Every live update applies continuous forward
  travel along a tilted path at constant speed. Forward/backward tilt selects a
  held path angle within ±45 degrees; neutral input flies level. Right/left tilt
  sets turn rate, integrated as a circular arc independent of frame subdivision.
  The rig carries yaw only; physical headset tilt is never applied twice.
  Flight angles are independent of gaze. Physical polarity acceptance remains open.
- `flight-settings.ts` holds shared path speed, maximum pitch, yaw and minimum
  ground-clearance values. View pitch assistance belongs to World in
  `src/world/viewer-rig.ts` and also aligns Credits presentation.
- `flight-pose.ts` contains the pure height clamp and origin/heading reset.
  Run selects height limits and reset timing; neither operation changes local
  head pose or replaces a complete Run lifetime.


Run owns frame integration, active speed and height limits. Composition wires
sources, and World publishes actual rig position/direction plus local eye facts.
The same control runs across all live levels and experiences; Start and
`/tutorial` have no separate flight implementation. Headset pose, like mouse
look, contributes no tilt and can remain active beside keyboard and M5 input.

The proposed visible Start look-ahead is not part of this control refactor. A
later implementation reads actual rig movement from World facts; it does not
add prediction physics to Control or create another runtime or frame loop.
Controls own no content, protocol parsing, renderer or frame loop.
