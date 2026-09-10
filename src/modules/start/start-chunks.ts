// Start Chunks — procedural exercise space
// Comment-only architecture; no executable implementation.

// 1. Responsibility

// The chunk component owns spatial generation, stable geometry and pool assignments.
// The game owns learning progress; presentation owns graphics resources.
// An exercise chunk is a flight-path section, independent of Air's volume grid.

// 2. Chunk structure

// Identity: lesson ID, attempt revision, deterministic seed and pool revision.
// Geometry: entry/exit poses, bounds, route samples and a counted goal shape.
// Binding: exercise cue ID and references to assigned presentation slots.
// Readiness: preparation status for this exact assignment revision.

// Placement, visible guidance and passage detection share the same geometry.
// Published poses remain fixed in world space throughout their visible lifetime.

// 3. Placement and continuity

// Placement follows worldFlightPosition and worldFlightDirection, constrained by
// actual flight limits, height clearance and instruction lead time.
// Gaze affects discovery, while rig movement determines the reachable path.

// Reusable resources are prepared before narration. Final placement uses flight
// near instruction release, so the long introduction does not leave a goal behind.
// At 2 m/s, its 19.30-second marker represents 38.60 metres of travelled path.

// planExerciseChunk(request)
// Describes a reachable section from the current flight pose and lesson direction.
// A bounded placement attempt returns not-ready when constraints cannot be met.

// connectExerciseChunk(connection)
// Aligns a new entry with the preceding exit and tangent where reachable.
// An unreachable connection is replaced while unseen; visible chunks stay fixed.

// 4. Generation and preparation

// Current, prepared and retiring chunks occupy a fixed-capacity pool.
// Lookahead prepares upcoming space without activating the next lesson.
// Authored dimensions and capacities bound generation work and memory.

// generateExerciseChunk(plan)
// Fills reusable route and goal buffers deterministically from the chunk seed.

// prepareChunk(job)
// Performs one bounded generation step through World's shared StreamQueue.
// Publication requires matching attempt and slot revisions.

// 5. Passage observation

// sampleExercisePassage(frame)
// Tests swept movement between previous and current rig positions against the
// published goal geometry. It reports a passage fact; the game awards progress.

// 6. Retirement and recycling

// retireExerciseChunk(request)
// Ends passage reporting and retains geometry until presentation release finishes.
// Neutral retirement and earned passage feedback are distinct outcomes.

// recycleExerciseChunk(slot)
// Invalidates the old assignment before reusing its buffers and presentation slots.
// Delayed jobs cannot publish into a reassigned slot.

// unloadChunks()
// Invalidates all assignments and releases owned storage once.
// Presentation disposes its graphics; borrowed World and Air resources remain owned
// by their existing components.
