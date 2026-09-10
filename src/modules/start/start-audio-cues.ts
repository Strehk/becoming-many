/**
 * Planning scaffold only. No cue table, player, configuration or timers implemented.
 *
 * Purpose: Specify exercise-to-recording bindings and provisional spoken cue points.
 * Sources: docs/direction/start-audio-transcript.md and tutorial-scene-script.md;
 * original bytes and hashes: public/audio/tutorial/provenance.json and effects/.
 * The old scene script describes removed behavior, not currently running features.
 *
 * LOCAL AUDIO ANALYSIS
 * All seven WAVs fully decoded and matched their provenance SHA-256 hashes.
 * Speech: 48 kHz stereo float32 PCM. Effects: 48 kHz mono PCM16.
 * File durations below were measured with ffprobe. The five spoken clips total
 * 44.210104 seconds; interaction, loading and retries are additional, not deadlines.
 * FFmpeg volumedetect reports sample peak/mean, not perceived loudness or true peak.
 * Speech peak/mean dBFS by file:
 *   introduction-right: -3.2 / -23.0; left: -5.8 / -23.7;
 *   up: -4.3 / -24.1; down: -3.2 / -21.2; complete: -3.2 / -22.5.
 * Existing text uses local MLX Whisper word alignment, not human-approved timing.
 * This pass checked decoding, hashes, levels and silence; no new listening or
 * phoneme alignment is claimed. All times are local native-media seconds.
 *
 * PROVISIONAL CUE MAP: FILE -> ROLE -> MARKER -> NATURAL FILE END
 * de/introduction-right.wav -> right exercise -> 19.30 -> 20.725729.
 *   Opening orientation has no success test. Optional room reveal: 13.12.
 *   Transcript: room phrase within 9.56-15.46; explicit right call 19.24-20.14.
 *   The phrase about testing the room at 16.28-18.46 is not the movement cue.
 * de/left.wav -> left exercise -> 1.14 -> 2.735417.
 *   Initial praise refers to the preceding right success; then change sides.
 *   Transcript places the combined sentence within 0.00-2.22.
 * de/up.wav -> climb exercise -> 2.66 -> 4.334896.
 *   Praise/question at 0.00-2.10 precedes the backward lean instruction, 2.48-4.00.
 *   Backward body tilt means upward forward flight, not flying backward.
 * de/down.wav -> descend exercise -> 1.04 -> 2.552583.
 *   Praise refers to upward success; forward body tilt means descent.
 *   Transcript places the combined sentence within 0.00-1.84.
 * de/complete.wav -> earned closing, no exercise marker -> natural end 13.861479.
 *   Direction recap at approximately 1.32-3.24 creates no further exercise chunks.
 *   The narrator/wait passage at approximately 8.18-13.74 must finish naturally.
 *
 * ALIGNMENT CAVEAT
 * Markers above are the prior authored values, retained as candidates only.
 * With silencedetect threshold -35 dB and minimum silence 0.12 seconds, the final
 * instruction-adjacent silence ends at 19.351729 (right), 1.204229 (left),
 * 2.668958 (up) and 1.183125 (down). These are amplitude threshold crossings,
 * not reliable word starts: quiet consonants/breaths can lie below the threshold.
 * Do not silently substitute these for semantic cue points. Listening/alignment
 * approval remains required, especially for down's approximately 0.14-second gap.
 *
 * EFFECTS ARE NOT LESSONS
 * effects/wind-soft-loop.wav: 12.000000 seconds, peak -10.5 / mean -27.3 dBFS.
 *   Optional ambience; one bounded loop, subordinate to speech, no success signal.
 * effects/whoosh-soft.wav: 0.252083 seconds, peak -12.8 / mean -27.6 dBFS.
 *   Optional earned-passage response; never triggered by a miss or an elapsed marker.
 * Neither effect creates an exercise chunk. Selection/mixing is not implemented.
 *
 * PLANNED DEFINITIONS AND QUERIES
 * ExerciseAudioCue: lesson ID, file URL, measured duration, provisional instruction
 *   marker and optional room marker; immutable authored facts, not playback state.
 * readExerciseCue(lesson): return the fixed semantic binding for right/left/up/down.
 * readRetryExcerpt(lesson): select only the instruction portion, excluding preceding
 *   praise; preserve original files and validate the excerpt boundaries by listening.
 * readPassedCue(playback): recognize one marker crossing per playback instance;
 *   use observed native offset with shared playback state, never a timeout.
 *   Bind observations to attempt/clip revision; pause/stall cannot release a cue.
 *   Seek/reset invalidates old crossings; do not replay success events on a seek.
 * validateExerciseCues(definitions): require in-range markers and approved ordering;
 *   reject missing clips rather than silently progressing without the instruction.
 *
 * PLAYBACK CONTRACT TO RESOLVE BEFORE IMPLEMENTATION
 * Reuse Sound's narration player and Show's speech authority through injected facts.
 * Its current readHasEnded includes terminal failure: true alone cannot prove that
 * a spoken instruction or closing finished successfully. Expose healthy natural end
 * distinctly before wiring progression; do not equate failure with success.
 * No independently ticking Start clock or second narration player is proposed.
 * German recordings are available; an English translation is not implied by a label.
 */
