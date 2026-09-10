import {
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
  Sphere,
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
  private readonly previousPosition = new Vector3();
  private readonly previousDirection = new Vector3();
  private hasPreviousFrame = false;

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

  readonly update = (deltaSeconds = 0): void => {
    if (!this.road) return;
    const { viewpoint, parameters } = this.options;
    bendRoad(this.road.geometry, this.readCurvature(deltaSeconds), parameters);
    this.road.position.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
    this.road.position.y -= parameters.belowFlightMeters;
    this.road.quaternion.setFromUnitVectors(
      FORWARD,
      viewpoint.worldFlightDirection ?? FORWARD,
    );
  };

  // Observe travel only: no input imports, flight physics or gaze prediction.
  private readCurvature(deltaSeconds: number): number {
    const { viewpoint } = this.options;
    const position = viewpoint.worldFlightPosition ?? viewpoint.worldPosition;
    const direction = viewpoint.worldFlightDirection ?? FORWARD;
    const distance = Math.hypot(
      position.x - this.previousPosition.x,
      position.z - this.previousPosition.z,
    );
    const previous = this.previousDirection;
    const turn = Math.atan2(
      previous.x * direction.z - previous.z * direction.x,
      previous.x * direction.x + previous.z * direction.z,
    );
    const continuous =
      this.hasPreviousFrame &&
      deltaSeconds > 0 &&
      deltaSeconds <= 0.25 &&
      distance > 0.00001 &&
      distance < this.options.parameters.lengthMeters &&
      Math.abs(turn) < 0.5;
    this.previousPosition.copy(position);
    previous.copy(direction);
    this.hasPreviousFrame = true;
    return continuous ? turn / distance : 0;
  }

  readonly activate = (): void => {
    this.hasPreviousFrame = false;
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
    this.hasPreviousFrame = false;
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
  (positions as Float32BufferAttribute).setUsage(DynamicDrawUsage);
  // Conservative bounds remain valid when the fixed road buffer bends.
  geometry.boundingSphere = new Sphere(
    new Vector3(),
    Math.max(lengthMeters, behindMeters) + widthMeters,
  );
  return geometry;
}

// Approximate continued steering with a constant-curvature arc, at most a quarter turn.
function bendRoad(
  geometry: PlaneGeometry,
  curvature: number,
  parameters: FlightGuidanceParameters,
): void {
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const maxDistance = Math.PI / (2 * Math.max(Math.abs(curvature), 0.00001));
  for (let index = 0; index < positions.count; index++) {
    const straight =
      uv.getY(index) * (parameters.lengthMeters + parameters.behindMeters) -
      parameters.behindMeters;
    const reach =
      straight < 0 ? parameters.behindMeters : parameters.lengthMeters;
    const distance = straight * Math.min(1, maxDistance / reach);
    const angle = curvature * distance;
    const across = (uv.getX(index) - 0.5) * parameters.widthMeters;
    const x =
      Math.abs(curvature) < 0.00001 ? 0 : (1 - Math.cos(angle)) / curvature;
    const z =
      Math.abs(curvature) < 0.00001 ? -distance : -Math.sin(angle) / curvature;
    positions.setXYZ(
      index,
      x + across * Math.cos(angle),
      0,
      z + across * Math.sin(angle),
    );
  }
  positions.needsUpdate = true;
}
