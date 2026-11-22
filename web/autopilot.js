/**
 * Purpose: Fly the experience on its own, as a showcase.
 * Context: With the autopilot setting on, the flight's input comes from here
 *   instead of the keys or the phone. The Run glides at its own speed; this
 *   only bends the path, like a slow camera move: it plans the way ahead far
 *   out, bends round trees and rocks in wide curves, keeps low over the
 *   ground, and eases every turn and climb in and out.
 * Responsibility: Read the camera, the ground height and the nearby
 *   vegetation and rock instances from the Run's stage, and turn them into
 *   the same forward and right tilt a visitor would give.
 * Boundary: Steers only; the Run's own flight model, speed and ground
 *   clearance stay in charge. Not used in VR, where the head looks around.
 */

import { Box3, Matrix4, Vector3 } from "three";

const AUTOPILOT = {
  clearance: 3.6, // Metres above the ground: low, between the trunks.
  // Ahead, the path is planned this far: the camera sees a tree long before
  // it reaches it and bends round it in one wide curve.
  lookAhead: 60,
  margin: 3.4, // Room left beside a trunk or a rock.
  sampleSeconds: 0.3, // How often the way ahead is planned again.
  gatherRadius: 70,
  // Directions weighed around the course, either side.
  spreadRadians: (55 * Math.PI) / 180,
  candidates: 23,
  keepBonus: 0.12, // A planned direction is kept unless another is clearly better.
  headingTau: 2.2, // The aimed-at heading drifts, it never jumps.
  turnGain: 0.75, // Heading error to turn.
  maxTurn: 0.28, // Banks at most 12.6° and turns at most 13°/s.
  // Turn and pitch follow critically damped springs: they ease in and out,
  // with no sudden change of rate anywhere.
  turnSpring: 1.1, // rad/s
  pitchSpring: 0.9,
  groundTau: 1.8, // The height aimed at follows the ground ahead slowly.
  climbGain: 0.32,
  maxClimb: 0.9, // m/s up or down.
  // Full forward tilt in the Run is 45°.
  maxPitchRadians: Math.PI / 4,
};
const OBSTACLE_GROUPS = ["Vegetation", "Rocks"];

/** Radians off the general direction: up to about 90° either way. */
const meander = (time) =>
  1.0 * Math.sin(time * 0.045) + 0.55 * Math.sin(time * 0.112 + 1.3);
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * @param {{ stage: import("../src/levels/run-contract").RunStage,
 *   glideSpeed: () => number, inverted: () => boolean }} options
 */
export function createAutopilot({ stage, glideSpeed, inverted }) {
  const position = new Vector3();
  const forward = new Vector3();
  const matrix = new Matrix4();
  const point = new Vector3();
  const box = new Box3();
  const boxes = new WeakMap();
  /** Nearby obstacles: x, z, radius, top. */
  let obstacles = [];
  let sinceSample = Infinity;
  let time = Math.random() * 1000;
  const turnState = { value: 0, velocity: 0 };
  const pitchState = { value: 0, velocity: 0 };
  /** The general direction the meander swings around, set on takeover. */
  let base = null;
  /** The planned direction, and the heading eased toward it. */
  let plan = null;
  let aim = null;
  let riseTop = -Infinity;
  let targetY = null;

  function localBox(mesh) {
    let local = boxes.get(mesh);
    if (!local) {
      mesh.geometry.computeBoundingBox();
      local = mesh.geometry.boundingBox.clone();
      boxes.set(mesh, local);
    }
    return local;
  }

  /** Gather the trees and rocks around the camera from their instances. */
  function gather() {
    const found = [];
    const reach = AUTOPILOT.gatherRadius ** 2;
    stage.scene.traverseVisible((object) => {
      if (!object.isInstancedMesh) return;
      const group = object.parent;
      if (!group || !OBSTACLE_GROUPS.includes(group.name)) return;
      const local = localBox(object);
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, matrix);
        matrix.premultiply(object.matrixWorld);
        point.setFromMatrixPosition(matrix);
        const dx = point.x - position.x;
        const dz = point.z - position.z;
        if (dx * dx + dz * dz > reach) continue;
        box.copy(local).applyMatrix4(matrix);
        if (box.isEmpty()) continue;
        found.push({
          x: (box.min.x + box.max.x) / 2,
          z: (box.min.z + box.max.z) / 2,
          radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
          top: box.max.y,
        });
      }
    });
    obstacles = found;
  }

  /**
   * How blocked the way along heading `angle` is, 0 (clear) and up: trunks
   * and rocks that reach our height count the more the nearer they stand.
   * Also reports the highest blocking top close ahead.
   */
  function blockage(angle) {
    const dirX = Math.sin(angle);
    const dirZ = -Math.cos(angle);
    let cost = 0;
    let closeTop = -Infinity;
    for (const obstacle of obstacles) {
      if (obstacle.top < position.y - 1.5) continue;
      const dx = obstacle.x - position.x;
      const dz = obstacle.z - position.z;
      const ahead = dx * dirX + dz * dirZ;
      if (ahead <= -obstacle.radius || ahead > AUTOPILOT.lookAhead) continue;
      const side = Math.abs(dx * dirZ - dz * dirX);
      const room = obstacle.radius + AUTOPILOT.margin;
      if (side >= room * 1.6) continue;
      const nearness = 1 - Math.max(0, ahead) / AUTOPILOT.lookAhead;
      // Inside the margin it blocks; a little beyond it only discourages.
      const overlap = side < room ? 1 : 1 - (side - room) / (room * 0.6);
      cost += overlap * nearness * nearness * 2;
      if (ahead < 12 && side < room)
        closeTop = Math.max(closeTop, obstacle.top);
    }
    return { cost, closeTop };
  }

  /** Spring `state` toward `target`; critically damped, so it never rings. */
  function spring(state, target, omega, dt) {
    state.velocity +=
      (omega * omega * (target - state.value) - 2 * omega * state.velocity) *
      dt;
    state.value += state.velocity * dt;
  }

  return {
    /** Write this frame's tilt into `steer` and return it. */
    steer(deltaSeconds, steer) {
      const dt = Math.min(0.1, Math.max(0, deltaSeconds));
      time += dt;
      const camera = stage.camera;
      camera.getWorldPosition(position);
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      forward.normalize();
      const heading = Math.atan2(forward.x, -forward.z);

      // A slow meander: the course swings left and right of one general
      // direction in long waves, so the path never repeats and never circles.
      base ??= heading - meander(time);
      const course = base + meander(time);
      aim ??= heading;

      // Plan: weigh directions around the course by how clear they are and
      // how far they stray, and keep the last plan unless one is clearly
      // better. Planned often, followed slowly.
      sinceSample += dt;
      if (sinceSample >= AUTOPILOT.sampleSeconds) {
        sinceSample = 0;
        gather();
        let best = null;
        let kept = null;
        for (let index = 0; index < AUTOPILOT.candidates; index += 1) {
          const offset =
            ((index / (AUTOPILOT.candidates - 1)) * 2 - 1) *
            AUTOPILOT.spreadRadians;
          const angle = course + offset;
          const { cost, closeTop } = blockage(angle);
          const total =
            cost +
            0.5 * (Math.abs(offset) / AUTOPILOT.spreadRadians) ** 2 +
            // Turning far from where the flight already heads costs too.
            0.25 * Math.abs(wrapAngle(angle - heading));
          const option = { angle, total, closeTop, cost };
          if (!best || total < best.total) best = option;
          if (
            plan !== null &&
            Math.abs(wrapAngle(angle - plan)) <
              AUTOPILOT.spreadRadians / (AUTOPILOT.candidates - 1)
          )
            kept = option;
        }
        const chosen =
          kept && kept.total <= best.total + AUTOPILOT.keepBonus ? kept : best;
        plan = chosen.angle;
        // Only when every way ahead is blocked close by does it rise over.
        riseTop = chosen.cost > 1.2 ? chosen.closeTop : -Infinity;
      }
      plan ??= course;
      aim += wrapAngle(plan - aim) * (1 - Math.exp(-dt / AUTOPILOT.headingTau));
      const turn = Math.max(
        -AUTOPILOT.maxTurn,
        Math.min(
          AUTOPILOT.maxTurn,
          wrapAngle(aim - heading) * AUTOPILOT.turnGain,
        ),
      );
      spring(turnState, turn, AUTOPILOT.turnSpring, dt);

      // Height: low over the highest ground of the stretch ahead, followed
      // slowly; up over a trunk only when there is no way around it.
      let ground = -Infinity;
      for (const distance of [0, 8, 16, 24, 32]) {
        ground = Math.max(
          ground,
          stage.groundYAt(
            position.x + forward.x * distance,
            position.z + forward.z * distance,
          ),
        );
      }
      const wanted = Math.max(ground + AUTOPILOT.clearance, riseTop + 1.8);
      targetY ??= Math.max(wanted, position.y);
      // Rise sooner than sink, so the ground never comes too close.
      const tau =
        wanted > targetY ? AUTOPILOT.groundTau * 0.5 : AUTOPILOT.groundTau;
      targetY += (wanted - targetY) * (1 - Math.exp(-dt / tau));
      const climb = Math.max(
        -AUTOPILOT.maxClimb,
        Math.min(
          AUTOPILOT.maxClimb,
          (targetY - position.y) * AUTOPILOT.climbGain,
        ),
      );
      const speed = Math.max(0.5, glideSpeed());
      const pitch = Math.asin(Math.max(-0.5, Math.min(0.5, climb / speed)));
      spring(pitchState, pitch, AUTOPILOT.pitchSpring, dt);

      steer.rightTilt = turnState.value;
      // A climb is a backward tilt; invert look swaps the Run's pitch.
      steer.forwardTilt =
        (-pitchState.value / AUTOPILOT.maxPitchRadians) * (inverted() ? -1 : 1);
      return steer;
    },
    /**
     * Take over from the visitor's steering without a jolt: carry on from
     * their tilt, along the way they face now.
     */
    resume(steer) {
      turnState.value = steer?.rightTilt ?? 0;
      turnState.velocity = 0;
      pitchState.value =
        -(steer?.forwardTilt ?? 0) *
        AUTOPILOT.maxPitchRadians *
        (inverted() ? -1 : 1);
      pitchState.velocity = 0;
      base = null;
      plan = null;
      aim = null;
      targetY = null;
      riseTop = -Infinity;
      sinceSample = Infinity;
    },
  };
}
