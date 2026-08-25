/**
 * Purpose: Define permanent tuning values for the shared World Runtime.
 * Context: Desktop and WebXR use one renderer, stream queue, and frame loop.
 * Responsibility: Keep renderer and streaming settings in one editable place.
 * Boundary: Level presentation and concrete module settings stay outside World.
 */

export const WORLD_RUNTIME_SETTINGS = {
  renderer: {
    antialias: false, // Enable global MSAA at renderer creation; measure changes on PICO.
  },
  streamQueue: {
    budgetMilliseconds: 0.5, // Limits cooperative stream work started per frame.
    capacity: 256, // Bounds pending work across all active modules.
  },
} as const;
