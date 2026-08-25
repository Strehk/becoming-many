/**
 * Purpose: Provide the user-triggered WebXR entry for the world renderer.
 * Context: Every current level uses Three.js's official immersive VR button.
 * Responsibility: Enable WebXR and attach the session button to the page.
 * Boundary: Passthrough, immersive AR, and operator control are not handled here.
 */

import type { WebGLRenderer } from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";

export function enableWebXR(renderer: WebGLRenderer): void {
  renderer.xr.enabled = true;

  const button = VRButton.createButton(renderer);

  // VRButton defaults to white text, so use dark controls on the bright canvas.
  button.style.background = "rgba(255, 255, 255, 0.85)";
  button.style.borderColor = "#111111";
  button.style.color = "#111111";

  document.body.appendChild(button);
}
