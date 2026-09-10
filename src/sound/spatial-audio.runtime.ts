import {
  AudioListener,
  type Camera,
  Matrix4,
  Quaternion,
  AudioContext as ThreeAudioContext,
  Vector3,
} from "three";
import { holdAudioParameter } from "./audio-parameter";
import type { SpatialAudio } from "./spatial-audio";

// Retain the organ's measured listener-write budget; stationary poses write nothing.
const LISTENER_WRITE_INTERVAL_FRAMES = 3;
const LISTENER_RAMP_SECONDS = 1 / 30;
const RESUME_GESTURES = ["pointerdown", "keydown"] as const;

/** Lazily acquire the existing Tone context for one complete, exclusive Run. */
export async function createSpatialAudio(
  camera: Camera,
  signal: AbortSignal,
): Promise<SpatialAudio> {
  const { Context, getContext, setContext } = await import("tone");
  const previousContext = getContext();
  if (!(previousContext instanceof Context))
    throw new Error("Spatial audio needs a live Tone context");
  // Only replace a context after the preceding Run completed native close.
  const context =
    previousContext.state === "closed" ? new Context() : previousContext;
  if (context !== previousContext) setContext(context);
  let ownedListener: AudioListener | undefined;
  let unloading: Promise<void> | undefined;

  function resume(): void {
    if (unloading || context.state === "running") return;
    void context.resume().catch(() => undefined);
  }

  function unload(): Promise<void> {
    unloading ??= (async () => {
      for (const gesture of RESUME_GESTURES)
        window.removeEventListener(gesture, resume);
      const errors: unknown[] = [];
      for (const release of [
        () => ownedListener?.gain.disconnect(),
        () => context.close(),
        () => context.dispose(),
      ]) {
        try {
          await release();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(errors, "Spatial audio cleanup failed");
    })();
    return unloading;
  }

  try {
    signal.throwIfAborted();
    // Tone's standardized-audio-context implements the Web Audio subset Three
    // uses. Both libraries create connected nodes on this same native context.
    ThreeAudioContext.setContext(context.rawContext as AudioContext);
    const listener = new AudioListener();
    ownedListener = listener;
    listener.matrixAutoUpdate = false;
    const pose = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const forward = new Vector3();
    const up = new Vector3();
    const nativeListener = context.rawContext.listener;
    const listenerParameters = [
      nativeListener.positionX,
      nativeListener.positionY,
      nativeListener.positionZ,
      nativeListener.forwardX,
      nativeListener.forwardY,
      nativeListener.forwardZ,
      nativeListener.upX,
      nativeListener.upY,
      nativeListener.upZ,
    ];
    let hasPlacedListener = false;
    let framesSincePlacing = LISTENER_WRITE_INTERVAL_FRAMES;
    for (const gesture of RESUME_GESTURES)
      window.addEventListener(gesture, resume);

    return {
      context,
      update(): void {
        if (unloading || context.state !== "running") return;
        framesSincePlacing += 1;
        if (framesSincePlacing < LISTENER_WRITE_INTERVAL_FRAMES) return;
        camera.updateWorldMatrix(true, false);
        if (hasPlacedListener && pose.equals(camera.matrixWorld)) return;
        hasPlacedListener = true;
        framesSincePlacing = 0;
        pose.copy(camera.matrixWorld);
        pose.decompose(position, rotation, scale);
        forward.set(0, 0, -1).applyQuaternion(rotation);
        up.set(0, 1, 0).applyQuaternion(rotation);
        // Three's listener Timer measures time since the last matrix update.
        // With stationary-write suppression that would ramp the first movement
        // over the entire idle interval. Bound the native pose ramp explicitly.
        const now = context.immediate();
        for (const parameter of listenerParameters)
          holdAudioParameter(parameter, now);
        const endSeconds = now + LISTENER_RAMP_SECONDS;
        nativeListener.positionX.linearRampToValueAtTime(
          position.x,
          endSeconds,
        );
        nativeListener.positionY.linearRampToValueAtTime(
          position.y,
          endSeconds,
        );
        nativeListener.positionZ.linearRampToValueAtTime(
          position.z,
          endSeconds,
        );
        nativeListener.forwardX.linearRampToValueAtTime(forward.x, endSeconds);
        nativeListener.forwardY.linearRampToValueAtTime(forward.y, endSeconds);
        nativeListener.forwardZ.linearRampToValueAtTime(forward.z, endSeconds);
        nativeListener.upX.linearRampToValueAtTime(up.x, endSeconds);
        nativeListener.upY.linearRampToValueAtTime(up.y, endSeconds);
        nativeListener.upZ.linearRampToValueAtTime(up.z, endSeconds);
      },
      unload,
    };
  } catch (error) {
    try {
      await unload();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Spatial audio startup failed",
      );
    }
    throw error;
  }
}
