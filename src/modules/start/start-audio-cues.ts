// 1. Verified recording inventory
// Executable cue settings belong to each exercise in start-exercises.ts.
// Current WAV hashes match docs/direction/start-audio-transcript.md and the
// original word-alignment output. DE and EN files are byte-identical German speech.
// Files: 48 kHz stereo float32 PCM. Durations are measured from shipped bytes.

// 2. Recording-local instruction offsets
// introduction-right.wav: 20.725729 s; right instruction at 19.30 s.
// left.wav:                2.735417 s; left instruction at 1.14 s.
// up.wav:                  4.334896 s; backward lean / climb at 2.66 s.
// down.wav:                2.552583 s; forward lean / descent at 1.04 s.
// complete.wav:           13.861479 s; no new directional instruction.
// Offsets are approximate word-alignment markers, not sample-exact boundaries.
// Independent silence analysis supports their location, not exact word timing.

// 3. Semantic playback contract
// Native media offset releases the associated course. Frame time cannot replace
// playback progress. Failure is distinct from natural end and releases nothing.
// Praise belongs to the preceding earned success. Retries start at the current
// instruction offset, omitting praise and the long orientation introduction.
// Closing follows four earned successes; its direction recap creates no lessons.
// The optional room cue at 13.12 s is not used for another visual effect.
