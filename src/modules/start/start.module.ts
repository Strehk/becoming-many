/**
 * Planning scaffold only. Not imported, composed, or activated by the application.
 *
 * Purpose: Host the procedural Start game within the existing WorldModule lifecycle.
 * Responsibility: Connect the local game, chunk calculations and future presentation.
 * Boundary: This is a content module, not an application/game framework or new loop.
 *
 * PLANNED FUNCTIONS
 * createStartModule(options): connect the local helpers to narrow injected World,
 *   movement, shared-time and speech observations; acquire no sibling implementations.
 * load(): initialize the bounded chunk/presentation pool. Asynchronous speech asset
 *   preparation remains with Run/Sound, not this synchronous WorldModule callback.
 * activate(): begin publication and capture initial rig history without false travel.
 * update(frameDelta): consume one frame of published flight and playback facts,
 *   advance the game once, and pass borrowed chunk/presentation facts to their owner.
 * deactivate(): stop local updates and invalidate passage history; coordinate speech
 *   pause through the existing owner without assuming that head tracking must stop.
 * unload(): invalidate queued chunk revisions, end local consumers and dispose owned
 *   resources once, including partial-load failure; release no borrowed Air/World data.
 *
 * FUTURE INTEGRATION, NOT PART OF THIS SCAFFOLD
 * Level Composition constructs/injects the module; Run owns startup/reset/teardown.
 * Show/Sound receive instruction requests through an explicit narrow contract and
 * publish trustworthy native playback facts back through the existing integration.
 * Review that contract before restoring any standalone speech or main-Show handoff.
 * Air Particles continue as their separate existing module and background layer.
 * start.level.ts will author selected exercise parameters as one literal only when
 * implementation is authorized. Current Air-only behavior remains unchanged.
 */
