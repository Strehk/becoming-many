import type { FlightRoute } from "../flight-path/particle-contract";

// 1. Filled arrow proportions and spacing between interior sampling rows
const SETTINGS = {
  tail: -0.5,
  shoulder: 0.12,
  tip: 0.5,
  shaftHalfWidth: 0.09,
  headHalfWidth: 0.32,
  rowSpacingMeters: 0.08,
};

/** Fill shaft and head in XY; local +X points forward. Particle scatter adds depth. */
export function createArrowShape(lengthMeters: number): FlightRoute {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0)
    throw new RangeError("Arrow length must be positive");
  const rows = createFillRows(lengthMeters);
  return {
    lengthMeters: rows.reduce((sum, row) => sum + row.length, 0),
    sample: (distance, target) => {
      for (const row of rows) {
        if (distance <= row.length) {
          target.set(row.start + distance, row.y, 0);
          return;
        }
        distance -= row.length;
      }
      target.set(SETTINGS.tip * lengthMeters, 0, 0);
    },
  };
}

// 2. Horizontal interior rows cover the full silhouette, not just its outline
function createFillRows(lengthMeters: number) {
  const count = Math.ceil(
    (2 * SETTINGS.headHalfWidth * lengthMeters) / SETTINGS.rowSpacingMeters,
  );
  return Array.from({ length: count }, (_, index) => {
    const y = (((index + 0.5) / count) * 2 - 1) * SETTINGS.headHalfWidth;
    const start =
      Math.abs(y) <= SETTINGS.shaftHalfWidth
        ? SETTINGS.tail
        : SETTINGS.shoulder;
    const end =
      SETTINGS.tip -
      (Math.abs(y) / SETTINGS.headHalfWidth) *
        (SETTINGS.tip - SETTINGS.shoulder);
    return {
      start: start * lengthMeters,
      y: y * lengthMeters,
      length: (end - start) * lengthMeters,
    };
  });
}
