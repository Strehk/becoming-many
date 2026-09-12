import {
  ENGLISH_START_OPENING,
  ENGLISH_START_VOICES,
} from "./start-audio-cues";
import type {
  ExerciseDefinition,
  ExerciseVoiceCue,
  StartSequence,
} from "./start-contract";
import {
  START_EXERCISES,
  START_SETTINGS,
  START_TIMING,
} from "./start-exercises";

type Language = "en" | "de";
export type StartCue = ExerciseDefinition["id"] | "complete";

/** Preserve the initial course's cue seconds while translating native spoken markers. */
export function createStartRecording(
  cue: StartCue,
  initial: Language,
  language: Language,
): ExerciseVoiceCue {
  const recording = readCue(cue, language);
  if (initial === language) return recording;
  const offsets = readMarkers(cue, initial);
  const native = readMarkers(cue, language);
  return {
    ...recording,
    timeMap: offsets.map((offsetSeconds, index) => ({
      offsetSeconds,
      nativeSeconds: native[index] ?? recording.durationSeconds,
    })),
  };
}

function readCue(cue: StartCue, language: Language): ExerciseVoiceCue {
  if (language === "en") return ENGLISH_START_VOICES[cue];
  if (cue === "complete") return START_SETTINGS.completeVoice;
  const exercise = START_EXERCISES.find((exercise) => exercise.id === cue);
  if (!exercise) throw new Error("Unknown Start recording");
  return exercise.voice;
}

function readMarkers(cue: StartCue, language: Language): readonly number[] {
  const recording = readCue(cue, language);
  if (cue === "complete") {
    const pathEnd = START_TIMING.closingPathFadeSeconds;
    const worldEnd = pathEnd + START_TIMING.closingWorldFadeSeconds;
    return [
      pathEnd,
      worldEnd,
      worldEnd + START_TIMING.closingWhiteHoldSeconds,
      recording.durationSeconds,
    ];
  }
  if (cue !== "right")
    return [recording.instructionAtSeconds, recording.durationSeconds];
  const opening: StartSequence =
    language === "en" ? ENGLISH_START_OPENING : START_EXERCISES[0].sequence;
  return [
    opening.pathAtSeconds ?? 0,
    (opening.pathAtSeconds ?? 0) + (opening.pathFadeSeconds ?? 0),
    opening.worldReveal?.atSeconds ?? 0,
    (opening.worldReveal?.atSeconds ?? 0) +
      (opening.worldReveal?.fadeSeconds ?? 0),
    recording.instructionAtSeconds,
    recording.durationSeconds,
  ];
}
