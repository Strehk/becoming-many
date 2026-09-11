import { BufferGeometry, Points, type PointsMaterial, type Scene } from "three";
import type { WorldModule } from "../../../world/module-runtime";
import type { ExercisePose } from "../start-contract";
import type { PathParticleMaterial } from "./particle-contract";

// 1. Presentation contract
interface FlightPathOptions {
  readonly scene: Scene;
  readonly growth?: {
    readonly speedMetersPerSecond: number;
    readonly softEdgeMeters: number;
  };
  readonly belowFlightMeters: number;
  /** Maximum visible opacity; reveal and retirement multiply this value. */
  readonly opacity?: number;
  readonly readPresence?: () => number;
  readonly createMaterial: () => PathParticleMaterial;
}

interface PathReveal {
  readonly fadeSeconds?: number;
  /** Carry the predecessor's revealed feather across a connected seam. */
  readonly incomingMeters?: number;
}

/** Own one reusable display slot. The center chooses when and where to show a route. */
export function createFlightPath(options: FlightPathOptions) {
  return new FlightPath(options);
}

// 2. Graphics lifetime
class FlightPath implements WorldModule {
  private cloud: Points<BufferGeometry, PointsMaterial> | undefined;
  private material: PathParticleMaterial | undefined;
  private frontMeters = 0;
  private incomingMeters = 0;
  private routeEndMeters = 0;
  readonly readContinuationMeters = (): number =>
    Math.max(0, this.frontMeters - this.routeEndMeters);
  // Ring emergence keeps its authored clock, independent of the inherited seam.
  readonly readRevealMeters = (): number =>
    this.options.growth
      ? this.frontMeters - this.options.growth.softEdgeMeters
      : Infinity;
  readonly isRevealed = (): boolean =>
    !this.options.growth ||
    this.frontMeters >=
      this.routeEndMeters + this.options.growth.softEdgeMeters;
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
    reveal: PathReveal = {},
  ): void => {
    if (!this.cloud)
      throw new Error("Load the flight path before showing geometry");
    this.cloud.geometry.dispose();
    this.cloud.geometry = geometry;
    this.incomingMeters = reveal.incomingMeters ?? 0;
    this.resetGrowth(geometry);
    this.cloud.position.copy(pose.position);
    this.cloud.position.y -= this.options.belowFlightMeters;
    this.cloud.rotation.y = pose.yawRadians;
    this.revealDuration = reveal.fadeSeconds ?? 0;
    this.revealElapsed = 0;
    this.cloud.material.opacity =
      this.revealDuration > 0
        ? 0
        : (this.options.opacity ?? 1) * (this.options.readPresence?.() ?? 1);
    this.cloud.visible = true;
    this.fadeDuration = 0;
    this.options.scene.add(this.cloud);
  };

  private resetGrowth(geometry: BufferGeometry): void {
    const distances = geometry.getAttribute("routeDistance");
    this.routeEndMeters = distances
      ? distances.getX(
          geometry.drawRange.count === Infinity
            ? distances.count - 1
            : geometry.drawRange.count - 1,
        )
      : 0;
    this.frontMeters = 0;
    this.material?.setRevealMeters?.(this.incomingMeters);
  }

  // 4. GPU wind and retirement fade
  readonly retire = (seconds: number): void => {
    this.fadeDuration = seconds;
    this.fadeSeconds = 0;
    this.fadeStartOpacity = this.cloud?.material.opacity ?? 1;
    if (seconds <= 0) this.deactivate();
  };

  readonly update = (deltaSeconds: number): void => {
    if (this.options.growth && this.fadeDuration <= 0) {
      this.frontMeters = Math.min(
        this.routeEndMeters + this.options.growth.softEdgeMeters,
        this.frontMeters +
          Math.max(0, deltaSeconds) * this.options.growth.speedMetersPerSecond,
      );
      this.material?.setRevealMeters?.(this.frontMeters + this.incomingMeters);
    }
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
