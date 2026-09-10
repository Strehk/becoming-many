import type { AudioListener, Vector3 } from "three";
import type { Context } from "tone";

export interface StartAudioSettings {
  readonly sectionCapacity: number;
  readonly ringCapacity: number;
  readonly pulseDb: number;
  readonly clickingDb: number;
  readonly baseDb: number;
  readonly padDb: number;
  readonly padSpeakingDb: number;
  readonly fadeSeconds: number;
  readonly clickingSources: number;
  readonly minimumDetuneCents: number;
  readonly clickGrainSeconds: number;
  readonly clickOverlapSeconds: number;
  readonly baseHeads: number;
  readonly baseGrainSeconds: number;
  readonly baseOverlapSeconds: number;
  readonly ringRefDistance: number;
  readonly baseRefDistance: number;
  readonly rolloff: number;
  readonly reverbWet: number;
  readonly limiterDb: number;
  readonly reverbSeconds: number;
  readonly audiblePresence: number;
  readonly assetRoot: string;
}

export interface AudioRing {
  readonly index: number;
  readonly center: Vector3;
  readonly direction: Vector3;
  readonly radiusMeters: number;
}

export interface AudioSection {
  readonly center: Vector3;
  readonly rings: readonly AudioRing[];
}

export interface AudioSectionFrame {
  readonly presence: readonly number[] | Float32Array;
  readonly pulses: readonly number[];
}

export interface StartAudioOptions {
  readonly context: Context;
  readonly listener: AudioListener;
  readonly settings: StartAudioSettings;
  readonly signal?: AbortSignal;
}

export interface StartAudio {
  configureSection(slot: number, section: AudioSection): void;
  updateSection(slot: number, frame: AudioSectionFrame): void;
  clearSection(slot: number): void;
  update(frame: { active: boolean; speaking: boolean }): void;
  unload(): void;
}
