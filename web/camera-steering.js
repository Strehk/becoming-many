/**
 * Purpose: Fly with the body in front of the webcam: the arms are wings.
 * Context: A desktop choice beside the keys, in the spirit of flying on the
 *   ICAROS with the whole body. Spread arms tilted to one side turn, raised
 *   arms climb, lowered arms sink; arms down at rest glide straight on.
 * Responsibility: Open the camera, find the shoulders and wrists with a pose
 *   model that ships with the page, turn them into a smoothed turn and lift,
 *   and draw a small grey mirror of the visitor with their wings.
 * Boundary: Everything runs in the browser; no image leaves the device and
 *   nothing is loaded from other servers. The flight input mapping lives in
 *   app/main.js.
 */

import loaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import binaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import modelUrl from "./pose/pose_landmarker_lite.task?url";

const CAMERA = {
  deadDegrees: 5, // A slightly crooked pair of arms flies straight.
  rangeDegrees: 26, // Arms tilted this far turn fully.
  maxTurn: 0.75, // Full tilt turns like the keyboard's full turn.
  deadLift: 0.12, // Wrists this near shoulder height (in shoulder widths).
  rangeLift: 0.6,
  tau: 0.25, // Smoothing of turn and lift, in seconds.
  // Wrists at least this many shoulder widths apart count as spread wings;
  // closer, the arms rest and the flight glides straight.
  spread: 1.7,
  visible: 0.5,
  lostSeconds: 0.6, // Without a person this long, the steering lets go.
};
// Pose landmarks: shoulders, elbows, wrists (left and right of the person).
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;

const shape = (value, dead, range) => {
  const size = Math.max(0, Math.abs(value) - dead);
  return Math.sign(value) * Math.min(1, size / range);
};

/**
 * @param {{ preview: HTMLCanvasElement | null,
 *   onState: (state: string) => void }} options
 */
export function createCameraSteering({ preview, onState }) {
  /** off, starting, ready, denied, failed */
  let state = "off";
  let video = null;
  let stream = null;
  let landmarker = null;
  /** The pose model, loading or loaded; fetched once, on first need. */
  let loading = null;
  const loadModel = () => {
    loading ??= createLandmarker().catch((error) => {
      loading = null;
      throw error;
    });
    return loading;
  };
  let frame = 0;
  let lastVideoTime = -1;
  let seenAt = -1e9;
  let pose = null;
  const target = { turn: 0, lift: 0, spread: false };
  const value = { turn: 0, lift: 0 };
  const context = preview?.getContext("2d");

  const setState = (next) => {
    state = next;
    onState(next);
  };

  async function createLandmarker() {
    const { PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = { wasmLoaderPath: loaderUrl, wasmBinaryPath: binaryUrl };
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: modelUrl, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    try {
      return await PoseLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      return PoseLandmarker.createFromOptions(fileset, options("CPU"));
    }
  }

  async function start() {
    if (state === "starting" || state === "ready") return;
    setState("starting");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
    } catch {
      setState("denied");
      return;
    }
    try {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      landmarker ??= await loadModel();
      if (state !== "starting") return; // Stopped meanwhile.
      setState("ready");
      frame = requestAnimationFrame(track);
    } catch (error) {
      console.warn("The camera steering could not start.", error);
      stop();
      setState("failed");
    }
  }

  function stop() {
    cancelAnimationFrame(frame);
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    if (video) video.srcObject = null;
    video = null;
    pose = null;
    target.turn = target.lift = 0;
    target.spread = false;
    if (state !== "denied" && state !== "failed") setState("off");
  }

  const visible = (landmark) => (landmark?.visibility ?? 1) > CAMERA.visible;

  function track() {
    frame = requestAnimationFrame(track);
    if (!video || video.readyState < 2) return;
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      read(result.landmarks?.[0]);
    }
    draw();
  }

  /** Arms to wings, in pixels of the camera image (not mirrored). */
  function read(landmarks) {
    const width = video.videoWidth;
    const height = video.videoHeight;
    const points = [L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST];
    if (!landmarks || !points.every((index) => visible(landmarks[index]))) {
      pose = null;
      return;
    }
    const at = (index) => ({
      x: landmarks[index].x * width,
      y: landmarks[index].y * height,
    });
    pose = {
      ls: at(L_SHOULDER),
      rs: at(R_SHOULDER),
      le: at(L_ELBOW),
      re: at(R_ELBOW),
      lw: at(L_WRIST),
      rw: at(R_WRIST),
    };
    seenAt = performance.now();
    const { ls, rs, lw, rw } = pose;
    const shoulders = Math.hypot(ls.x - rs.x, ls.y - rs.y) || 1;
    // The person's left appears on the right of an unmirrored image.
    const span = lw.x - rw.x;
    target.spread = span > CAMERA.spread * shoulders;
    if (!target.spread) {
      target.turn = 0;
      target.lift = 0;
      return;
    }
    // The right wing lower than the left banks and turns right.
    const roll = (Math.atan2(rw.y - lw.y, span) * 180) / Math.PI;
    target.turn =
      shape(roll, CAMERA.deadDegrees, CAMERA.rangeDegrees) * CAMERA.maxTurn;
    const lift = ((ls.y + rs.y) / 2 - (lw.y + rw.y) / 2) / shoulders;
    target.lift = shape(lift, CAMERA.deadLift, CAMERA.rangeLift);
  }

  /** A small grey mirror of the visitor with their wings drawn in ink. */
  function draw() {
    if (!context || !preview) return;
    const width = preview.width;
    const height = preview.height;
    context.save();
    context.clearRect(0, 0, width, height);
    context.translate(width, 0);
    context.scale(-1, 1);
    context.filter = "grayscale(1) contrast(1.05)";
    // Cover the canvas with the video, centred.
    const scale = Math.max(
      width / video.videoWidth,
      height / video.videoHeight,
    );
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    context.filter = "none";
    // A white veil, so the mirror belongs to the white world.
    context.fillStyle = "rgb(255 255 255 / 0.5)";
    context.fillRect(0, 0, width, height);
    if (pose) {
      const map = (point) => [
        offsetX + point.x * scale,
        offsetY + point.y * scale,
      ];
      context.strokeStyle = target.spread ? "#202126" : "rgb(32 33 38 / 0.4)";
      context.lineWidth = 3 * (width / 168);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      for (const [a, b, c] of [
        [pose.ls, pose.le, pose.lw],
        [pose.rs, pose.re, pose.rw],
      ]) {
        context.moveTo(...map(a));
        context.lineTo(...map(b));
        context.lineTo(...map(c));
      }
      context.moveTo(...map(pose.ls));
      context.lineTo(...map(pose.rs));
      context.stroke();
    }
    context.restore();
  }

  return {
    start,
    stop,
    /** Fetch the pose model in the background, without opening the camera. */
    preload() {
      loadModel().catch((error) =>
        console.warn("The pose model could not be loaded.", error),
      );
    },
    get state() {
      return state;
    },
    /** Whether a person is seen right now. */
    get tracking() {
      return (
        state === "ready" &&
        performance.now() - seenAt < CAMERA.lostSeconds * 1000
      );
    },
    /**
     * Which of the five positions the arms are in now: left, right, up,
     * down or straight; null while resting or unseen.
     */
    get pose() {
      if (!this.tracking || !target.spread) return null;
      const turn = target.turn / CAMERA.maxTurn;
      const lift = target.lift;
      if (Math.max(Math.abs(turn), Math.abs(lift)) < 0.2) return "straight";
      if (Math.abs(lift) > Math.abs(turn)) return lift > 0 ? "up" : "down";
      return turn > 0 ? "right" : "left";
    },
    /** Whether the arms are spread like wings (steering, not resting). */
    get spread() {
      return this.tracking && target.spread;
    },
    /** Smoothed turn (-1..1, right positive) and lift (climb positive). */
    read(deltaSeconds) {
      const ease = 1 - Math.exp(-Math.max(0, deltaSeconds) / CAMERA.tau);
      const turn = this.tracking ? target.turn : 0;
      const lift = this.tracking ? target.lift : 0;
      value.turn += (turn - value.turn) * ease;
      value.lift += (lift - value.lift) * ease;
      return value;
    },
  };
}
