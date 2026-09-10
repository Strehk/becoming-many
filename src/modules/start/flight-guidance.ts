import {
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
  Vector3,
} from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewpoint";

export interface FlightGuidanceParameters {
  readonly color: number;
  readonly opacity: number;
  readonly lengthMeters: number;
  readonly widthMeters: number;
  readonly belowFlightMeters: number;
}

interface FlightGuidanceOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly parameters: FlightGuidanceParameters;
}

const FORWARD = new Vector3(0, 0, -1);

/** Own one road mesh, driven by published travel rather than gaze. */
export function createFlightGuidance(
  options: FlightGuidanceOptions,
): WorldModule {
  return new FlightGuidance(options);
}

class FlightGuidance implements WorldModule {
  private road: Mesh<PlaneGeometry, MeshBasicMaterial> | undefined;

  constructor(private readonly options: FlightGuidanceOptions) {}

  readonly load = (): void => {
    if (this.road) return;
    const { parameters, scene } = this.options;
    const geometry = new PlaneGeometry(
      parameters.widthMeters,
      parameters.lengthMeters,
    );
    geometry
      .rotateX(-Math.PI / 2)
      .translate(0, 0, -parameters.lengthMeters / 2 - 0.1);
    // Far corners are transparent; near corners retain the authored opacity.
    geometry.setAttribute(
      "color",
      new Float32BufferAttribute(
        [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
        4,
      ),
    );
    const material = new MeshBasicMaterial({
      color: parameters.color,
      opacity: parameters.opacity,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
    });
    this.road = new Mesh(geometry, material);
    this.road.name = "StartFlightGuidance";
    this.road.visible = false;
    scene.add(this.road);
  };

  readonly update = (): void => {
    if (!this.road) return;
    const { viewpoint, parameters } = this.options;
    this.road.position.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
    this.road.position.y -= parameters.belowFlightMeters;
    this.road.quaternion.setFromUnitVectors(
      FORWARD,
      viewpoint.worldFlightDirection ?? FORWARD,
    );
  };

  readonly activate = (): void => {
    this.update();
    if (this.road) this.road.visible = true;
  };

  readonly deactivate = (): void => {
    if (this.road) this.road.visible = false;
  };

  readonly unload = (): void => {
    if (!this.road) return;
    this.road.removeFromParent();
    this.road.geometry.dispose();
    this.road.material.dispose();
    this.road = undefined;
  };
}
