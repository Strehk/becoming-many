import {
  type BufferGeometry,
  Points,
  type PointsMaterial,
  type Scene,
} from "three";
import type { WorldModule } from "../../../world/module-runtime";
import type { Viewpoint } from "../../../world/viewpoint";

import type { PathParticleMaterial } from "./particle-contract";

// 1. Exercise settings
const SETTINGS = { revealDelaySeconds: 2, belowFlightMeters: 0.5 };

// 2. Composition contract
// The local star supplies independent route geometry and particle presentation.
interface FlightPathOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly createGeometry: () => BufferGeometry;
  readonly createMaterial: () => PathParticleMaterial;
}

/** Own one stationary exercise and its graphics; reveal from the current flight heading. */
export function createFlightPath(options: FlightPathOptions): WorldModule {
  return new FlightPath(options);
}

// 3. Lifetime and demonstration cue
// Attach only when the cue fires. Later motion never moves the exercise's anchor.
class FlightPath implements WorldModule {
  private cloud: Points<BufferGeometry, PointsMaterial> | undefined;
  private material: PathParticleMaterial | undefined;
  private elapsedSeconds = 0;

  constructor(private readonly options: FlightPathOptions) {}

  readonly load = (): void => {
    if (this.cloud) return;
    const geometry = this.options.createGeometry();
    try {
      this.material = this.options.createMaterial();
      this.cloud = new Points(geometry, this.material.pointsMaterial);
      this.cloud.name = "StartFlightPath";
      this.cloud.visible = false;
    } catch (error) {
      geometry.dispose();
      throw error;
    }
  };

  readonly activate = (): void => {
    this.elapsedSeconds = 0;
    this.cloud?.removeFromParent();
    if (this.cloud) this.cloud.visible = false;
  };

  readonly update = (deltaSeconds: number): void => {
    if (!this.cloud) return;
    this.elapsedSeconds += deltaSeconds;
    if (this.elapsedSeconds < SETTINGS.revealDelaySeconds) return;
    if (!this.cloud.parent) this.reveal();
    this.material?.update(deltaSeconds);
  };

  private reveal(): void {
    if (!this.cloud) return;
    const { viewpoint, scene } = this.options;
    const direction = viewpoint.worldFlightDirection;
    this.cloud.position.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
    this.cloud.position.y -= SETTINGS.belowFlightMeters;
    this.cloud.rotation.y = direction
      ? Math.atan2(-direction.x, -direction.z)
      : 0;
    this.cloud.visible = true;
    scene.add(this.cloud);
  }

  readonly deactivate = (): void => {
    if (this.cloud) this.cloud.visible = false;
  };

  readonly unload = (): void => {
    if (!this.cloud) return;
    this.cloud.removeFromParent();
    this.cloud.geometry.dispose();
    this.cloud.material.dispose();
    this.cloud = undefined;
    this.material = undefined;
  };
}
