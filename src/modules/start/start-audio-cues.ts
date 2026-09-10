// Start Audio Cues — recordings and exercise meaning
// Comment-only architecture; no executable implementation.

// 1. Responsibility

// Cue definitions bind exercises to recordings and semantic playback markers.
// They contain immutable authored facts, separate from live playback state.
// Show owns speech policy; Sound owns playback and native media observations.

// 2. Cue structure

// ExerciseAudioCue: lesson ID, recording URL, measured duration, instruction marker,
// optional environment marker and instruction-only retry excerpt.
// Marker times are local to the recording, not global Show time or exercise deadlines.

// The markers below are provisional authored values. Transcript alignment is
// approximate; amplitude-based silence detection does not establish word boundaries.
// Healthy natural completion and playback failure are distinct interface facts.

// 3. Exercise recordings

// Right — de/introduction-right.wav
// Duration: 20.725729 s. Instruction marker: 19.30 s. Room marker: 13.12 s.
// Orientation precedes the first exercise; the explicit rightward lean releases it.
// Transcript instruction interval: approximately 19.24-20.14 s.

// Left — de/left.wav
// Duration: 2.735417 s. Instruction marker: 1.14 s.
// Initial praise acknowledges rightward success; the instruction changes sides.
// Transcript sentence interval: approximately 0.00-2.22 s.

// Up — de/up.wav
// Duration: 4.334896 s. Instruction marker: 2.66 s.
// Praise and a question precede the backward lean instruction.
// Backward body tilt means climbing forward. Instruction interval: 2.48-4.00 s.

// Down — de/down.wav
// Duration: 2.552583 s. Instruction marker: 1.04 s.
// Praise acknowledges the climb; forward body tilt means descending forward.
// Transcript sentence interval: approximately 0.00-1.84 s.

// Closing — de/complete.wav
// Duration: 13.861479 s. No exercise instruction marker.
// Four earned successes release this recording. Its direction recap creates no goals.
// The narrator/wait passage at approximately 8.18-13.74 s belongs to the full closing.

// 4. Cue queries and playback synchronization

// readExerciseCue(lesson)
// Returns the recording and semantic markers for right, left, up or down.

// readRetryExcerpt(lesson)
// Returns the instruction-only range, excluding orientation and preceding praise.
// Playback uses the original recording with clip-relative excerpt boundaries.

// readPassedCue(playback)
// Reports one marker crossing for the current attempt and playback instance.
// Observed native offset determines release; shared playback state governs pause.
// A seek or reset invalidates crossing history without awarding success.

// validateExerciseCues(definitions)
// Checks recording presence, marker ranges and the fixed semantic lesson order.
// Missing or failed playback leaves the exercise unreleased.

// 5. Supporting effects

// effects/wind-soft-loop.wav — 12.000000 s.
// Ambient loop beneath speech, independent of exercise success.

// effects/whoosh-soft.wav — 0.252083 s.
// Short earned-passage response, independent of narration cue progression.

// Effects occupy bounded playback resources and create no exercise chunks.

// 6. Source and timing reference

// Text and approximate alignment: docs/direction/start-audio-transcript.md.
// Scene interpretation: docs/direction/tutorial-scene-script.md.
// File identities: public/audio/tutorial/provenance.json and effects/provenance.json.
// The scene script describes earlier staging, not the current runtime.

// Speech files are 48 kHz stereo float32 PCM; effects are 48 kHz mono PCM16.
// The five speech durations total 44.210104 s, excluding interaction and retries.
// The files contain German speech; language selection does not translate recordings.
