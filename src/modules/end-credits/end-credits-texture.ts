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
 * A single canvas painted once at load, never per frame. The panel appears
 * only against White World, so the glyphs are plain black on transparency
 * with no card, box, or halo behind them.
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
  return texture;
}

function paintEndCredits(
  context: CanvasRenderingContext2D,
  definition: EndCreditsDefinition,
): void {
  const panel = END_CREDITS_PANEL_SETTINGS;
  const centerX = panel.canvasWidthPixels / 2;

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
    context.font = `${fontSizePixels(line.role)}px ${panel.fontFamily}`;
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
