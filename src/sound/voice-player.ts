import type { VoicePlayback } from "./playback";

// 1. One media resource; no timeline, polling loop, or lesson knowledge.
interface VoiceOptions {
  readonly gestures: EventTarget;
  readonly createAudio?: () => HTMLAudioElement;
}

/** Autoplay denial retries on a real gesture; stop/unload invalidate pending starts. */
export function createVoicePlayer(options: VoiceOptions): VoicePlayback {
  return new VoicePlayer(options);
}

class VoicePlayer implements VoicePlayback {
  private readonly audio: HTMLAudioElement;
  private readonly observation = {
    offsetSeconds: 0,
    ended: false,
    failed: false,
  };
  private revision = 0;
  private pending = false;
  private requested = false;
  private started = false;
  private blocked = false;
  private unloaded = false;
  private paused = false;
  private seekSeconds: number | undefined;

  constructor(private readonly options: VoiceOptions) {
    this.audio = options.createAudio?.() ?? new Audio();
    this.audio.preload = "auto";
    this.audio.addEventListener("loadedmetadata", this.seek);
    options.gestures.addEventListener("pointerdown", this.retryBlocked);
    options.gestures.addEventListener("keydown", this.retryBlocked);
  }

  // 2. Commands select a clip, while native playback supplies all timing.
  readonly play = (
    recording: { readonly url: string },
    offsetSeconds: number,
  ): void => {
    if (this.unloaded) return;
    if (!Number.isFinite(offsetSeconds) || offsetSeconds < 0)
      throw new RangeError("Voice offset must be finite and nonnegative");
    this.stop();
    this.requested = true;
    this.seekSeconds = offsetSeconds;
    if (this.audio.getAttribute("src") !== recording.url) {
      this.audio.src = recording.url;
      this.audio.load();
    }
    this.seek();
    this.start();
  };

  private readonly seek = (): void => {
    if (this.seekSeconds === undefined || this.audio.readyState < 1) return;
    this.audio.currentTime = this.seekSeconds;
    this.seekSeconds = undefined;
  };

  private start(): void {
    if (!this.requested || this.pending || this.unloaded || this.paused) return;
    const revision = this.revision;
    this.pending = true;
    this.blocked = false;
    this.observation.failed = false;
    void this.audio.play().then(
      () => {
        if (revision !== this.revision) return;
        this.pending = false;
        this.started = true;
      },
      (error: unknown) => {
        if (revision !== this.revision) return;
        this.pending = false;
        this.blocked =
          error instanceof DOMException && error.name === "NotAllowedError";
        this.observation.failed = true;
      },
    );
  }

  private readonly retryBlocked = (): void => {
    if (this.blocked) this.start();
  };

  /** Invalidate pending promises without discarding the selected clip or offset. */
  readonly setPaused = (paused: boolean): void => {
    if (this.unloaded) return;
    if (this.paused === paused) {
      if (!paused && this.blocked) this.start();
      return;
    }
    this.paused = paused;
    if (!paused) {
      if (!this.audio.ended) this.start();
      return;
    }
    this.revision++;
    this.pending = false;
    this.audio.pause();
  };

  readonly readStatus: VoicePlayback["readStatus"] = () => {
    if (this.unloaded) return "ended";
    if (this.paused) return "paused";
    if (this.blocked) return "blocked";
    if (this.read().failed) return "error";
    if (!this.requested || this.audio.ended) return "ended";
    return this.pending || !this.started || this.audio.readyState < 3
      ? "loading"
      : "playing";
  };

  readonly read = () => {
    const usable =
      this.requested && this.started && this.seekSeconds === undefined;
    this.observation.failed ||= !!this.audio.error;
    this.observation.offsetSeconds =
      usable && !this.observation.failed ? this.audio.currentTime : 0;
    this.observation.ended =
      usable && !this.observation.failed && this.audio.ended;
    return this.observation;
  };

  /** Fade the native source without seeking, pausing or changing its timing. */
  readonly setPresence = (presence: number): void => {
    if (this.unloaded) return;
    this.audio.volume = Number.isFinite(presence)
      ? Math.max(0, Math.min(1, presence))
      : 0;
  };

  // 3. Complete, idempotent cancellation includes listeners and native loading.
  readonly stop = (): void => {
    this.revision++;
    this.requested = this.pending = this.started = this.blocked = false;
    this.seekSeconds = undefined;
    this.observation.offsetSeconds = 0;
    this.observation.ended = this.observation.failed = false;
    this.audio.pause();
  };

  readonly unload = (): void => {
    if (this.unloaded) return;
    this.stop();
    this.unloaded = true;
    this.audio.removeEventListener("loadedmetadata", this.seek);
    this.options.gestures.removeEventListener("pointerdown", this.retryBlocked);
    this.options.gestures.removeEventListener("keydown", this.retryBlocked);
    this.audio.removeAttribute("src");
    this.audio.load();
  };
}
