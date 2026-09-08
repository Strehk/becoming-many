# Control

This folder owns visitor input and rig locomotion. Run creates the controls,
selects M5 or desktop each frame, applies height limits and ends input capture.
Show transport and visitor replacement remain with Show and Run.

- `desktop-controls.runtime.ts` owns pointer lock, held keys and reusable movement
  buffers. Keyboard navigation is captured only while the canvas owns pointer
  lock; release or window blur clears held keys. Mouse look changes the camera,
  while WASD/arrows move the rig along the viewing direction.
- `m5-flight.runtime.ts` owns reusable glider math for one rig. Calibrated roll
  steers world-up yaw and negative pitch climbs against neutral descent. The
  horizon stays level and head look does not steer flight. M5 owns validation;
  neutral frames still glide. Physical polarity acceptance remains open.
- `flight-settings.ts` holds shared glide, climb, yaw, descent and minimum
  ground-clearance values. View pitch assistance belongs to World in
  `src/world/viewer-rig.ts` and also aligns Start and Credits presentation.
- `flight-ground-clearance.ts` clamps rig altitude against World Surface height.
  Run selects applicable limits; each level authors its optional maximum.
- `flight-reset.ts` preserves the existing origin/heading reset without changing
  local head pose. Its retirement remains tied to the reviewed fresh-visitor
  sequence in #9/#46; a pose reset does not replace a Run.

Controls own no content, protocol parsing, renderer or frame loop.
