/**
 * Purpose: The web release of Becoming Many: the start menu in front of the
 *   real experience, seamlessly.
 * Context: The Show's Run starts at once, behind the menu, in a prelude: it
 *   holds at its start without the white veil while the visitor already
 *   glides through its White World. The menu draws into that same world
 *   (one renderer) and borrows its air particles for the spinner, the title
 *   and the click. Choosing Desktop or VR simply lets the Show play: the
 *   glide speeds up and the piece begins around the same particles.
 *   Inside the experience a gear (or Esc) opens the settings and pauses.
 * Responsibility: Start the Run, wire the menu to its stage, steer the
 *   prelude, map settings onto the Run, pause and resume around settings.
 * Boundary: Uses src/ only through startLevel and the Run contract; the root
 *   page and the installation are untouched.
 */

import { Euler, Quaternion, Vector3 } from "three";
import { createAutopilot } from "./autopilot.js";
import { createCameraSteering } from "./camera-steering.js";
import { startEarlySpinner } from "./early-spinner.js";
import { createAirBorrow } from "./lib/air-borrow.js";
import { createAirBurst } from "./lib/air-burst.js";
import { orbitSpinner, runLoader } from "./lib/air-loaders.js";
import { createAirTitle } from "./lib/air-title.js";
import {
  DESKTOP_PARTICLE_SCALE,
  GLIDE_METERS_PER_SECOND,
  MENU_DENSITY_SCALE,
  MENU_GLIDE_METERS_PER_SECOND,
} from "./lib/air-world.js";
import { renderLegal } from "./lib/legal.js";
import { createMenuFlow, VISIT_URL } from "./lib/menu-flow.js";
import { createStageWorld } from "./lib/stage-world.js";
import { showVersion } from "./lib/version.js";

const root = document.documentElement;
const phone = window.matchMedia("(pointer: coarse)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
root.classList.add("plain-marker");
root.dataset.device = phone ? "phone" : "desktop";
showVersion();

const experience = Promise.all([
  import("../src/levels/level.runtime"),
  import("../src/levels/level-catalog"),
  import("../src/dramaturgy/piece-schedule"),
  import("../src/levels/connections.level"),
  import("../src/dramaturgy/narration-catalog"),
  import("../src/dramaturgy/end-credits"),
]);

/** @type {import("../src/levels/run-contract").Run | undefined} */
let run;
/** Seconds of quiet between the narrator's last word and the end title. */
const ENDING_PAUSE_SECONDS = 4;
/** @type {ReturnType<typeof createAutopilot> | undefined} */
let autopilot;
const variant = { phone, loading: null };
let resolveRun;
const runReady = new Promise((resolve, reject) => {
  resolveRun = { resolve, reject };
});

const menu = createMenuFlow({
  loadSeconds: 3,
  paceSeconds: 2.4,
  stageHoldSeconds: 2.2,
  buildingSeconds: 1.7,
  modes: ["desktop", "vr", "gyro"],
  // Test: no tone when a choice changes the screen.
  selectSound: false,
  settingKeys: [
    "language",
    "volume",
    "quality",
    "invert",
    "control",
    "autopilot",
    "fullscreen",
  ],
  copy: {
    de: {
      hintBegin:
        "Danach wählst du, wie du eintrittst: Desktop, VR-Brille oder Handy.",
    },
    en: {
      hintBegin: "Then choose how to enter: desktop, VR headset or phone.",
    },
  },
  // Loading is real: the experience itself, started behind the menu.
  ready: runReady,
  beforeReady: () =>
    variant.title.gather({ from: variant.loading, stagger: 1.0, travel: 1.9 }),
  // Leaving the experience returns to the menu in the same page, so
  // fullscreen and the loaded world stay.
  onExit: () => returnToMenu(),
});
variant.menu = menu;
// The spinner shows at once; the world's particles take over once it loads.
const earlySpinner = startEarlySpinner({
  count: phone ? 140 : 210,
  round: menu.settings.quality === "high",
  title: document.querySelector("[data-title]"),
});
// When the title begins to form, nothing may linger on the canvas.
menu.on("loaded", () => earlySpinner.fadeOut());
window.__air = variant;
// "To the menu" arrives with ?skip; a later reload should load in full again.
// Back from the experience: the menu waits for the title to form.
if (menu.skipped) root.dataset.awaitingTitle = "";
if (menu.skipped) {
  const url = new URL(window.location.href);
  url.searchParams.delete("skip");
  window.history.replaceState(null, "", url);
}
renderLegal(menu.settings.language);
menu.on("settings", () => renderLegal(menu.settings.language));

const viewport = document.querySelector("[data-show-viewport]");
const titleNode = document.querySelector("[data-title]");
const showCanvas = document.querySelector("[data-show-canvas]");
const vrButton = document.querySelector("[data-vr-enter]");
const keysCard = document.querySelector(".app-intro--keys");
const lifetime = new AbortController();
window.addEventListener("pagehide", () => lifetime.abort());

// 1. Flight input. In the menu the pointer (or tilt) steers a little; inside
// the experience only W A S D or the arrow keys fly, the way the earlier
// tutorial did: keys ease in, turning and climbing follow smoothed rates,
// and the nose slowly levels out when nothing is held. No pointer lock.
const KEYBOARD = {
  keyTau: 0.15, // A key press eases in instead of jumping.
  turnTau: 0.3, // Turn and climb rates follow the keys with this lag.
  maxYawRate: 0.6, // rad/s; the Run turns 0.8 rad/s at full roll.
  maxPitchRate: 0.7, // rad/s
  maxPitch: (Math.PI / 4) * 0.95, // The Run's full forward tilt is 45°.
  levelTau: 4, // With no climb key held, the nose levels out this slowly.
};
const FLIGHT_KEYS = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
};
const pressed = new Set();
const flying = () => menu.inShow && menu.screen === "show";
window.addEventListener("keydown", (event) => {
  if (!flying()) return;
  if (Object.values(FLIGHT_KEYS).flat().includes(event.code)) {
    pressed.add(event.code);
    event.preventDefault();
    // Flying already: the keys card has been read.
    if (intro?.card === keysCard) intro.advance();
  }
});
window.addEventListener("keyup", (event) => pressed.delete(event.code));
window.addEventListener("blur", () => pressed.clear());
const held = (keys) => keys.some((code) => pressed.has(code));
const ease = (tau, dt) => 1 - Math.exp(-dt / tau);
const keys = { lateral: 0, vertical: 0, yawRate: 0, pitchRate: 0, pitch: 0 };

// On the phone the tilt flies: sideways turns, forward and back sinks and
// climbs, measured from how the phone is held when the piece begins.
const GYRO = {
  rangeDegrees: 28, // Tilt that reaches full deflection.
  deadDegrees: 3, // Small tremors of the hand do nothing.
  tau: 0.22, // Smoothing of the tilt.
  maxTurn: 0.75, // Full sideways tilt turns like the keyboard's full turn.
};
const orientation = { alpha: 0, beta: 0, gamma: 0, at: -1e9 };
// Some browsers (Chrome on Android) leave the turn around the vertical axis
// out of the plain event and give it only with the compass; the 360°
// steering needs it, so the compass fills the gap.
let compassAlpha = null;
window.addEventListener("deviceorientationabsolute", (event) => {
  if (event.alpha !== null) compassAlpha = event.alpha;
});
window.addEventListener("deviceorientation", (event) => {
  if (event.beta === null || event.gamma === null) return;
  orientation.alpha = event.alpha ?? compassAlpha ?? 0;
  orientation.beta = event.beta;
  orientation.gamma = event.gamma;
  orientation.at = performance.now();
});
/**
 * Steering and climb in the screen's own frame, in degrees, from where
 * "up" points as seen from the phone. Turning the phone in the plane of its
 * screen, like a steering wheel, steers; tipping its top away or toward you
 * sinks or climbs. Read from gravity, so it works however steeply the phone
 * is held and in either orientation.
 */
function screenTilt() {
  const rad = Math.PI / 180;
  const beta = orientation.beta * rad;
  const gamma = orientation.gamma * rad;
  // Earth's up in the device frame (x right, y top, z out of the screen).
  const ux = -Math.sin(gamma) * Math.cos(beta);
  const uy = Math.sin(beta);
  const uz = Math.cos(gamma) * Math.cos(beta);
  const angle =
    (((window.screen.orientation?.angle ?? window.orientation ?? 0) + 360) %
      360) *
    rad;
  // The same up in the screen's frame, which turns with the orientation.
  const sx = ux * Math.cos(angle) - uy * Math.sin(angle);
  const sy = ux * Math.sin(angle) + uy * Math.cos(angle);
  return {
    // Clockwise like a steering wheel turns right.
    side: Math.atan2(-sx, sy) / rad,
    // Tipping the top away (the screen facing up more) is negative.
    forward: -Math.asin(Math.max(-1, Math.min(1, uz))) / rad,
  };
}
/**
 * Which way the phone faces, in radians clockwise, for the 360° steering:
 * the visitor turns around with it and the flight follows. Read from where
 * the phone's back and top point, so it holds whether the phone is upright
 * or lying flat; only differences to the start matter.
 */
function phoneHeading() {
  const rad = Math.PI / 180;
  const [a, b, g] = [
    orientation.alpha * rad,
    orientation.beta * rad,
    orientation.gamma * rad,
  ];
  const [ca, sa, cb, sb, cg, sg] = [
    Math.cos(a),
    Math.sin(a),
    Math.cos(b),
    Math.sin(b),
    Math.cos(g),
    Math.sin(g),
  ];
  // The device's back (-z) and top (+y) in the earth frame (east, north).
  // The back is where the visitor faces, and turning the phone like a wheel
  // leaves it alone; only a phone held nearly flat, whose back points at the
  // floor, borrows its direction from the top instead.
  const backEast = -(cg * sa * sb + ca * sg);
  const backNorth = -(sa * sg - ca * cg * sb);
  const topEast = -cb * sa;
  const topNorth = ca * cb;
  const level = Math.hypot(backEast, backNorth);
  const flat = Math.min(1, Math.max(0, (0.45 - level) / 0.3));
  return Math.atan2(
    backEast * (1 - flat) + topEast * flat,
    backNorth * (1 - flat) + topNorth * flat,
  );
}
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * 360°: the phone is a window into the world, like a 360° video. Its
 * orientation becomes the view at once, with no delay and no bank; the
 * flight then turns toward where the view points. The view is set against
 * the flight body each frame, so the body's own turning never shows.
 */
const look = {
  device: new Quaternion(),
  world: new Quaternion(),
  body: new Quaternion(),
  euler: new Euler(),
  turn: new Quaternion(),
  forward: new Vector3(),
  offset: null,
  viewYaw: 0,
  viewPitch: 0,
  bodyYaw: null,
  active: false,
};
const UP = new Vector3(0, 1, 0);
const OUT_OF_SCREEN = new Vector3(0, 0, 1);
// The phone's camera looks out of its back, not along its top.
const BACK_VIEW = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
function deviceView(out) {
  const rad = Math.PI / 180;
  look.euler.set(
    orientation.beta * rad,
    orientation.alpha * rad,
    -orientation.gamma * rad,
    "YXZ",
  );
  out.setFromEuler(look.euler).multiply(BACK_VIEW);
  const angle =
    (window.screen.orientation?.angle ?? window.orientation ?? 0) * rad;
  return out.multiply(look.turn.setFromAxisAngle(OUT_OF_SCREEN, -angle));
}
const yawOf = (q) => {
  look.forward.set(0, 0, -1).applyQuaternion(q);
  return Math.atan2(-look.forward.x, -look.forward.z);
};
const pitchOf = (q) => {
  look.forward.set(0, 0, -1).applyQuaternion(q);
  return Math.asin(Math.max(-1, Math.min(1, look.forward.y)));
};
/**
 * How the visitor steers right now: the controls setting (keys, camera,
 * wheel, 360°, touch), whatever the device was taken for. The two phone
 * ways need the motion sensor; while it is silent, a finger steers.
 */
function activeControl() {
  if (flightMode === "vr") return "vr";
  const chosen = menu.settings.control;
  const sensing = performance.now() - orientation.at < 1000;
  if ((chosen === "wheel" || chosen === "turn") && !sensing) return "touch";
  return chosen;
}
const directLook = () => menu.inShow && activeControl() === "turn";
/** Every frame after flight: set the view, note where body and view point. */
function updateLook(camera) {
  if (!directLook()) {
    if (look.active) camera.quaternion.identity();
    look.active = false;
    look.offset = null;
    look.bodyYaw = null;
    return;
  }
  look.active = true;
  deviceView(look.device);
  camera.parent.getWorldQuaternion(look.body);
  // Straight on is wherever the flight faces when the look begins.
  look.offset ??= yawOf(look.body) - yawOf(look.device);
  look.world.setFromAxisAngle(UP, look.offset).multiply(look.device);
  camera.quaternion.copy(look.body).invert().multiply(look.world);
  look.viewYaw = yawOf(look.world);
  look.viewPitch = pitchOf(look.world);
  look.bodyYaw = yawOf(look.body);
}

const shapeTilt = (degrees) => {
  const size = Math.max(0, Math.abs(degrees) - GYRO.deadDegrees);
  return Math.sign(degrees) * Math.min(1, size / GYRO.rangeDegrees);
};
let flightMode = "desktop";
let neutral = null;
const tilt = { side: 0, forward: 0 };

const steer = { forwardTilt: 0, rightTilt: 0 };

// On a phone whose motion sensor is missing or not allowed, a finger flies:
// drag sideways to turn, up and down to climb and sink, from wherever it
// lands; letting go eases back, as the keys do. A ring and a dot show it.
const touch = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
const TOUCH_RANGE = 0.2; // Share of the shorter screen side for a full turn.
const touchPad = document.querySelector("[data-touch-pad]");
const touchKnob = document.querySelector("[data-touch-knob]");
const touchSteers = () => menu.inShow && activeControl() === "touch";
function endTouch() {
  touch.id = null;
  touch.x = 0;
  touch.y = 0;
  if (touchPad) touchPad.hidden = true;
}
window.addEventListener(
  "pointerdown",
  (event) => {
    // A finger, or the mouse when touch is the chosen way.
    const finger =
      event.pointerType === "touch" ||
      (menu.settings.control === "touch" && event.button === 0);
    if (!finger || touch.id !== null) return;
    if (!flying() || !touchSteers() || intro) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".app-gear, .app-autopilot, .app-camera")) return;
    touch.id = event.pointerId;
    touch.x0 = event.clientX;
    touch.y0 = event.clientY;
    if (touchPad) {
      touchPad.style.left = `${event.clientX}px`;
      touchPad.style.top = `${event.clientY}px`;
      touchKnob.style.transform = "translate(-50%, -50%)";
      touchPad.hidden = false;
    }
  },
  true,
);
window.addEventListener("pointermove", (event) => {
  if (event.pointerId !== touch.id) return;
  const range = Math.min(window.innerWidth, window.innerHeight) * TOUCH_RANGE;
  const clamp = (value) => Math.max(-1, Math.min(1, value));
  touch.x = clamp((event.clientX - touch.x0) / range);
  touch.y = clamp((event.clientY - touch.y0) / range);
  touchKnob.style.transform = `translate(calc(-50% + ${touch.x * 48}px), calc(-50% + ${touch.y * 48}px))`;
});
for (const type of ["pointerup", "pointercancel"])
  window.addEventListener(type, (event) => {
    if (event.pointerId === touch.id) endTouch();
  });

// On the desktop the body can fly instead of the keys: the arms are wings
// in front of the webcam (a setting). Keys still steer whenever pressed.
const camera = createCameraSteering({
  preview: document.querySelector("[data-camera-preview]"),
  onState: (state) => {
    root.dataset.cameraState = state;
  },
});
const usesCamera = () => activeControl() === "camera";
// The positions above the mirror: the one seen now in ink.
const poseNodes = document.querySelectorAll("[data-pose]");
let shownPose;
function renderPose() {
  requestAnimationFrame(renderPose);
  // The page's styles follow how the visitor steers right now.
  const control = menu.inShow ? activeControl() : menu.settings.control;
  if (root.dataset.control !== control) root.dataset.control = control;
  const pose = usesCamera() ? camera.pose : null;
  if (pose === shownPose) return;
  shownPose = pose;
  for (const node of poseNodes)
    node.toggleAttribute("data-active", node.dataset.pose === pose);
}
renderPose();
// Mirror and positions can be hidden; this browser remembers it.
const CAMERA_HIDDEN_KEY = "becoming-many-camera-hidden";
try {
  if (localStorage.getItem(CAMERA_HIDDEN_KEY) === "1")
    root.dataset.cameraHidden = "";
} catch {
  // Without storage the mirror simply shows.
}
for (const button of document.querySelectorAll("[data-camera-toggle]"))
  button.addEventListener("click", () => {
    const hide = !("cameraHidden" in root.dataset);
    if (hide) root.dataset.cameraHidden = "";
    else delete root.dataset.cameraHidden;
    try {
      localStorage.setItem(CAMERA_HIDDEN_KEY, hide ? "1" : "0");
    } catch {
      // The choice then lasts for this visit.
    }
  });
// Icon buttons and landmarks: their accessible names follow the language.
function labelControls() {
  for (const node of document.querySelectorAll("[data-i18n-label]"))
    node.setAttribute("aria-label", menu.t(node.dataset.i18nLabel));
}
labelControls();
menu.on("settings", labelControls);
// The corner arrow leads back from wherever it shows: from a legal page to
// where it was opened, from the others to the menu (or the experience).
const cornerBack = document.querySelector("[data-app-back]");
menu.on("screen", (screen) => {
  if (cornerBack)
    cornerBack.dataset.action =
      screen === "imprint" || screen === "privacy" ? "return" : "back";
});

/** Start or stop the camera to match the setting, once inside the piece. */
function syncCamera() {
  if (menu.inShow && usesCamera()) camera.start();
  else camera.stop();
}

// The autopilot flies until the visitor steers: a flight key, or the phone
// tipped or turned well away from how it rests. After a few seconds without
// steering it takes over again, from wherever the flight is heading.
const TAKEOVER = {
  resumeMs: 5000,
  phoneDegrees: 12, // Tipped or turned this far, the phone steers itself.
  stillDegrees: 3, // Smaller movements count as resting.
};
const takeover = { flying: false, movedAt: -1e9, still: null };
const wrapDegrees = (degrees) => ((((degrees + 180) % 360) + 360) % 360) - 180;
function phonePose() {
  const tilted = screenTilt();
  return { ...tilted, heading: (phoneHeading() * 180) / Math.PI };
}
const poseChange = (a, b) =>
  Math.max(
    Math.abs(a.side - b.side),
    Math.abs(a.forward - b.forward),
    Math.abs(wrapDegrees(a.heading - b.heading)),
  );

function watchTakeover(sensing) {
  const now = performance.now();
  const winged = usesCamera() && camera.spread;
  let steering = pressed.size > 0 || winged || touch.id !== null;
  if (steering) takeover.movedAt = now;
  const control = activeControl();
  if ((control === "wheel" || control === "turn") && sensing) {
    const pose = phonePose();
    if (!takeover.still) takeover.still = pose;
    else if (poseChange(pose, takeover.still) > TAKEOVER.stillDegrees) {
      takeover.still = pose;
      takeover.movedAt = now;
    }
    neutral ??= pose;
    // In 360° the phone only looks around: the autopilot keeps flying.
    steering =
      control !== "turn" &&
      Math.max(
        Math.abs(pose.side - neutral.side),
        Math.abs(pose.forward - neutral.forward),
      ) > TAKEOVER.phoneDegrees;
  }
  if (takeover.flying && steering) handOver();
  else if (!takeover.flying && now - takeover.movedAt > TAKEOVER.resumeMs) {
    takeover.flying = true;
    autopilot.resume(steer);
    // The phone's pose from now on is its resting one.
    if (takeover.still) neutral = takeover.still;
    root.dataset.autopilotState = "flying";
  }
}

/** The visitor steers from here, starting from the autopilot's tilt. */
function handOver() {
  if (!takeover.flying) return;
  takeover.flying = false;
  keys.pitch = (-steer.forwardTilt * Math.PI) / 4;
  keys.pitchRate = 0;
  keys.yawRate = steer.rightTilt * 0.8;
  tilt.forward = -steer.forwardTilt;
  tilt.side =
    activeControl() === "turn"
      ? steer.rightTilt
      : steer.rightTilt / GYRO.maxTurn;
  root.dataset.autopilotState = "manual";
}

function resetTakeover() {
  takeover.flying = false;
  takeover.movedAt = -1e9;
  takeover.still = null;
  root.dataset.autopilotState = "manual";
}
const preludeInput = {
  readInput(deltaSeconds) {
    const dt = Math.max(0, deltaSeconds);
    menu.input.update(dt);
    if (!menu.inShow) {
      const free = menu.screen !== "launch";
      steer.rightTilt = free ? menu.input.x * 0.1 : 0;
      steer.forwardTilt = free ? menu.input.y * 0.05 : 0;
      return steer;
    }
    const sensing = performance.now() - orientation.at < 1000;
    if (menu.settings.autopilot && autopilot && flightMode !== "vr") {
      watchTakeover(sensing);
      if (takeover.flying) return autopilot.steer(dt, steer);
    }
    const control = activeControl();
    if (control === "wheel" || control === "turn") {
      const now = screenTilt();
      neutral ??= now;
      const smooth = ease(GYRO.tau, dt);
      if (control === "turn") {
        // 360°: the view already follows the phone directly (directLook);
        // the flight turns and pitches toward wherever the visitor looks.
        if (!flying() || look.bodyYaw === null) {
          steer.rightTilt = 0;
          steer.forwardTilt = 0;
          return steer;
        }
        const error = wrapAngle(look.viewYaw - look.bodyYaw);
        steer.rightTilt = Math.max(-1, Math.min(1, -error * 1.8));
        const pitch = Math.max(-1, Math.min(1, look.viewPitch / (Math.PI / 4)));
        // Looking up climbs, whatever invert look says.
        steer.forwardTilt = -pitch * (menu.settings.invert ? -1 : 1);
        return steer;
      }
      const forward = flying() ? shapeTilt(now.forward - neutral.forward) : 0;
      tilt.forward += (forward - tilt.forward) * smooth;
      // Tilting the top away leans forward and sinks, like on the ICAROS.
      steer.forwardTilt = -tilt.forward;
      const side = flying() ? shapeTilt(now.side - neutral.side) : 0;
      tilt.side += (side - tilt.side) * smooth;
      steer.rightTilt = tilt.side * GYRO.maxTurn;
      return steer;
    }
    if (!flying()) pressed.clear();
    // Spread arms in front of the camera fly, unless a key is held.
    if (usesCamera() && camera.tracking && pressed.size === 0) {
      const wings = camera.read(flying() ? dt : 0);
      steer.rightTilt = flying() ? wings.turn : 0;
      steer.forwardTilt = flying() ? -wings.lift : 0;
      // A key pressed later carries on from the wings' tilt.
      keys.pitch = (-steer.forwardTilt * Math.PI) / 4;
      keys.yawRate = steer.rightTilt * 0.8;
      keys.pitchRate = 0;
      return steer;
    }
    // Keys, or a finger dragging on a phone without its motion sensor.
    const lateral = Math.max(
      -1,
      Math.min(
        1,
        Number(held(FLIGHT_KEYS.right)) -
          Number(held(FLIGHT_KEYS.left)) +
          touch.x,
      ),
    );
    const vertical = Math.max(
      -1,
      Math.min(
        1,
        Number(held(FLIGHT_KEYS.up)) - Number(held(FLIGHT_KEYS.down)) - touch.y,
      ),
    );
    keys.lateral += (lateral - keys.lateral) * ease(KEYBOARD.keyTau, dt);
    keys.vertical += (vertical - keys.vertical) * ease(KEYBOARD.keyTau, dt);
    const turn = ease(KEYBOARD.turnTau, dt);
    keys.yawRate += (keys.lateral * KEYBOARD.maxYawRate - keys.yawRate) * turn;
    keys.pitchRate +=
      (keys.vertical * KEYBOARD.maxPitchRate - keys.pitchRate) * turn;
    keys.pitch = Math.max(
      -KEYBOARD.maxPitch,
      Math.min(KEYBOARD.maxPitch, keys.pitch + keys.pitchRate * dt),
    );
    if (Math.abs(keys.vertical) < 0.05)
      keys.pitch *= Math.exp(-dt / KEYBOARD.levelTau);
    // The Run turns at 0.8 rad/s and banks 45° at full roll; pitch up is a
    // backward tilt. W climbs, as in the tutorial (invert look swaps it).
    steer.rightTilt = keys.yawRate / 0.8;
    steer.forwardTilt = -keys.pitch / (Math.PI / 4);
    return steer;
  },
};

// The menu's particle look carries into the experience on this device.
const particles = {
  airDensity: phone ? MENU_DENSITY_SCALE.phone : MENU_DENSITY_SCALE.desktop,
  airSize: finePointer ? DESKTOP_PARTICLE_SCALE : 1,
  scentDensity: phone ? 1.6 : 2.5,
  scentSize: finePointer ? DESKTOP_PARTICLE_SCALE : 1.2,
};

async function startExperience() {
  const [
    { startLevel },
    { LEVEL_CATALOG },
    { PIECE_SCHEDULE, PIECE_PASSAGES },
    { level: connectionsLevel },
    { resolveNarrationLanguage, narrationDurationSeconds },
    { endCreditsPresenceAt },
  ] = await experience;
  viewport.hidden = false;
  run = await startLevel(
    { canvas: showCanvas, viewport },
    {
      signal: lifetime.signal,
      kind: "show",
      preset: connectionsLevel,
      particles,
      prelude: {
        glideMetersPerSecond: MENU_GLIDE_METERS_PER_SECOND,
        input: preludeInput,
      },
      show: {
        schedule: PIECE_SCHEDULE,
        language: resolveNarrationLanguage(menu.settings.language),
        states: LEVEL_CATALOG,
        passages: PIECE_PASSAGES,
      },
    },
  );
  lifetime.signal.addEventListener("abort", () => void run?.unload(), {
    once: true,
  });
  variant.run = run;
  autopilot = createAutopilot({
    stage: run.stage,
    glideSpeed: () => GLIDE_METERS_PER_SECOND,
    inverted: () => menu.settings.invert,
  });
  variant.autopilot = autopilot;
  // The menu's particle work runs on the Run's own stage.
  const world = createStageWorld(run);
  const borrow = createAirBorrow(world, { capacity: phone ? 2600 : 4800 });
  variant.borrow = borrow;
  variant.title = createAirTitle({
    menu,
    borrow,
    title: document.querySelector("[data-title]"),
    maxCount: phone ? 950 : 1700,
    // The title stands over the credits; the legal pages only hide it.
    timing: {
      screens: ["loading", "menu", "credits", "ending"],
      neutralScreens: ["imprint", "privacy"],
    },
    sound: menu.sound,
  });
  createAirBurst({ borrow, menu });
  // The piece's end credits: on a screen the title forms from the air, as
  // large as in the menu, with the credits under it, fixed to the screen. A
  // headset keeps the world's own credits panel.
  // The title comes only once the narrator has finished and a breath has
  // passed; the show's clock stops at its end, so the breath is counted in
  // real seconds.
  const lastCue = PIECE_SCHEDULE.narration.at(-1);
  let quietSince = null;
  run.stage.onFrame(() => updateLook(run.stage.camera));
  run.stage.onFrame(() => {
    if (!menu.inShow || flightMode === "vr" || !run.show) return;
    const seconds = run.show.sample().timeSeconds;
    const voiceEnds = Math.min(
      lastCue.atSeconds +
        narrationDurationSeconds(lastCue.cueId, run.readLanguage() ?? "de"),
      PIECE_SCHEDULE.durationSeconds,
    );
    const over =
      seconds >= voiceEnds - 0.05 &&
      endCreditsPresenceAt(PIECE_SCHEDULE, seconds) > 0;
    if (over) quietSince ??= performance.now();
    else quietSince = null;
    const ended =
      over && performance.now() - quietSince > ENDING_PAUSE_SECONDS * 1000;
    if (ended && menu.screen === "show") {
      // The title forms with its sounds, as at the beginning.
      menu.sound.revive();
      menu.go("ending");
    } else if (!ended && menu.screen === "ending") menu.go("show");
    // The credits fade in only once the title stands.
    const standing =
      menu.screen === "ending" && titleNode.classList.contains("is-set");
    if (standing) root.dataset.endingCredits = "";
    else if (menu.screen !== "settings") delete root.dataset.endingCredits;
  });
  // The particle spinner forms right on the drawn one, dot by dot.
  if (!menu.skipped)
    runLoader(variant, orbitSpinner, {
      count: 210,
      phoneCount: 140,
      instant: true,
    });
  applySettings();
  // The world fades in over the white page once it has drawn.
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  viewport.dataset.live = "";
  // Once the world's canvas has faded in (app.css), the particles take over.
  if (!menu.skipped)
    window.setTimeout(() => earlySpinner.handOver(variant.loading), 1300);
  // Back from the experience there is no loading screen, but the title forms
  // from the air as always, and the menu appears under it once it stands.
  if (menu.skipped) {
    earlySpinner.handOver();
    await variant.title.gather({ stagger: 1.0, travel: 1.9 });
    delete root.dataset.awaitingTitle;
  }
}
// The narrator's first recording, in the visitor's language, loads with the
// world, and the loading waits for it, so the voice is there from its first
// word. The Run's own narration player then loads every recording of the
// language in the background, and on a language switch the other language's
// at once. Fetched into the browser's cache, which the player plays from.
const voiceReady = experience
  .then(async (modules) => {
    const [
      ,
      ,
      { PIECE_SCHEDULE },
      ,
      { narrationUrl, resolveNarrationLanguage },
    ] = modules;
    const first = PIECE_SCHEDULE.narration[0]?.cueId;
    if (!first) return;
    const url = narrationUrl(
      first,
      resolveNarrationLanguage(menu.settings.language),
    );
    const response = await fetch(url, { cache: "force-cache" });
    if (response.ok) await response.arrayBuffer();
  })
  .catch(() => {});

// 1b. When the browser cannot run the piece, say why, what to try, and
// where to fly it for real (the Futurium), instead of a blank page.
const failNode = document.querySelector("[data-fail]");
let failed = null;
function renderFail() {
  if (!failed) return;
  const key = { webgl: "Webgl", start: "Start", lost: "Lost" }[failed];
  failNode.querySelector("[data-fail-title]").textContent = menu.t(
    `fail${key}Title`,
  );
  failNode.querySelector("[data-fail-text]").textContent = menu.t(`fail${key}`);
  failNode.querySelector("[data-fail-visit]").href =
    VISIT_URL[menu.settings.language] ?? VISIT_URL.en;
}
function fail(reason) {
  if (failed || lifetime.signal.aborted) return;
  failed = reason;
  earlySpinner.stop();
  camera.stop();
  root.dataset.failed = reason;
  renderFail();
  failNode.hidden = false;
  driftAir(failNode.querySelector("[data-fail-air]"));
}

/**
 * The white world's air on a plain canvas, for when the real one cannot be
 * drawn: dots of the particles' ink drifting slowly, nearer ones larger.
 */
function driftAir(canvas) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const dots = Array.from({ length: 420 }, () => {
    const near = random() ** 3;
    return {
      x: random(),
      y: random(),
      size: 0.8 + near * 3.6,
      speed: 0.004 + near * 0.012,
      sway: random() * Math.PI * 2,
      alpha: 0.35 + near * 0.6,
    };
  });
  const draw = (now) => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== Math.round(width * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#202126";
    const t = still ? 0 : now / 1000;
    for (const dot of dots) {
      const x = ((dot.x + t * dot.speed * 0.6) % 1) * width;
      const y =
        ((dot.y +
          Math.sin(t * 0.2 + dot.sway) * 0.004 -
          t * dot.speed * 0.25 +
          1) %
          1) *
        height;
      context.globalAlpha = dot.alpha;
      context.beginPath();
      context.arc(x, y, dot.size / 2, 0, Math.PI * 2);
      context.fill();
    }
    if (!still && !failNode.hidden) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
menu.on("settings", renderFail);
failNode
  .querySelector("[data-fail-reload]")
  .addEventListener("click", () => window.location.reload());
showCanvas.addEventListener("webglcontextlost", () => fail("lost"));
// The experience draws with WebGL 2; without it nothing can start.
const canDraw = (() => {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
})();

// 1c. No headset on this computer: the way in through the headset's own
// browser, or streamed from here; a second look once one is connected.
const vrAddress = `${window.location.host}${window.location.pathname.replace(/index\.html$/, "")}`;
for (const node of document.querySelectorAll("[data-vr-address]"))
  node.textContent = vrAddress;
document
  .querySelector("[data-vr-copy]")
  ?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(`https://${vrAddress}`);
      button.dataset.copied = "";
      window.setTimeout(() => delete button.dataset.copied, 1600);
    } catch {
      // Without clipboard access the address stays there to read.
    }
  });
document
  .querySelector("[data-vr-recheck]")
  ?.addEventListener("click", async () => {
    const status = document.querySelector("[data-vr-status]");
    status.textContent = "";
    const found = await menu.recheckVr();
    if (found) menu.go("modes");
    else status.textContent = menu.t("vrRecheckNone");
  });

if (!canDraw) fail("webgl");
else
  startExperience()
    .then(() => voiceReady)
    .then(() => {
      // A camera already chosen earlier loads its model once the world stands.
      if (!phone && menu.settings.control === "camera") camera.preload();
    })
    .then(
      () => resolveRun.resolve(),
      (error) => {
        console.error(error);
        fail("start");
        resolveRun.reject(error);
      },
    );

// 2. Settings map onto the Run
const RENDER_SCALE = {
  low: 0.75,
  mid: 1,
  high: Math.min(window.devicePixelRatio || 1, 1.5),
};
function applySettings(_settings, key) {
  const settings = menu.settings;
  // The autopilot shows as a small symbol; steering changes the card.
  if (settings.autopilot) root.dataset.autopilot = "";
  else delete root.dataset.autopilot;
  for (const node of document.querySelectorAll("[data-tilt-text]")) {
    node.dataset.i18n =
      settings.control === "turn" ? "introTiltTurn" : "introTilt";
    node.textContent = menu.t(node.dataset.i18n);
  }
  if (key === "autopilot") {
    if (settings.autopilot) resetTakeover();
    else handOver();
  }
  if (key === "control") {
    // Chosen in the menu already: the model loads in the background now.
    if (settings.control === "camera") camera.preload();
    // The phone ways ask for the motion sensor inside this very click.
    if (
      (settings.control === "wheel" || settings.control === "turn") &&
      typeof DeviceOrientationEvent?.requestPermission === "function"
    )
      DeviceOrientationEvent.requestPermission().catch(() => {});
    syncCamera();
    // Straight on is wherever the visitor faces now.
    look.offset = null;
    neutral = null;
  }
  if (!run) return;
  // High quality draws the air round, as it once was; the borrowed stand-ins
  // and the title's ink follow so nothing changes shape mid-flight.
  const round = settings.quality === "high";
  run.setPreferences({
    volume: settings.volume / 100,
    renderScale: RENDER_SCALE[settings.quality] ?? 1,
    invertPitch: settings.invert,
    roundParticles: round,
    screenCredits: true,
  });
  variant.borrow?.setShape(round ? "circle" : "square");
  variant.title?.setRound(round);
  if (run.readLanguage() !== settings.language)
    run.setLanguage(settings.language);
}
menu.on("settings", applySettings);

// Fullscreen: on by default when entering on a screen, and a setting. In
// fullscreen Esc stays the settings key (Chrome); holding it leaves.
const page = document.documentElement;
const canFullscreen = Boolean(
  document.fullscreenEnabled ?? document.webkitFullscreenEnabled,
);
if (!canFullscreen) root.dataset.noFullscreen = "";
const isFullscreen = () =>
  Boolean(document.fullscreenElement ?? document.webkitFullscreenElement);
let fullscreenPending = false;
function enterFullscreen() {
  if (!canFullscreen || isFullscreen() || fullscreenPending) return;
  fullscreenPending = true;
  const request = page.requestFullscreen ?? page.webkitRequestFullscreen;
  Promise.resolve(request?.call(page, { navigationUI: "hide" }))
    .then(() => navigator.keyboard?.lock?.(["Escape"]))
    .catch(() => {})
    .finally(() => {
      fullscreenPending = false;
    });
}
function leaveFullscreen() {
  if (!isFullscreen()) return;
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  Promise.resolve(exit?.call(document)).catch(() => {});
}
// The first touch of the page, any click, tap or key, already goes
// fullscreen; browsers allow it only inside such a gesture.
const firstTouch = (event) => {
  if (event.type === "keydown" && event.key === "Escape") return;
  for (const type of ["pointerup", "keydown"])
    window.removeEventListener(type, firstTouch, true);
  if (menu.settings.fullscreen) enterFullscreen();
};
for (const type of ["pointerup", "keydown"])
  window.addEventListener(type, firstTouch, true);
// Choosing desktop or phone goes fullscreen again if it was left.
document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (
      menu.settings.fullscreen &&
      target.closest('[data-mode="desktop"], [data-mode="gyro"]')
    )
      enterFullscreen();
    if (target.closest('[data-setting="fullscreen"]'))
      if (menu.settings.fullscreen)
        // The click toggles the setting after this listener runs.
        leaveFullscreen();
      else enterFullscreen();
  },
  true,
);

// 3. Entering: the same world simply begins to play.
let entering = false;
menu.on("launch", (mode, status) => {
  // No motion sensor, or not allowed: a phone flies by touch instead.
  const byTouch =
    mode === "gyro" &&
    (status === "denied" || status === "missing") &&
    navigator.maxTouchPoints > 0;
  if ((status !== "ready" && !byTouch) || entering || !run) return;
  entering = true;
  // Without the sensor the phone ways fall back to touch by themselves.
  if (byTouch) {
    begin("gyro");
    return;
  }
  // VR must be requested inside this very click.
  if (mode === "vr") {
    run.xr.start().catch((reason) => {
      console.warn("The VR session request failed.", reason);
      entering = false;
      offerVr();
    });
    const unsubscribe = run.xr.subscribe((state) => {
      if (!state.isSessionActive) return;
      unsubscribe();
      begin("vr");
    });
    return;
  }
  begin(mode);
});

/**
 * The opening cards: headphones, then how to fly. Each stays a while and
 * gives way to a click, tap, Space or Enter. The piece's own five seconds of
 * silence are timed so the voice begins shortly after the last card leaves,
 * skipped or not.
 */
const INTRO = {
  soundSeconds: 12,
  controlsSeconds: 20,
  voiceAfterSeconds: 1.5, // From the last card leaving to the first word.
};
const SHOW_LEAD_IN_SECONDS = 5;
/** @type {{ card: Element | undefined, advance: () => void } | null} */
let intro = null;
const soundCard = document.querySelector(".app-intro--sound");
for (const node of document.querySelectorAll("[data-intro-next]")) {
  node.dataset.i18n = phone ? "continueTouch" : "continue";
  node.textContent = menu.t(node.dataset.i18n);
}

/** The controls card for this way of flying. */
function controlsCard() {
  const control = activeControl();
  if (control === "touch") return document.querySelector(".app-intro--touch");
  if (control === "wheel" || control === "turn")
    return document.querySelector(".app-intro--tilt");
  if (control === "camera") return document.querySelector(".app-intro--camera");
  return keysCard;
}

/**
 * Show the cards (none in a headset) while gliding at the show's speed, and
 * start the piece. Open settings pause the cards; flight holds until the
 * piece plays.
 */
function startIntro(withCards) {
  const cards = withCards
    ? [
        { node: soundCard, seconds: INTRO.soundSeconds },
        // Chosen when it shows: a silent sensor may have switched to touch.
        { node: keysCard, pick: controlsCard, seconds: INTRO.controlsSeconds },
      ].filter((card) => card.node)
    : [];
  for (const { node } of cards) delete node.dataset.state;
  let index = -1;
  let left = 0;
  let started = false;
  let last = performance.now();
  // Show time at which the cards should end: the voice follows soon after.
  const voiceAt = SHOW_LEAD_IN_SECONDS - INTRO.voiceAfterSeconds;
  const remaining = () =>
    Math.max(0, left) +
    cards.slice(index + 1).reduce((sum, card) => sum + card.seconds, 0);
  const play = () => {
    if (started) return;
    started = true;
    run.togglePlayback();
    // The menu's wind carries on under the piece's opening silence and gives
    // way to it, so the wind is there before the voice.
    window.setTimeout(() => {
      if (menu.inShow) menu.sound.release(7);
    }, 2500);
  };
  const finish = () => {
    intro = null;
    play();
    if (cards.length === 0) return;
    const now = run.show?.sample().timeSeconds ?? voiceAt;
    if (now < voiceAt) run.show?.seekTo(voiceAt);
  };
  const state = {
    card: undefined,
    advance() {
      if (cards[index]) cards[index].node.dataset.state = "out";
      index += 1;
      if (cards[index]?.pick) cards[index].node = cards[index].pick();
      state.card = cards[index]?.node;
      if (!state.card) {
        finish();
        return;
      }
      state.card.dataset.state = "in";
      left = cards[index].seconds;
    },
  };
  intro = state;
  state.advance();
  if (!intro) return;
  const tick = () => {
    if (intro !== state) return;
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const settingsOpen = menu.screen !== "show";
    if (!started)
      run.setPreludeGlide(settingsOpen ? 0 : GLIDE_METERS_PER_SECOND);
    if (!settingsOpen) {
      left -= dt;
      if (left <= 0) state.advance();
      if (intro === state && remaining() <= voiceAt) play();
    }
    if (intro === state) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// A click, tap, Space or Enter moves on to the next card.
window.addEventListener(
  "pointerdown",
  (event) => {
    if (!intro || menu.screen !== "show") return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".app-gear, .app-autopilot, .app-camera")) return;
    intro.advance();
  },
  true,
);
window.addEventListener("keydown", (event) => {
  if (!intro || menu.screen !== "show") return;
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    intro.advance();
  }
});

/** Glide up to the show's speed, show the opening, then let the piece play. */
function begin(mode = "desktop") {
  // The way in says which device it is: a computer's controls on the phone
  // way (or the reverse) give way to that way's own.
  const fits = {
    desktop: ["keys", "camera", "touch"],
    gyro: ["wheel", "turn", "touch"],
  }[mode];
  if (fits && !fits.includes(menu.settings.control))
    menu.set("control", mode === "gyro" ? "wheel" : "keys");
  root.dataset.handover = "";
  // Nothing to read while the piece begins: the launch screen stays empty.
  for (const node of document.querySelectorAll(
    "[data-launch-text], [data-launch-title]",
  ))
    node.textContent = "";
  const from = MENU_GLIDE_METERS_PER_SECOND;
  const to = GLIDE_METERS_PER_SECOND;
  const seconds = 1.6;
  const started = performance.now();
  const ramp = () => {
    const u = Math.min(1, (performance.now() - started) / 1000 / seconds);
    run.setPreludeGlide(from + (to - from) * u * u * (3 - 2 * u));
    if (u < 1) {
      requestAnimationFrame(ramp);
      return;
    }
    menu.inShow = true;
    root.dataset.inShow = "";
    flightMode = mode;
    root.dataset.flightMode = mode;
    // The phone's neutral is however it is held when the piece begins.
    neutral = null;
    look.offset = null;
    resetTakeover();
    syncCamera();
    if (mode === "gyro") navigator.wakeLock?.request("screen").catch(() => {});
    menu.go("show");
    // Keep the launch screen's controls hidden until it has faded out.
    window.setTimeout(() => delete root.dataset.handover, 1200);
    // The cards are for the screen; in a headset the piece simply begins.
    startIntro(mode !== "vr");
  };
  requestAnimationFrame(ramp);
}

/** A failed VR request leaves a button for a second try. */
function offerVr() {
  for (const node of document.querySelectorAll("[data-launch-text]"))
    node.textContent = menu.t("launchVrReady");
  vrButton.hidden = false;
  vrButton.onclick = () => {
    entering = true;
    run.xr.start().catch(() => {
      entering = false;
    });
  };
}

// 4. Settings pause the experience; leaving them resumes it.
let pausedBySettings = false;

/**
 * From the experience back to the menu without reloading: the Run returns
 * to its prelude (the Show at its start, holding, the ground stepping back),
 * flight and its helpers reset, the menu's sounds and wind come back, and
 * the title forms over the menu again.
 */
function returnToMenu() {
  if (!run || !menu.inShow) return;
  run.returnToPrelude(MENU_GLIDE_METERS_PER_SECOND);
  intro = null;
  for (const card of document.querySelectorAll(".app-intro"))
    delete card.dataset.state;
  menu.inShow = false;
  entering = false;
  pausedBySettings = false;
  delete root.dataset.inShow;
  delete root.dataset.flightMode;
  delete root.dataset.endingCredits;
  delete root.dataset.handover;
  flightMode = "desktop";
  camera.stop();
  pressed.clear();
  endTouch();
  Object.assign(keys, {
    lateral: 0,
    vertical: 0,
    yawRate: 0,
    pitchRate: 0,
    pitch: 0,
  });
  tilt.side = 0;
  tilt.forward = 0;
  neutral = null;
  look.offset = null;
  resetTakeover();
  menu.sound.revive();
  menu.sound.wind(true);
  menu.go("menu");
}
menu.on("screen", (screen) => {
  if (!run || !menu.inShow) return;
  if (screen === "settings") {
    if (document.pointerLockElement) document.exitPointerLock();
    if (run.readPlayback() === "playing") {
      run.togglePlayback();
      pausedBySettings = true;
    }
  } else if (screen === "show" && pausedBySettings) {
    pausedBySettings = false;
    if (run.readPlayback() === "paused") run.togglePlayback();
  }
});

// Esc while flying first releases the pointer; that release opens the
// settings, and the same Esc must not close them again.
document.addEventListener("pointerlockchange", () => {
  const locked = Boolean(document.pointerLockElement);
  if (locked) root.dataset.pointerLocked = "";
  else delete root.dataset.pointerLocked;
  if (!locked && menu.inShow && menu.screen === "show") {
    menu.escapeGuardUntil = performance.now() + 400;
    menu.go("settings");
  }
});

// 5. Jumping through the piece: one line of chapters in the settings.
const CHAPTERS = {
  prologue: { de: "Anfang", en: "Start" },
  scent: { de: "Geruch", en: "Scent" },
  echo: { de: "Echoortung", en: "Echolocation" },
  motion: { de: "Bewegung", en: "Motion" },
  thermal: { de: "Wärme", en: "Warmth" },
  magnetic: { de: "Magnetfeld", en: "Magnetic field" },
  finale: { de: "Verbindungen", en: "Connections" },
  return: { de: "Rückkehr", en: "Return" },
};
const track = document.querySelector("[data-timeline-track]");
const playhead = document.querySelector("[data-timeline-playhead]");
const readout = document.querySelector("[data-timeline-time]");
const chapterName = document.querySelector("[data-timeline-chapter]");
const segmentTemplate = document.querySelector("[data-segment-template]");
const clock = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
let chapters = [];
let duration = 525;
let hovering;

async function buildTimeline() {
  const [, , { PIECE_SCHEDULE }] = await experience;
  duration = PIECE_SCHEDULE.durationSeconds;
  track.setAttribute("aria-valuemax", String(Math.round(duration)));
  // A chapter starts a moment before its words, so its world can grow in.
  const starts = PIECE_SCHEDULE.narration.map((cue, index) =>
    index === 0
      ? 0
      : Math.max(0, cue.atSeconds - (cue.worldLeadSeconds ?? 0) - 4),
  );
  chapters = PIECE_SCHEDULE.narration.map((cue, index) => ({
    id: cue.cueId,
    at: starts[index],
    end: starts[index + 1] ?? duration,
  }));
  for (const chapter of chapters) {
    const segment = segmentTemplate.content.firstElementChild.cloneNode(true);
    segment.style.flexGrow = String(chapter.end - chapter.at);
    chapter.segment = segment;
    track.insertBefore(segment, playhead);
  }
  renderTimeline();
}
buildTimeline();

const currentSeconds = () => run?.show?.sample().timeSeconds ?? 0;
const chapterAt = (seconds) =>
  chapters.findLast((chapter) => seconds >= chapter.at) ?? chapters[0];
const nameOf = (chapter) =>
  CHAPTERS[chapter?.id]?.[menu.settings.language === "en" ? "en" : "de"] ??
  chapter?.id ??
  "";

/** Seconds under a pointer position on the track, chapter by chapter. */
function secondsAt(clientX) {
  for (const chapter of chapters) {
    const box = chapter.segment.getBoundingClientRect();
    if (clientX <= box.right + 1.5) {
      const u = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      return chapter.at + u * (chapter.end - chapter.at);
    }
  }
  return duration;
}

function renderTimeline() {
  const now = currentSeconds();
  const shown = hovering ?? now;
  const current = chapterAt(now);
  for (const chapter of chapters) {
    const share = (now - chapter.at) / (chapter.end - chapter.at);
    chapter.segment.style.setProperty(
      "--fill",
      `${Math.min(1, Math.max(0, share)) * 100}%`,
    );
    chapter.segment.toggleAttribute("data-current", chapter === current);
    chapter.segment.toggleAttribute(
      "data-hover",
      hovering !== undefined && chapter === chapterAt(hovering),
    );
  }
  // The playhead sits inside the current segment, gaps included.
  if (current?.segment) {
    const box = current.segment.getBoundingClientRect();
    const frame = track.getBoundingClientRect();
    const u = (now - current.at) / (current.end - current.at);
    playhead.style.setProperty(
      "--at",
      `${box.left - frame.left + Math.min(1, Math.max(0, u)) * box.width}px`,
    );
  }
  chapterName.textContent = nameOf(chapterAt(shown));
  readout.textContent = `${clock(shown)} / ${clock(duration)}`;
  track.setAttribute("aria-valuenow", String(Math.round(now)));
  track.setAttribute("aria-valuetext", `${nameOf(current)}, ${clock(now)}`);
}

function jumpTo(seconds) {
  if (!run?.show) return;
  run.show.seekTo(Math.max(0, Math.min(duration, seconds)));
  renderTimeline();
}

track.addEventListener("pointermove", (event) => {
  hovering = secondsAt(event.clientX);
  renderTimeline();
});
track.addEventListener("pointerleave", () => {
  hovering = undefined;
  renderTimeline();
});
track.addEventListener("pointerdown", (event) => {
  // A click on a chapter's first few pixels lands on its start.
  const seconds = secondsAt(event.clientX);
  const chapter = chapterAt(seconds);
  const box = chapter.segment.getBoundingClientRect();
  jumpTo(event.clientX - box.left < 8 ? chapter.at : seconds);
});
track.addEventListener("keydown", (event) => {
  const index = chapters.indexOf(chapterAt(currentSeconds()));
  if (event.key === "ArrowRight") jumpTo(chapters[index + 1]?.at ?? duration);
  else if (event.key === "ArrowLeft")
    jumpTo(
      currentSeconds() - chapters[index].at > 3
        ? chapters[index].at
        : (chapters[index - 1]?.at ?? 0),
    );
  else return;
  event.preventDefault();
  event.stopPropagation();
});
menu.on("screen", (screen) => {
  if (screen === "settings" && menu.inShow) renderTimeline();
});
menu.on("settings", () => renderTimeline());
