/**
 * Purpose: Define permanent tuning values for the shared World Runtime.
 * Context: Desktop and WebXR use one renderer, stream queue, and frame loop.
 * Responsibility: Keep renderer and streaming settings in one editable place.
 * Boundary: Level presentation and concrete module settings stay outside World.
 */

export const WORLD_RUNTIME_SETTINGS = {
  /**
   * Attributes for the one WebGL2 context. The World Runtime hands the same
   * record to `getContext` and to the renderer, so the context the driver
   * creates and the context Three.js believes in can never disagree.
   */
  renderer: {
    antialias: false, // Enable global MSAA at renderer creation; measure changes on PICO.
    alpha: false, // Opaque drawing buffer, so the clear alpha stays 1.

    /**
     * Create the context on the adapter the XR runtime drives. Three.js
     * otherwise has to call `makeXRCompatible()` while adopting a session the
     * headset already presents, and a runtime that answers by migrating
     * adapters loses the context underneath that half-configured session:
     * every GPU resource dies, the layer setup fails, and the visitor is left
     * in a live session nothing can draw into.
     */
    xrCompatible: true,
  },
  streamQueue: {
    budgetMilliseconds: 0.5, // Limits cooperative stream work started per frame.
    capacity: 256, // Bounds pending work across all active modules.
  },
} as const;
