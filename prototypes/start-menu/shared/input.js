/**
 * Purpose: Give every prototype one smoothed look direction from mouse, touch or gyro.
 * Context: The menu's mode choice can grant motion-sensor access; once it does,
 *   the view follows the phone's tilt exactly like it follows the mouse.
 * Responsibility: Track the pointer in pixels and a normalised -1..1 look offset.
 * Boundary: Permission requests belong to the menu flow; this only listens.
 */

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export function createInput() {
  const state = {
    // Pointer position in CSS pixels; starts at the centre.
    px: window.innerWidth / 2,
    py: window.innerHeight / 2,
    // Smoothed look offset in -1..1.
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    pointerActive: false,
    gyroActive: false,
    invert: false,
    orientation: { alpha: 0, beta: 0, gamma: 0 },
  };

  window.addEventListener("pointermove", (event) => {
    state.px = event.clientX;
    state.py = event.clientY;
    state.pointerActive = true;
    if (state.gyroActive) return;
    state.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    state.targetY = (event.clientY / window.innerHeight) * 2 - 1;
  });
  document.addEventListener("pointerleave", () => {
    state.pointerActive = false;
  });

  window.addEventListener("deviceorientation", (event) => {
    if (event.beta === null || event.gamma === null) return;
    state.gyroActive = true;
    state.orientation = {
      alpha: event.alpha ?? 0,
      beta: event.beta,
      gamma: event.gamma,
    };
    // Held upright in front of the face is roughly beta 60.
    state.targetX = clamp(event.gamma / 30, -1, 1);
    state.targetY = clamp((event.beta - 60) / 30, -1, 1);
  });

  state.update = (dt) => {
    const sign = state.invert ? -1 : 1;
    state.x = approach(state.x, state.targetX * sign, 4, dt);
    state.y = approach(state.y, state.targetY * sign, 4, dt);
  };

  return state;
}
