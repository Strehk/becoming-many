import {
  type BufferAttribute,
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

// 1. Settings
// Level-specific color and dimensions are authored in start.level.ts.
// These shared settings control mesh detail, motion response, and edge appearance.
const SETTINGS = {
  widthSegments: 8,
  lengthSegments: 24,
  smoothingSeconds: 0.15,
  maximumFrameSeconds: 0.25,
  minimumTravelMeters: 0.00001,
  minimumCurvature: 0.00001,
  maximumPreviewAngle: Math.PI / 2,
  edgePosition: 0.8,
  edgeSoftness: 0.14,
  centerOpacity: 0.025,
  outerEdgeFade: 4,
  rearFadePower: 3,
  forwardFadePower: 2,
} as const;

const FORWARD = new Vector3(0, 0, -1);
const ROAD_COLUMNS = SETTINGS.widthSegments + 1;

// 2. Contracts
// World supplies motion and height constraints; this module owns the road mesh.
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

// 3. Construction and resource lifetime

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
    this.road = new Mesh(geometry, createRoadMaterial(parameters));
    this.road.name = "StartFlightGuidance";
    this.road.visible = false;
    scene.add(this.road);
  };

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

  // 4. Motion sampling
  // Discontinuities reset prediction; continuous travel smooths yaw and pitch.

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
    const continuous =
      this.hasPreviousFrame &&
      deltaSeconds > 0 &&
      deltaSeconds <= SETTINGS.maximumFrameSeconds &&
      distance > SETTINGS.minimumTravelMeters &&
      distance < parameters.lengthMeters;
    if (continuous) this.smoothCurvature(distance, deltaSeconds);
    else this.curvature = this.verticalCurvature = 0;
    this.previousPosition.copy(position);
    this.previousDirection.copy(direction);
    this.hasPreviousFrame = true;
  }

  private smoothCurvature(distance: number, deltaSeconds: number): void {
    const { viewpoint } = this.options;
    const direction = viewpoint.worldFlightDirection ?? FORWARD;
    const position = viewpoint.worldFlightPosition ?? viewpoint.worldPosition;
    const previous = this.previousDirection;
    const turn = Math.atan2(
      previous.x * direction.z - previous.z * direction.x,
      previous.x * direction.x + previous.z * direction.z,
    );
    const response = 1 - Math.exp(-deltaSeconds / SETTINGS.smoothingSeconds);
    const travel = this.previousPosition.distanceTo(position);
    this.curvature += (turn / distance - this.curvature) * response;
    const pitchChange = (direction.y - previous.y) / travel;
    this.verticalCurvature += (pitchChange - this.verticalCurvature) * response;
  }

  // 5. Flight path prediction
  // The horizontal arc and gentle pitch bend share the real flight height limits.

  private samplePath(distance: number, curvature: number): void {
    const { viewpoint, constrainFlightPosition } = this.options;
    const origin = viewpoint.worldFlightPosition ?? viewpoint.worldPosition;
    const direction = viewpoint.worldFlightDirection ?? FORWARD;
    this.sampleHorizontalArc(distance, curvature);
    this.pathPoint.y =
      direction.y * distance + this.sampleVerticalBend(distance);
    this.pathPoint.add(origin);
    constrainFlightPosition(this.pathPoint);
    this.pathPoint.sub(origin);
  }

  private sampleHorizontalArc(distance: number, curvature: number): void {
    const direction = this.options.viewpoint.worldFlightDirection ?? FORWARD;
    const horizontal = Math.hypot(direction.x, direction.z);
    const dx = direction.x / horizontal;
    const dz = direction.z / horizontal;
    const angle = curvature * horizontal * distance;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    const curved = Math.abs(curvature) > SETTINGS.minimumCurvature;
    const forward = curved ? sine / curvature : horizontal * distance;
    const lateral = curved ? (1 - cosine) / curvature : 0;
    this.pathPoint.set(
      dx * forward - dz * lateral,
      0,
      dz * forward + dx * lateral,
    );
    this.pathSide.set(-dz * cosine - dx * sine, 0, dx * cosine - dz * sine);
  }

  private sampleVerticalBend(distance: number): number {
    const { lengthMeters, verticalBendMeters } = this.options.parameters;
    const bend = Math.max(
      -verticalBendMeters,
      Math.min(
        verticalBendMeters,
        (this.verticalCurvature * lengthMeters ** 2) / 2,
      ),
    );
    return bend * (distance / lengthMeters) ** 2;
  }

  // 6. Road deformation
  // Limit the arc to a quarter turn and avoid folding the inner edge.

  private updateRoad(): void {
    if (!this.road) return;
    const { parameters } = this.options;
    const positions = this.road.geometry.getAttribute("position");
    const uv = this.road.geometry.getAttribute("uv");
    const curvature = Math.max(
      -1 / parameters.widthMeters,
      Math.min(1 / parameters.widthMeters, this.curvature),
    );
    const maxDistance = this.readMaximumDistance(curvature);
    for (let row = 0; row < positions.count; row += ROAD_COLUMNS) {
      const straight =
        uv.getY(row) * (parameters.lengthMeters + parameters.behindMeters) -
        parameters.behindMeters;
      const reach =
        straight < 0 ? parameters.behindMeters : parameters.lengthMeters;
      this.samplePath(straight * Math.min(1, maxDistance / reach), curvature);
      this.updateRoadRow(row);
    }
    positions.needsUpdate = true;
    this.road.geometry.computeBoundingSphere();
  }

  private readMaximumDistance(curvature: number): number {
    const direction = this.options.viewpoint.worldFlightDirection ?? FORWARD;
    return (
      SETTINGS.maximumPreviewAngle /
      Math.max(
        Math.abs(curvature) * Math.hypot(direction.x, direction.z),
        SETTINGS.minimumCurvature,
      )
    );
  }

  private updateRoadRow(row: number): void {
    if (!this.road) return;
    const positions = this.road.geometry.getAttribute("position");
    const uv = this.road.geometry.getAttribute("uv");
    for (let index = row; index < row + ROAD_COLUMNS; index++) {
      const across =
        (uv.getX(index) - 0.5) * this.options.parameters.widthMeters;
      positions.setXYZ(
        index,
        this.pathPoint.x + this.pathSide.x * across,
        this.pathPoint.y,
        this.pathPoint.z + this.pathSide.z * across,
      );
    }
  }
}

// 7. Mesh appearance
// Vertex opacity emphasizes the edges and fades both ends without a custom shader.

function createRoadMaterial(
  parameters: FlightGuidanceParameters,
): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: parameters.color,
    opacity: parameters.opacity,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
  });
}

function createRoadGeometry(
  parameters: FlightGuidanceParameters,
): PlaneGeometry {
  const { widthMeters, lengthMeters, behindMeters } = parameters;
  const geometry = new PlaneGeometry(
    widthMeters,
    lengthMeters + behindMeters,
    SETTINGS.widthSegments,
    SETTINGS.lengthSegments,
  );
  geometry
    .rotateX(-Math.PI / 2)
    .translate(0, 0, (behindMeters - lengthMeters) / 2);
  const positions = geometry.getAttribute("position") as BufferAttribute;
  geometry.setAttribute("color", createRoadColors(positions, parameters));
  positions.setUsage(DynamicDrawUsage);
  return geometry;
}

function createRoadColors(
  positions: BufferAttribute,
  parameters: FlightGuidanceParameters,
): Float32BufferAttribute {
  const colors = new Float32BufferAttribute(positions.count * 4, 4);
  for (let index = 0; index < positions.count; index++) {
    const across =
      Math.abs(positions.getX(index)) / (parameters.widthMeters / 2);
    const fade = sampleLengthFade(positions.getZ(index), parameters);
    const edge = Math.exp(
      -(((across - SETTINGS.edgePosition) / SETTINGS.edgeSoftness) ** 2),
    );
    const opacity =
      (SETTINGS.centerOpacity + edge) *
      Math.min(1, (1 - across) * SETTINGS.outerEdgeFade) *
      fade;
    colors.setXYZW(index, 1, 1, 1, opacity);
  }
  return colors;
}

function sampleLengthFade(
  z: number,
  parameters: FlightGuidanceParameters,
): number {
  const reach = z > 0 ? parameters.behindMeters : parameters.lengthMeters;
  const progress = Math.min(1, Math.abs(z) / reach);
  return z > 0
    ? (1 - progress) ** SETTINGS.rearFadePower
    : (1 - progress * progress) ** SETTINGS.forwardFadePower;
}
