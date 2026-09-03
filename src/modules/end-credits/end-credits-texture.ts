/**
 * Purpose: Draw the closing credit lines once into a texture for the panel.
 * Context: There is no text renderer in the piece and none is worth adding.
 * Responsibility: Own the canvas, the type scale, and the resulting texture.
 * Boundary: What the lines say is authored in `src/dramaturgy/end-credits.ts`.
 */

import { CanvasTexture, SRGBColorSpace } from "three";
import type {
  EndCreditsDefinition,
  EndCreditsLineRole,
} from "../../dramaturgy/end-credits";
import { END_CREDITS_PANEL_SETTINGS } from "./end-credits-settings";

/**
 * A canvas painted at load, and repainted exactly once more if Rubik was
 * still loading when the first paint ran — never per frame. The panel
 * appears only against White World, so the glyphs are plain black on
 * transparency with no card, box, or halo behind them.
 */
export function drawEndCreditsTexture(
  definition: EndCreditsDefinition,
): CanvasTexture {
  const panel = END_CREDITS_PANEL_SETTINGS;
  const canvas = document.createElement("canvas");
  canvas.width = panel.canvasWidthPixels;
  canvas.height = panel.canvasHeightPixels;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The end credits need a 2D canvas context");
  }

  paintEndCredits(context, definition);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // The panel is read at an angle as often as head-on; anisotropy keeps the
  // smaller lines from smearing when it is.
  texture.anisotropy = panel.textureAnisotropy;

  // The first paint above may have fallen back to the system stack if Rubik
  // had not resolved yet. Repaint once it has and push the result to the GPU;
  // a font that never resolves leaves the fallback paint standing rather than
  // blocking the credits.
  void ensureEndCreditsFont().then(() => {
    paintEndCredits(context, definition);
    texture.needsUpdate = true;
  });

  return texture;
}

/**
 * Load Rubik once and register it with the document, so canvas text can draw
 * in it. Idempotent: every panel instance shares the one load.
 */
let fontReady: Promise<void> | undefined;
function ensureEndCreditsFont(): Promise<void> {
  if (!fontReady) {
    const panel = END_CREDITS_PANEL_SETTINGS;
    const face = new FontFace(panel.fontFamilyName, `url(${panel.fontUrl})`, {
      weight: panel.fontWeight,
    });
    fontReady = face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      })
      .catch((error: unknown) => {
        console.warn(
          "[end-credits] Rubik failed to load — using fallback",
          error,
        );
      });
  }
  return fontReady;
}

function paintEndCredits(
  context: CanvasRenderingContext2D,
  definition: EndCreditsDefinition,
): void {
  const panel = END_CREDITS_PANEL_SETTINGS;
  const centerX = panel.canvasWidthPixels / 2;

  // Cleared on every paint, not only the first: the repaint once Rubik
  // resolves would otherwise draw over its own fallback-face pass and ghost.
  context.clearRect(0, 0, panel.canvasWidthPixels, panel.canvasHeightPixels);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = panel.textColor;

  let nextY = panel.titleCenterY * panel.canvasHeightPixels;
  let previousRole: EndCreditsLineRole | undefined;

  for (const line of definition.lines) {
    if (previousRole !== undefined) {
      nextY +=
        previousRole === "title"
          ? panel.titleGapPixels
          : panel.lineHeightPixels;
    }
    context.font = `${panel.fontWeight} ${fontSizePixels(line.role)}px ${panel.fontFamily}`;
    context.fillText(line.text, centerX, nextY);
    previousRole = line.role;
  }
}

function fontSizePixels(role: EndCreditsLineRole): number {
  const type = END_CREDITS_PANEL_SETTINGS.typeSizePixels;
  if (role === "title") return type.title;
  if (role === "role") return type.role;
  return type.name;
}
