import {
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewpoint";

// 1. Authored appearance

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
const NEAR_DISTANCE_METERS = 0.75;

// 2. Soft light corridor

const VERTEX_SHADER = /* glsl */ `
  varying vec2 corridorUv;
  void main() {
    corridorUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 lightColor;
  uniform float opacity;
  varying vec2 corridorUv;
  void main() {
    float edge = abs(corridorUv.x * 2.0 - 1.0) / (0.12 + 0.88 * corridorUv.y);
    float glow = exp(-edge * edge * 5.0) * (1.0 - smoothstep(0.7, 1.0, edge));
    float ends = smoothstep(0.0, 0.12, corridorUv.y)
      * (1.0 - smoothstep(0.35, 1.0, corridorUv.y));
    gl_FragColor = vec4(lightColor, opacity * glow * ends);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createCorridor(parameters: FlightGuidanceParameters) {
  const geometry = new PlaneGeometry(1, 1);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index++) {
    const distance = uv.getY(index);
    const width = parameters.widthMeters;
    positions.setXYZ(
      index,
      (uv.getX(index) - 0.5) * width,
      0,
      -NEAR_DISTANCE_METERS - distance * parameters.lengthMeters,
    );
  }
  geometry.computeBoundingSphere();
  const material = createLightMaterial(parameters);
  const mesh = new Mesh(geometry, material);
  mesh.name = "StartFlightGuidance";
  mesh.visible = false;
  return mesh;
}

function createLightMaterial(
  parameters: FlightGuidanceParameters,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      lightColor: { value: new Color(parameters.color) },
      opacity: { value: parameters.opacity },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
  });
}

// 3. Shared frame and owned lifetime

/** Display published travel, independently of gaze. Own one mesh; never steer the rig. */
export function createFlightGuidance(
  options: FlightGuidanceOptions,
): WorldModule {
  return new FlightGuidance(options);
}

class FlightGuidance implements WorldModule {
  private corridor: ReturnType<typeof createCorridor> | undefined;

  constructor(private readonly options: FlightGuidanceOptions) {}

  readonly load = (): void => {
    if (this.corridor) return;
    this.corridor = createCorridor(this.options.parameters);
    this.options.scene.add(this.corridor);
  };

  readonly activate = (): void => {
    if (!this.corridor) return;
    this.update();
    this.corridor.visible = true;
  };

  readonly update = (): void => {
    if (this.corridor) updateCorridor(this.corridor, this.options);
  };

  readonly deactivate = (): void => {
    if (this.corridor) this.corridor.visible = false;
  };

  readonly unload = (): void => {
    if (!this.corridor) return;
    this.corridor.removeFromParent();
    this.corridor.geometry.dispose();
    this.corridor.material.dispose();
    this.corridor = undefined;
  };
}

function updateCorridor(
  corridor: Mesh,
  { viewpoint, parameters }: FlightGuidanceOptions,
): void {
  corridor.position.copy(
    viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
  );
  // Lower the light slightly so straight-ahead travel remains visible from the eye.
  corridor.position.y -= parameters.belowFlightMeters;
  corridor.quaternion.setFromUnitVectors(
    FORWARD,
    viewpoint.worldFlightDirection ?? FORWARD,
  );
}
