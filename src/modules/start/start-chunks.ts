/**
 * Planning scaffold only. No geometry, buffers, classes, or jobs are created.
 *
 * Purpose: Generate and recycle spatial exercise chunks ahead of actual flight.
 * Responsibility: Own bounded chunk geometry, placement and resource assignments.
 * Boundary: Learning decisions belong to the game engine; audio belongs to Sound.
 * An exercise chunk is a path section with one learning goal, not an Air/terrain
 * grid cell. Its size must follow reachability and audio lead time, not grid size.
 *
 * CHUNK FACTS
 * Stable identity: lesson ID, attempt revision, deterministic seed, pool revision.
 * Spatial facts: fixed world entry/exit poses, bounds, route samples and goal shape.
 * Binding: exercise/audio cue ID; chunk generation itself never starts playback.
 * Resource facts: preparation readiness and owned fixed-capacity presentation slots.
 * No duplicate current-lesson index, success counter or narration state lives here.
 *
 * GENERATION AND RECYCLING
 * Plan from worldFlightPosition/worldFlightDirection plus injected flight limits.
 * At the current 2 m/s, the 19.30-second opening marker represents 38.60 metres of
 * path travel before the right instruction, even before formation/reaction time.
 * This is a lead-distance observation, not a prescribed straight-line spawn offset.
 * Reserve final poses near actual instruction release; prebuild reusable resources
 * earlier. Do not pin the first target near spawn while its long introduction runs.
 * Once shown, geometry stays world-fixed and never follows the viewer's gaze.
 * Pre-generate only bounded lookahead; do not activate the next exercise early.
 * Keep a bounded set of current, prepared and retiring slots; choose exact capacities
 * before implementation. There is no growing history of past chunks or GPU objects.
 * Reuse World's StreamQueue and revision-checked incremental jobs for expensive work.
 * No allocation, decoding, unbounded search or synchronous generation burst per frame.
 *
 * PLANNED FUNCTIONS
 * planExerciseChunk(request): calculate a reachable section from actual flight,
 *   exercise direction, available height and the required instruction lead time.
 * generateExerciseChunk(plan): fill preallocated route/goal buffers reproducibly;
 *   return not-ready when a bounded attempt cannot satisfy the constraints.
 * connectExerciseChunk(connection): match entry position/tangent to the preceding
 *   exit where reachable; otherwise wait/replan an unseen section without teleporting.
 * prepareChunk(job): perform one small generation step through the shared queue;
 *   publish only when the slot and attempt revisions still match.
 * sampleExercisePassage(frame): perform a swept previous-to-current rig passage test
 *   on the same geometry used for presentation; report facts, never award progress.
 * retireExerciseChunk(request): stop new passage reports and retain old world poses
 *   until presentation release completes; a miss produces no success feedback.
 * recycleExerciseChunk(slot): invalidate stale jobs/observations before reassignment.
 * unloadChunks(): invalidate every assignment and dispose only owned resources once.
 *
 * VISUAL DESIGN BOUNDARY
 * A chunk will contain one exercise; exact arrow, ring, route and cloud appearance
 * remains a separate presentation decision. Do not recreate the deleted effects
 * merely because earlier scene illustrations show them.
 */
