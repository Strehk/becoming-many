import {
  DoubleSide,
  DynamicDrawUsage,
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
  readonly verticalBendMeters: number;
  readonly widthMeters: number;
  readonly belowFlightMeters: number;
}

interface FlightGuidanceOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly parameters: FlightGuidanceParameters;
  /** Constrain a borrowed world-space sample using the live flight height rules. */
  readonly constrainFlightPosition: (position: Vector3) => void;
}

const FORWARD = new Vector3(0, 0, -1);
const ROAD_COLUMNS = 9;

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
  private curvature = 0;
  private verticalCurvature = 0;
  private readonly pathPoint = new Vector3();
  private readonly pathSide = new Vector3();

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
    const origin = viewpoint.worldFlightPosition ?? viewpoint.worldPosition;
    this.road.position.copy(origin);
    this.road.position.y -= parameters.belowFlightMeters;
    this.readCurvature(deltaSeconds);
    this.updateRoad();
  };

  private readCurvature(deltaSeconds: number): void {
    const { viewpoint, parameters } = this.options;
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
      distance < parameters.lengthMeters;
    const travel = this.previousPosition.distanceTo(position);
    if (continuous) {
      const response = 1 - Math.exp(-deltaSeconds / 0.15);
      this.curvature += (turn / distance - this.curvature) * response;
      const pitchChange = (direction.y - previous.y) / travel;
      this.verticalCurvature +=
        (pitchChange - this.verticalCurvature) * response;
    } else {
      this.curvature = this.verticalCurvature = 0;
    }
    this.previousPosition.copy(position);
    previous.copy(direction);
    this.hasPreviousFrame = true;
  }

  // Held steering continues its yaw and climb; the shared constraint shapes hills or plateaus.
  private samplePath(distance: number, curvature: number): void {
    const { viewpoint, parameters, constrainFlightPosition } = this.options;
    const origin = viewpoint.worldFlightPosition ?? viewpoint.worldPosition;
    const direction = viewpoint.worldFlightDirection ?? FORWARD;
    const horizontal = Math.hypot(direction.x, direction.z);
    const dx = direction.x / horizontal;
    const dz = direction.z / horizontal;
    const angle = curvature * horizontal * distance;
    const sine = Math.sin(angle),
      cosine = Math.cos(angle);
    const forward =
      Math.abs(curvature) > 0.00001 ? sine / curvature : horizontal * distance;
    const lateral =
      Math.abs(curvature) > 0.00001 ? (1 - cosine) / curvature : 0;
    const bend = Math.max(
      -parameters.verticalBendMeters,
      Math.min(
        parameters.verticalBendMeters,
        (this.verticalCurvature * parameters.lengthMeters ** 2) / 2,
      ),
    );
    this.pathPoint.set(
      origin.x + dx * forward - dz * lateral,
      origin.y +
        direction.y * distance +
        bend * (distance / parameters.lengthMeters) ** 2,
      origin.z + dz * forward + dx * lateral,
    );
    constrainFlightPosition(this.pathPoint);
    this.pathPoint.sub(origin);
    this.pathSide.set(-dz * cosine - dx * sine, 0, dx * cosine - dz * sine);
  }

  private updateRoad(): void {
    if (!this.road) return;
    const { parameters, viewpoint } = this.options;
    const positions = this.road.geometry.getAttribute("position");
    const uv = this.road.geometry.getAttribute("uv");
    const curvature = Math.max(
      -1 / parameters.widthMeters,
      Math.min(1 / parameters.widthMeters, this.curvature),
    );
    const direction = viewpoint.worldFlightDirection ?? FORWARD;
    const maxDistance =
      Math.PI /
      2 /
      Math.max(
        Math.abs(curvature) * Math.hypot(direction.x, direction.z),
        0.00001,
      );
    for (let row = 0; row < positions.count; row += ROAD_COLUMNS) {
      const straight =
        uv.getY(row) * (parameters.lengthMeters + parameters.behindMeters) -
        parameters.behindMeters;
      const reach =
        straight < 0 ? parameters.behindMeters : parameters.lengthMeters;
      this.samplePath(straight * Math.min(1, maxDistance / reach), curvature);
      for (let index = row; index < row + ROAD_COLUMNS; index++) {
        const across = (uv.getX(index) - 0.5) * parameters.widthMeters;
        positions.setXYZ(
          index,
          this.pathPoint.x + this.pathSide.x * across,
          this.pathPoint.y,
          this.pathPoint.z + this.pathSide.z * across,
        );
      }
    }
    positions.needsUpdate = true;
    this.road.geometry.computeBoundingSphere();
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
    const progress = Math.min(1, Math.abs(z) / reach);
    const fade = z > 0 ? (1 - progress) ** 3 : (1 - progress * progress) ** 2;
    const edge = Math.exp(-(((across - 0.8) / 0.14) ** 2));
    const opacity = (0.025 + edge) * Math.min(1, (1 - across) * 4) * fade;
    colors.setXYZW(index, 1, 1, 1, opacity);
  }
  geometry.setAttribute("color", colors);
  (positions as Float32BufferAttribute).setUsage(DynamicDrawUsage);
  return geometry;
}
