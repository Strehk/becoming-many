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
  readonly behindMeters: number;
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
    const geometry = createRoadGeometry(parameters);
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

// Vertex opacity emphasizes the edges and fades both ends without a custom shader.
function createRoadGeometry(
  parameters: FlightGuidanceParameters,
): PlaneGeometry {
  const { widthMeters, lengthMeters, behindMeters } = parameters;
  const geometry = new PlaneGeometry(
    widthMeters,
    lengthMeters + behindMeters,
    8,
    24,
  );
  geometry
    .rotateX(-Math.PI / 2)
    .translate(0, 0, (behindMeters - lengthMeters) / 2);
  const positions = geometry.getAttribute("position");
  const colors = new Float32BufferAttribute(positions.count * 4, 4);
  for (let index = 0; index < positions.count; index++) {
    const across = Math.abs(positions.getX(index)) / (widthMeters / 2);
    const z = positions.getZ(index);
    const reach = z > 0 ? behindMeters : lengthMeters;
    const fade = Math.max(0, 1 - Math.abs(z) / reach) ** 3;
    const edge = Math.exp(-(((across - 0.8) / 0.14) ** 2));
    const opacity = (0.025 + edge) * Math.min(1, (1 - across) * 4) * fade;
    colors.setXYZW(index, 1, 1, 1, opacity);
  }
  geometry.setAttribute("color", colors);
  return geometry;
}
