import { BufferGeometry, Points, type PointsMaterial, type Scene } from "three";
import type { WorldModule } from "../../../world/module-runtime";
import type { ExercisePose } from "../start-contract";
import type { PathParticleMaterial } from "./particle-contract";

// 1. Presentation contract
interface FlightPathOptions {
  readonly scene: Scene;
  readonly belowFlightMeters: number;
  /** Maximum visible opacity; reveal and retirement multiply this value. */
  readonly opacity?: number;
  readonly readPresence?: () => number;
  readonly createMaterial: () => PathParticleMaterial;
}

/** Own one reusable display slot. The center chooses when and where to show a route. */
export function createFlightPath(options: FlightPathOptions) {
  return new FlightPath(options);
}

// 2. Graphics lifetime
class FlightPath implements WorldModule {
  private cloud: Points<BufferGeometry, PointsMaterial> | undefined;
  private material: PathParticleMaterial | undefined;
  private fadeSeconds = 0;
  private fadeDuration = 0;
  private revealDuration = 0;
  private revealElapsed = 0;
  private fadeStartOpacity = 1;

  constructor(private readonly options: FlightPathOptions) {}

  readonly load = (): void => {
    if (this.cloud) return;
    this.material = this.options.createMaterial();
    this.cloud = new Points(new BufferGeometry(), this.material.pointsMaterial);
    this.cloud.name = "StartFlightPath";
    this.cloud.visible = false;
  };

  readonly activate = (): void => {
    this.deactivate();
  };
  readonly deactivate = (): void => {
    if (this.cloud) this.cloud.visible = false;
    this.cloud?.removeFromParent();
    this.fadeDuration = 0;
  };

  readonly unload = (): void => {
    if (!this.cloud) return;
    this.deactivate();
    this.cloud.geometry.dispose();
    this.cloud.material.dispose();
    this.cloud = undefined;
    this.material = undefined;
  };

  // 3. Fixed placement; geometry ownership transfers to this display
  readonly isVisible = (): boolean => this.cloud?.visible ?? false;

  readonly show = (
    geometry: BufferGeometry,
    pose: ExercisePose,
    revealSeconds = 0,
  ): void => {
    if (!this.cloud)
      throw new Error("Load the flight path before showing geometry");
    this.cloud.geometry.dispose();
    this.cloud.geometry = geometry;
    this.cloud.position.copy(pose.position);
    this.cloud.position.y -= this.options.belowFlightMeters;
    this.cloud.rotation.y = pose.yawRadians;
    this.revealDuration = revealSeconds;
    this.revealElapsed = 0;
    this.cloud.material.opacity =
      revealSeconds > 0
        ? 0
        : (this.options.opacity ?? 1) * (this.options.readPresence?.() ?? 1);
    this.cloud.visible = true;
    this.fadeDuration = 0;
    this.options.scene.add(this.cloud);
  };

  // 4. GPU wind and retirement fade
  readonly retire = (seconds: number): void => {
    this.fadeDuration = seconds;
    this.fadeSeconds = 0;
    this.fadeStartOpacity = this.cloud?.material.opacity ?? 1;
    if (seconds <= 0) this.deactivate();
  };

  readonly update = (deltaSeconds: number): void => {
    this.material?.update(deltaSeconds);
    if (!this.cloud) return;
    if (this.fadeDuration <= 0) {
      this.updateReveal(deltaSeconds);
      return;
    }
    this.fadeSeconds += deltaSeconds;
    this.cloud.material.opacity = Math.max(
      0,
      this.fadeStartOpacity * (1 - this.fadeSeconds / this.fadeDuration),
    );
    if (this.fadeSeconds >= this.fadeDuration) this.deactivate();
  };
  private updateReveal(deltaSeconds: number): void {
    if (!this.cloud) return;
    this.revealElapsed += deltaSeconds;
    this.cloud.material.opacity =
      (this.options.opacity ?? 1) *
      (this.revealDuration > 0
        ? Math.min(1, this.revealElapsed / this.revealDuration)
        : 1) *
      (this.options.readPresence?.() ?? 1);
  }
}
