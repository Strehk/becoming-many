# Control

One flight model receives `forwardTilt` and `rightTilt` in −1..1. Composition
connects the desktop and M5 sources; Flight Control reads each once per frame,
adds their axes, and clamps the result. Mouse or head pose never steers.

- `desktop-controller.ts` owns pointer lock, local mouse look and held keys.
  W/↑ tilts forward, S/↓ backward, A/← left and D/→ right. Keys emulate a body
  moving toward the selected tilt: neutral to full takes half a second, holding
  stays at the limit, and release or reversal moves continuously. This is the
  only keyboard response state. Aliases share directions; opposing keys target
  neutral. Blur, pointer-lock loss and unload clear keys and emulated tilt.
- The M5 runtime reports fresh physical tilt directly. Firmware owns calibration;
  the browser retains only transport lifetime and freshness checks.
- `flight-control.ts` sets body pitch and bank, each limited to 45 degrees.
  Banking turns the heading. The rig travels forward at constant path speed;
  neutral tilt flies level. The rig's existing quaternion owns heading, so reset
  needs no second orientation state.
- `flight-pose.ts` owns reset and terrain clearance calculations. Run chooses
  when to reset and which height limits apply.

The desktop camera inherits the body's pitch and bank and adds independent
mouse look. In XR, Control rotates the rig only around the vertical axis;
physical headset tracking supplies body tilt, with World's prone-posture
assistance. World publishes observations and never derives a steering pose from
movement. Benchmarks keep their authored camera poses.
