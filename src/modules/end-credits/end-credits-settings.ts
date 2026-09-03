/**
 * Purpose: Hold the tunable look and placement values of the credits panel.
 * Context: The panel's proportions were ported from the previous production.
 * Responsibility: Own the canvas, type scale, and world-space panel values.
 * Boundary: The credit lines themselves are authored under `src/dramaturgy`.
 */

export const END_CREDITS_PANEL_SETTINGS = {
  distanceMeters: 3.2, // How far ahead of the eye the panel rides; larger reads smaller.
  widthMeters: 3.4, // Panel width in the world; the height follows the canvas aspect.
  canvasWidthPixels: 2048, // Texture width; raising it sharpens the glyphs and costs memory.
  canvasHeightPixels: 1280, // Texture height; it also sets the panel's aspect ratio.
  textureAnisotropy: 8, // Sharpness when the panel is read at an angle.
  textColor: "#000000", // Glyph colour; the panel is only ever seen against White World.
  // The name registered with the FontFace below; ships as one static weight
  // at public/fonts/rubik/Rubik-Bold.ttf.
  fontFamilyName: "Rubik",
  // What every line actually draws in: Rubik once it has loaded, the system
  // stack for the one frame before that or if the load ever fails.
  fontFamily: "Rubik, system-ui, sans-serif",
  fontWeight: "700", // The one weight shipped; every line draws at it.
  fontUrl: "/fonts/rubik/Rubik-Bold.ttf",
  typeSizePixels: {
    title: 104, // The piece's name.
    role: 40, // Quiet labels such as "A Project By".
    name: 50, // The people credited.
  },
  titleCenterY: 0.26, // Where the title sits down the canvas, as a fraction of its height.
  titleGapPixels: 333, // Space under the title before the first line below it.
  lineHeightPixels: 88, // Baseline step between every line after the title.
  // Drawn after the world so the text blends over whatever remains of it.
  renderOrder: 999,
} as const;
