/*
 * Purpose: Spread the show's Motion sense fade across the fly pool.
 * Context: Opaque specks all cross the pixel they need in the same instant.
 * Responsibility: Turn one sense strength into this fly's own share of it.
 * Boundary: Swarm placement, buzz, and the point shape stay beside this file.
 */

// The share of the fade window one fly takes for itself. The rest of the
// window is what the pool spreads across, so the swarms gather over the whole
// fade rather than arriving as one block.
const float FLY_SENSE_ARRIVAL_SHARE = 0.4;

float flySenseArrivalScale(float senseFade, float share) {
  float start = share * (1.0 - FLY_SENSE_ARRIVAL_SHARE);
  return smoothstep(start, start + FLY_SENSE_ARRIVAL_SHARE, senseFade);
}
