/**
 * Purpose: The menu's measures of the White World's air.
 * Context: The menu does not imitate the piece's particles; it borrows the
 *   experience's own air (see air-borrow.js) and draws it denser and, on a
 *   desktop screen, larger, so the white is never empty while the menu
 *   stands still.
 * Responsibility: The glide speeds, the desktop particle scale, the menu's
 *   air density, and the air recipe as the menu draws it.
 * Boundary: Nothing in src/ imports this file; it only reads src/ settings.
 */

import { FLIGHT_SETTINGS } from "../../src/control/flight-settings";
import { level as whiteWorld } from "../../src/levels/white-world.level";

/** The piece's own glide speed, and the menu's slower drift. */
export const GLIDE_METERS_PER_SECOND =
  FLIGHT_SETTINGS.glideSpeedMetersPerSecond;
export const MENU_GLIDE_METERS_PER_SECOND = GLIDE_METERS_PER_SECOND * 0.4;

/**
 * On a desktop screen the show's 7.5 cm squares read as dust; the menu draws
 * them larger there. Phones and headsets keep the authored size.
 */
export const DESKTOP_PARTICLE_SCALE = 1.8;
const particleScale = () =>
  window.matchMedia("(pointer: fine)").matches ? DESKTOP_PARTICLE_SCALE : 1;

/**
 * The menu stands still in the white for a long time, so it carries more air
 * than the show: four times the authored density on desktop, a little over
 * twice on phones, so the middle distance is never empty.
 */
export const MENU_DENSITY_SCALE = { desktop: 4, phone: 2.2 };
const densityScale = () =>
  window.matchMedia("(pointer: fine)").matches
    ? MENU_DENSITY_SCALE.desktop
    : MENU_DENSITY_SCALE.phone;

/** The air recipe as the menu draws it, desktop scale and density included. */
export const airParticleRecipe = () => ({
  ...whiteWorld.airParticles,
  density: {
    particlesPerChunk: Math.round(
      whiteWorld.airParticles.density.particlesPerChunk * densityScale(),
    ),
  },
  appearance: {
    ...whiteWorld.airParticles.appearance,
    sizeMeters: whiteWorld.airParticles.appearance.sizeMeters * particleScale(),
  },
});
