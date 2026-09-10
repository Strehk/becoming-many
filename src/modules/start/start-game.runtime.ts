// Start Game — exercise flow
// Comment-only architecture; no executable implementation.

// 1. Responsibility

// The game owns the current lesson, its attempts and earned progress.
// Start Module connects its decisions to chunks, presentation and speech.
// Run owns application lifetime; World owns the loop; Control owns flight.

// 2. Exercise model

// One chunk represents one attempt at one exercise.
// The recordings establish the order: right -> left -> up -> down.
// Procedural variation changes spatial layout, while lesson meaning stays fixed.

// The introduction accompanies the first right exercise.
// The closing recording follows four successes and contains no additional exercise.

// 3. State and interfaces

// Owned state: lesson index, attempt revision, phase, accepted passage identity
// and the speech request bound to the current playback instance.
// Chunk geometry and resource-slot revisions belong to the chunk component.

// Inputs: exercise definitions, seed, actual rig movement, flight constraints,
// shared playback state, native speech observations and chunk readiness.
// Outputs: chunk requests, speech requests and a read-only exercise observation.

// 4. Exercise lifecycle

// preparing -> instruction -> exercising -> retiring
// Success advances to the next lesson; a miss starts another attempt at this lesson.
// The fourth success leads to closing -> complete.
// Pause holds progression within the current phase.

// createStartGame(options)
// Establishes the exercise state and its narrow input/output contracts.

// updateExercise(frame)
// Consumes one coherent movement/audio sample and makes at most one lesson
// transition per World frame. Unavailable playback facts hold progression.

// beginExercise(request)
// Binds a reachable chunk and recording to a new attempt identity.
// Prepared resources precede playback; final placement follows actual flight.

// releaseInstruction(observation)
// Releases guidance when native playback crosses the instruction marker.
// Paused, blocked or stale playback cannot release the current attempt.

// 5. Passage and progression

// acceptExercisePassage(result)
// Accepts the active goal's swept rig passage after instruction release, once.
// Head movement, previews and reset displacement carry no success.

// finishExercise(observation)
// Advances after both the earned passage and natural instruction completion.
// Praise at the beginning of the next clip therefore refers to actual success.

// retryExercise(reason)
// Retires the missed chunk and retains its lesson for a new attempt.
// The repeated excerpt contains the instruction without preceding praise.

// finishCourse(observation)
// Plays the closing once after four successes and publishes completion after
// its natural end. Main-Show transition policy remains outside the game.

// 6. Observation and cleanup

// readExercise()
// Publishes borrowed, read-only facts valid for the current frame.

// resetExercise(seed)
// Invalidates attempt identities, pending speech and movement history through
// Run's reset path. The new attempt cannot inherit an old passage.

// unload()
// Ends publication and invalidates pending game decisions before local release.
