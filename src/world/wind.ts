/**
 * Purpose: Define the shared wind used throughout the world.
 * Context: Wind-reactive modules need one consistent direction, strength, and speed.
 * Responsibility: Keep the global wind values in one immutable editable object.
 * Boundary: Animation, rendering, and runtime state remain inside consuming modules.
 */

export const WORLD_WIND = {
  directionXZ: [0.8137, 0.5812], // Sets the normalized horizontal X/Z wind direction.
  strength: 0.18, // Scales wind displacement in consuming components.
  speed: 1, // Advances wind animation phases in radians per second.
} as const;
