/**
 * Purpose: Show the real White World behind every start-menu prototype.
 * Context: The menu must not imitate the piece's particles; it runs the same
 *   Air Particles module, level recipe, White Veil and stream queue the show
 *   uses, with one Three.js renderer configured like the World Runtime.
 * Responsibility: Own the renderer, camera, viewpoint and frame loop for the
 *   prototype, and expose glide speed, look direction and veil presence.
 * Boundary: Nothing in src/ imports this file; it only borrows src/ modules.
 */

import {
  Color,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { FLIGHT_SETTINGS } from "../../../src/control/flight-settings";
import { HANDOFF_SETTINGS } from "../../../src/levels/handoff-settings";
import { level as whiteWorld } from "../../../src/levels/white-world.level";
import { createAirParticlesModule } from "../../../src/modules/start/point-cloud/point-cloud.module";
import { createWhiteVeil } from "../../../src/modules/white-veil/white-veil";
import { StreamQueue } from "../../../src/world/stream-queue";
import { WORLD_RUNTIME_SETTINGS } from "../../../src/world/world-settings";

/** The piece's own pace: its glide speed and the time the veil takes to lift. */
export const GLIDE_METERS_PER_SECOND =
  FLIGHT_SETTINGS.glideSpeedMetersPerSecond;
export const VEIL_LIFT_SECONDS = HANDOFF_SETTINGS.veilLiftSeconds;

const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/**
 * Options: veil (initial presence, 0..1), speed (m/s), pixelRatio (cap).
 * Returns handles for the variant to steer and a per-frame hook.
 */
export function createAirWorld(canvas, options = {}) {
  const renderer = new WebGLRenderer({
    ...WORLD_RUNTIME_SETTINGS.renderer,
    canvas,
  });
  const scene = new Scene();
  scene.background = new Color(whiteWorld.backgroundColor);

  // The World Runtime's camera: Three.js defaults, far plane at the view distance.
  const camera = new PerspectiveCamera();
  camera.far = whiteWorld.viewDistance;
  camera.rotation.order = "YXZ";

  const viewpoint = {
    worldPosition: new Vector3(),
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(0, 0, -1),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: MathUtils.degToRad(camera.fov / 2),
    viewDistanceMeters: whiteWorld.viewDistance,
  };
  const streamQueue = new StreamQueue(WORLD_RUNTIME_SETTINGS.streamQueue);
  const air = createAirParticlesModule({
    scene,
    viewpoint,
    parameters: whiteWorld.airParticles,
    streamQueue,
  });
  const veil = createWhiteVeil({ scene, viewpoint });

  const state = {
    speed: options.speed ?? 0,
    targetSpeed: options.speed ?? 0,
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    offsetX: 0,
    offsetY: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,
    veil: options.veil ?? 0,
    targetVeil: options.veil ?? 0,
    veilRate: 1 / VEIL_LIFT_SECONDS,
    timeScale: 1,
    pixelRatioCap: options.pixelRatio ?? 2,
  };
  const frameHooks = [];

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, state.pixelRatioCap),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  camera.updateMatrixWorld();
  viewpoint.worldPosition.setFromMatrixPosition(camera.matrixWorld);
  air.load();
  air.activate();
  veil.module.load();
  veil.module.activate();
  veil.setPresence(state.veil);

  const forward = new Vector3();
  const right = new Vector3();
  const base = new Vector3();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const scaled = dt * state.timeScale;

    state.speed = approach(state.speed, state.targetSpeed, 1.2, dt);
    state.yaw = approach(state.yaw, state.targetYaw, 3, dt);
    state.pitch = approach(state.pitch, state.targetPitch, 3, dt);
    // The veil moves linearly, like Run lifting it over veilLiftSeconds.
    const step = state.veilRate * dt;
    state.veil += Math.max(
      -step,
      Math.min(step, state.targetVeil - state.veil),
    );
    veil.setPresence(state.veil);

    state.offsetX = approach(state.offsetX, state.targetOffsetX, 2.5, dt);
    state.offsetY = approach(state.offsetY, state.targetOffsetY, 2.5, dt);
    camera.rotation.set(state.pitch, state.yaw, 0);
    camera.getWorldDirection(forward);
    base.addScaledVector(forward, state.speed * scaled);
    right.crossVectors(forward, camera.up).normalize();
    camera.position
      .copy(base)
      .addScaledVector(right, state.offsetX)
      .addScaledVector(camera.up, state.offsetY);
    camera.updateMatrixWorld();
    viewpoint.worldPosition.setFromMatrixPosition(camera.matrixWorld);
    viewpoint.worldDirection.copy(forward);
    viewpoint.worldBodyDirection.copy(forward);

    for (const hook of frameHooks) hook(dt, now / 1000);
    air.update(scaled);
    veil.module.update(scaled);
    streamQueue.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    camera,
    renderer,
    get veil() {
      return state.veil;
    },
    /** Glide speed in metres per second; eased toward. */
    setSpeed(metersPerSecond) {
      state.targetSpeed = metersPerSecond;
    },
    /** Look offset in radians; eased toward. */
    setLook(yaw, pitch) {
      state.targetYaw = yaw;
      state.targetPitch = pitch;
    },
    /** Sideways and vertical head offset in metres; gives true parallax. */
    setOffset(x, y) {
      state.targetOffsetX = x;
      state.targetOffsetY = y;
    },
    /** Veil presence target; it travels at the show's lift rate unless seconds is given. */
    setVeil(presence, seconds = VEIL_LIFT_SECONDS) {
      state.targetVeil = Math.min(1, Math.max(0, presence));
      state.veilRate = 1 / Math.max(seconds, 0.001);
    },
    /** Slows drift and glide for the reduce-motion setting. */
    setTimeScale(scale) {
      state.timeScale = scale;
    },
    /** Lower render resolution for the graphics setting. */
    setPixelRatioCap(cap) {
      state.pixelRatioCap = cap;
      resize();
    },
    onFrame(hook) {
      frameHooks.push(hook);
    },
  };
}

/** Apply the shared menu settings (quality, reduce motion) to the world. */
export function bindWorldSettings(world, menu) {
  const apply = () => {
    world.setPixelRatioCap(
      { low: 0.75, mid: 1.25, high: 2 }[menu.settings.quality] ?? 2,
    );
    world.setTimeScale(menu.settings.reducedMotion ? 0.35 : 1);
  };
  apply();
  menu.on("settings", apply);
}

/**
 * Entering the piece: glide up to the show's speed while the world fades to
 * white, like a Stop cutting back to the veil; leaving launch lifts it again.
 */
export function bindLaunch(world, menu, rest = { speed: 0, veil: 0 }) {
  menu.on("screen", (screen, previous) => {
    if (screen === "launch") {
      world.setSpeed(GLIDE_METERS_PER_SECOND);
      world.setVeil(1, HANDOFF_SETTINGS.fadeSeconds);
    } else if (previous === "launch") {
      world.setSpeed(rest.speed);
      world.setVeil(rest.veil, VEIL_LIFT_SECONDS);
    }
  });
}
