/**
 * Purpose: Show the authored closing credits on one plane inside the world.
 * Context: A DOM overlay is invisible in an immersive session, so this is 3D.
 * Responsibility: Own the panel's resources, its per-frame pose, and its fade.
 * Boundary: When the credits are present is the show driver's decision.
 */

import {
  type Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
} from "three";
import type { EndCreditsDefinition } from "../../dramaturgy/end-credits";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { createEndCreditsPose } from "./end-credits-pose";
import { END_CREDITS_PANEL_SETTINGS } from "./end-credits-settings";
import { drawEndCreditsTexture } from "./end-credits-texture";

export interface EndCreditsPanelOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  /** The transform locomotion moves; its forward is the flight heading. */
  readonly viewerRig: Group;
  /**
   * The comfort pitch the rendered view is raised by, so the panel can be
   * raised onto the same axis. It is authored with the flight settings, which
   * this module does not read for itself.
   */
  readonly viewPitchDegrees: number;
  readonly definition: EndCreditsDefinition;
}

/** The module beside the one driver a show steers the whole panel through. */
export interface EndCreditsPanelHandle {
  readonly module: WorldModule;
  /** 0 hides the panel entirely; 1 is the held final state. */
  readonly setPresence: (presence: number) => void;
}

interface EndCreditsResources {
  readonly panel: Mesh<PlaneGeometry, MeshBasicMaterial>;
}

/**
 * One plane, one material, one texture, and one draw call while it is
 * visible. The fade is the material's own opacity against the drawn alpha, so
 * the panel needs no shader of its own, and the canvas repaints at most
 * once more, when the shipped font resolves.
 *
 * It is the piece's one transparent surface. An opaque plane would follow the
 * world's fade-to-background rule, but it would also occlude the air
 * particles still drifting through White World behind it.
 */
export function createEndCreditsPanel(
  options: EndCreditsPanelOptions,
): EndCreditsPanelHandle {
  const settings = END_CREDITS_PANEL_SETTINGS;
  const pose = createEndCreditsPose({
    distanceMeters: settings.distanceMeters,
    viewPitchDegrees: options.viewPitchDegrees,
  });
  let resources: EndCreditsResources | undefined;
  let presence = 0;

  function applyPresence(): void {
    if (!resources) return;

    resources.panel.material.opacity = presence;
    // Hidden rather than drawn at zero, so an invisible panel costs no draw.
    resources.panel.visible = presence > 0;
  }

  return {
    setPresence: (next): void => {
      presence = next;
      applyPresence();
    },

    module: {
      load: (): void => {
        const texture = drawEndCreditsTexture(options.definition);
        const heightMeters =
          (settings.widthMeters * settings.canvasHeightPixels) /
          settings.canvasWidthPixels;
        const material = new MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          // Nothing is meant to hide behind the credits, and writing depth
          // would make the panel's transparent margin cut out the world.
          depthWrite: false,
          toneMapped: false,
        });
        const panel = new Mesh(
          new PlaneGeometry(settings.widthMeters, heightMeters),
          material,
        );
        panel.name = "EndCreditsPanel";
        // It sits right in front of the eye and always faces it; culling it
        // against the frustum can only ever cost work.
        panel.frustumCulled = false;
        panel.renderOrder = settings.renderOrder;
        // Loading happens before the first render; the show decides when the
        // panel appears.
        panel.visible = false;
        options.scene.add(panel);
        resources = { panel };
        applyPresence();
      },

      activate: applyPresence,

      update: (): void => {
        if (!resources?.panel.visible) return;

        // The viewpoint, never the camera: under the rig the camera's own
        // position is the head's offset within it, not a world position. The
        // rig is a direct child of the scene, so its own rotation is already
        // its world heading.
        pose.place(
          options.viewpoint.worldPosition,
          options.viewerRig.quaternion,
        );
        resources.panel.position.copy(pose.position);
        resources.panel.lookAt(pose.lookTarget);
      },

      deactivate: (): void => {
        if (resources) resources.panel.visible = false;
      },

      unload: (): void => {
        if (!resources) return;

        const { panel } = resources;
        resources = undefined;
        options.scene.remove(panel);
        panel.geometry.dispose();
        panel.material.map?.dispose();
        panel.material.dispose();
      },
    },
  };
}
