// Start Module — composition and World lifecycle
// Comment-only architecture; no executable implementation or runtime registration.

// 1. Position in the application

// Level Composition constructs Start; Run owns its lifetime and reset integration.
// World calls its lifecycle and supplies the only rendering loop.
// Air Particles remain a separate background module.

// 2. Center of the local star

// start-game.runtime.ts — exercise decisions and the sole progress state.
// start-chunks.ts — procedural geometry, passage facts and bounded assignments.
// start-audio-cues.ts — immutable recording bindings and spoken markers.
// Presentation — graphics resources and visual release of supplied geometry.

// This file is the sole integration center of the Start star.
// Only this center imports and connects the concrete local components.
// Every cross-component interaction passes through this center via narrow facts,
// results or injected capabilities. Each component retains its own domain state.
// Leaves import neither one another nor this center, including type-only imports.
// Application-level composition and lifetime remain with Level Composition and Run.

// 3. External interfaces

// Incoming: published rig movement, flight constraints, shared time, native speech
// observations and access to the shared stream queue.
// Outgoing: instruction requests and read-only exercise/completion observations.
// The existing integration connects speech requests to Show and Sound.

// createStartModule(options)
// Connects local components with their borrowed application capabilities.
// Asynchronous speech preparation belongs to Run/Sound before module activation.

// 4. Preparation and activation

// load()
// Initializes bounded local storage and owned presentation resources synchronously.

// activate()
// Starts publication with fresh rig history, excluding earlier movement.

// 5. Frame integration

// update(frameDelta)
// Samples published movement and speech, evaluates passage facts, advances the game
// once and applies its chunk/presentation requests within the shared frame.

// Game progress owns no independent clock. Chunk preparation uses StreamQueue.
// UI observes exercise state; Control remains the sole writer of flight movement.

// 6. Deactivation and release

// deactivate()
// Stops local updates and clears passage history. Playback pause travels through
// its existing owner; XR head tracking remains independent.

// unload()
// Invalidates queued assignments, ends local consumers and disposes owned resources
// once, including partial-load cleanup. Borrowed Air/World resources keep their owners.
