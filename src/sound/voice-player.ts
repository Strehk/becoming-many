import type { VoicePlayback, VoiceRecording } from "./playback";

const REPLACEMENT_SEEK_TOLERANCE_SECONDS = 0.05;

// 1. One active source and at most one silent prepared replacement; no timeline, polling loop, or lesson knowledge.
interface VoiceOptions {
  readonly gestures: EventTarget;
  readonly createAudio?: () => HTMLAudioElement;
}

/** Autoplay denial retries on a real gesture; stop/unload invalidate pending starts. */
export function createVoicePlayer(options: VoiceOptions): VoicePlayback {
  return new VoicePlayer(options);
}

class VoicePlayer implements VoicePlayback {
  private audio: HTMLAudioElement;
  private recording: VoiceRecording | undefined;
  private replacement:
    | {
        audio: HTMLAudioElement;
        recording: VoiceRecording;
        seekStage: "unprepared" | "prepared" | "synchronized";
        pending: boolean;
        started: boolean;
        blocked: boolean;
        revision: number;
        cleanup: () => void;
      }
    | undefined;
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
  readonly play = (recording: VoiceRecording, offsetSeconds: number): void => {
    if (this.unloaded) return;
    if (!Number.isFinite(offsetSeconds) || offsetSeconds < 0)
      throw new RangeError("Voice offset must be finite and nonnegative");
    this.stop();
    this.recording = recording;
    this.requested = true;
    this.seekSeconds = mapVoiceOffset(
      recording,
      offsetSeconds,
      "offsetSeconds",
    );
    if (this.audio.getAttribute("src") !== recording.url) {
      this.audio.src = recording.url;
      this.audio.load();
    }
    this.seek();
    this.start();
  };

  /** Keep audible speech until its replacement has metadata, a settled seek and playback. */
  readonly replace: VoicePlayback["replace"] = (recording) => {
    if (this.unloaded || !this.requested) return;
    if (recording.url === this.replacement?.recording.url) return;
    this.cancelReplacement();
    if (recording.url === this.recording?.url || this.audio.ended) return;
    const audio = this.options.createAudio?.() ?? new Audio();
    const ready = () => this.prepareReplacement();
    const failed = () => this.cancelReplacement();
    const events = ["loadedmetadata", "canplay", "seeked"] as const;
    for (const event of events) audio.addEventListener(event, ready);
    audio.addEventListener("error", failed);
    this.replacement = {
      audio,
      recording,
      seekStage: "unprepared",
      pending: false,
      started: false,
      blocked: false,
      revision: 0,
      cleanup: () => {
        for (const event of events) audio.removeEventListener(event, ready);
        audio.removeEventListener("error", failed);
      },
    };
    audio.preload = "auto";
    audio.volume = 0;
    audio.src = recording.url;
    audio.load();
    this.prepareReplacement();
  };

  private prepareReplacement(): void {
    const replacement = this.replacement;
    if (!replacement || replacement.pending || replacement.blocked) return;
    if (this.audio.ended) {
      this.cancelReplacement();
      return;
    }
    const { audio } = replacement;
    if (audio.readyState < 1 || audio.seeking) return;
    if (replacement.seekStage === "unprepared") {
      replacement.seekStage = "prepared";
      if (!this.seekReplacement()) return;
    }
    if (audio.readyState < 3) return;
    if (!this.paused && !replacement.started) {
      this.startReplacement();
      return;
    }
    if (replacement.seekStage === "prepared") {
      replacement.seekStage = "synchronized";
      if (!this.seekReplacement()) return;
    }
    this.commitReplacement();
  }

  /** Seek once before playback and once after startup; slow media never chases a moving target. */
  private seekReplacement(): boolean {
    const replacement = this.replacement;
    if (!replacement) return false;
    const offset = mapVoiceOffset(
      this.recording,
      this.seekSeconds ?? this.audio.currentTime,
      "nativeSeconds",
    );
    const nativeSeconds = mapVoiceOffset(
      replacement.recording,
      offset,
      "offsetSeconds",
    );
    if (
      Math.abs(replacement.audio.currentTime - nativeSeconds) >
      REPLACEMENT_SEEK_TOLERANCE_SECONDS
    )
      replacement.audio.currentTime = nativeSeconds;
    return !replacement.audio.seeking;
  }

  private startReplacement(): void {
    const replacement = this.replacement;
    if (!replacement) return;
    const revision = replacement.revision;
    replacement.pending = true;
    void replacement.audio.play().then(
      () => {
        if (
          this.replacement !== replacement ||
          replacement.revision !== revision
        )
          return;
        replacement.pending = false;
        replacement.started = true;
        this.prepareReplacement();
      },
      (error: unknown) => {
        if (
          this.replacement !== replacement ||
          replacement.revision !== revision
        )
          return;
        replacement.pending = false;
        replacement.blocked =
          error instanceof DOMException && error.name === "NotAllowedError";
        if (!replacement.blocked) this.cancelReplacement();
      },
    );
  }

  private commitReplacement(): void {
    const replacement = this.replacement;
    if (!replacement) return;
    this.replacement = undefined;
    replacement.cleanup();
    const volume = this.audio.volume;
    this.audio.removeEventListener("loadedmetadata", this.seek);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio = replacement.audio;
    this.recording = replacement.recording;
    this.audio.volume = volume;
    this.audio.addEventListener("loadedmetadata", this.seek);
    this.revision++;
    this.pending = this.blocked = this.observation.failed = false;
    this.started = true;
    this.seekSeconds = undefined;
  }

  private cancelReplacement(): void {
    const replacement = this.replacement;
    if (!replacement) return;
    this.replacement = undefined;
    replacement.cleanup();
    replacement.audio.pause();
    replacement.audio.removeAttribute("src");
    replacement.audio.load();
  }

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
    if (this.replacement?.blocked) {
      this.replacement.blocked = false;
      this.prepareReplacement();
    }
  };

  /** Invalidate pending promises without discarding the selected clip or offset. */
  readonly setPaused = (paused: boolean): void => {
    if (this.unloaded) return;
    if (this.paused === paused) {
      if (!paused && this.blocked) this.start();
      return;
    }
    this.paused = paused;
    const replacement = this.replacement;
    if (replacement) {
      replacement.revision++;
      replacement.pending = replacement.started = false;
      replacement.seekStage = "unprepared";
      replacement.audio.pause();
      this.prepareReplacement();
    }
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
      usable && !this.observation.failed
        ? Math.max(
            this.observation.offsetSeconds,
            mapVoiceOffset(
              this.recording,
              this.audio.currentTime,
              "nativeSeconds",
            ),
          )
        : 0;
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
    this.cancelReplacement();
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

/** Piecewise linear spoken-marker alignment; callers own marker semantics. */
function mapVoiceOffset(
  recording: VoiceRecording | undefined,
  seconds: number,
  from: "offsetSeconds" | "nativeSeconds",
): number {
  const markers = recording?.timeMap;
  if (!markers?.length) return seconds;
  const to = from === "offsetSeconds" ? "nativeSeconds" : "offsetSeconds";
  let previousSource = 0;
  let previousTarget = 0;
  for (const marker of markers) {
    if (seconds <= marker[from]) {
      const span = marker[from] - previousSource;
      return (
        previousTarget +
        (span > 0 ? (seconds - previousSource) / span : 0) *
          (marker[to] - previousTarget)
      );
    }
    previousSource = marker[from];
    previousTarget = marker[to];
  }
  return previousTarget + seconds - previousSource;
}
