/**
 * Planning scaffold only. No implementation, imports, or runtime registration.
 *
 * Purpose: Define the local game engine for procedural Start exercises.
 * Responsibility: Own the exercise sequence and the current attempt exactly once.
 * Boundary: Run owns application lifetime; World owns rendering and its only loop;
 * Control owns flight; Show owns speech/time policy; Sound owns media resources.
 * This engine observes actual flight and injected speech facts, never raw tilt,
 * camera gaze, an independent clock, or another engine's implementation.
 *
 * PROCEDURAL MODEL
 * Each generated exercise chunk is one attempt at one movement lesson.
 * Audio fixes the lesson order: right -> left -> up -> down.
 * Geometry varies within reachable bounds; lesson meaning/order does not shuffle.
 * The introduction belongs to the first right chunk, not a separate gesture test.
 * Completion is a closing phase after four successes, not a fifth exercise chunk.
 * Ambient Air Particles keep their existing independent volume recycling.
 *
 * INPUTS AND OUTPUTS
 * Inputs: authored exercise definitions, seed, current rig movement/constraints,
 * shared playing-time sample, prepared chunk facts, observed narration playback.
 * Outputs: one current exercise observation, chunk preparation/retirement intent,
 * speech requests to the existing playback owner, and earned completion.
 * Future neutral contracts must be introduced at the actual owner/consumer edge;
 * no broad Run/Show handles, peer imports, event bus, or duplicate progress stores.
 *
 * NECESSARY STATE
 * Current lesson index, attempt revision, lifecycle phase, accepted passage ID,
 * pending speech intent and the current native playback-instance identity.
 * Proposed phases: preparing, instruction, exercising, retiring, closing, complete.
 * Pause is supplied by the playback owner, not an additional exercise phase.
 * Chunk storage owns resource-slot revisions; it does not own learning progress.
 *
 * PLANNED FUNCTIONS
 * createStartGame(options): establish the sole exercise state from injected facts.
 * updateExercise(frame): process one coherent flight/audio sample per World frame;
 *   apply at most one lesson transition and publish bounded presentation intent.
 * beginExercise(request): prepare a reachable chunk before requesting its clip;
 *   bind the clip instance to this attempt so stale observations cannot release it.
 * releaseInstruction(observation): reveal guidance only after the selected spoken
 *   marker has actually played; loading, blocked audio and pause cannot release it.
 * acceptExercisePassage(result): require the active chunk's earned passage after
 *   instruction release; ignore previews, duplicates, resets and head-only motion.
 * finishExercise(observation): require both earned passage and naturally finished
 *   instruction before the next praise-bearing clip; never interrupt current speech.
 * retryExercise(reason): retire missed geometry, retain the same lesson and request
 *   its instruction-only excerpt; never replay praise or the whole introduction.
 * finishCourse(observation): request the complete clip once after four successes;
 *   publish completion after natural speech end, without starting the main Show here.
 * readExercise(): expose borrowed read-only progress/presentation facts for this frame.
 * resetExercise(seed): invalidate attempt/audio identities and motion history through
 *   Run's existing reset path; do not treat a rig teleport as a passage.
 * unload(): stop publication and invalidate pending local work before owned release.
 *
 * DECISIONS BEFORE IMPLEMENTATION
 * Exact success geometry/thresholds, retry excerpt endings, chunk dimensions and
 * resource budgets need explicit authored values. The removed 60-second timeout,
 * automatic main-Show handoff and old arrow/ring behavior are not reinstated here.
 * With no trustworthy playback observation, wait/report failure; do not infer
 * spoken instructions or earned completion from elapsed wall time.
 */
