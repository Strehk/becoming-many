import { Vector3 } from "three";
import { ModuleRuntime, type WorldModule } from "../../world/module-runtime";
import {
  createFlightGuidance,
  type FlightGuidanceParameters,
} from "./flight-guidance";
import { createFlightPath } from "./flight-path/flight-path";
import { createFlightProgress } from "./flight-path/flight-progress";
import { createFlightRoute } from "./flight-path/flight-route";
import {
  createPathParticleGeometry,
  createPathParticleMaterial,
} from "./flight-path/path-particles";
import {
  type AirParticlesModuleOptions,
  createAirParticlesModule,
} from "./point-cloud/point-cloud.module";
import { createAirParticleMaterial } from "./point-cloud/point-cloud-material";
import type { ExercisePose } from "./start-contract";
import { START_EXERCISES, START_SETTINGS } from "./start-exercises";
import { createStartGame } from "./start-game.runtime";

// 1. Center of the local star
// Only this file connects concrete leaves. World and Control remain external owners.
interface StartModuleOptions extends AirParticlesModuleOptions {
  readonly guidance: FlightGuidanceParameters;
  readonly constrainFlightPosition: (position: Vector3) => void;
}

export function createStartModule(options: StartModuleOptions): WorldModule {
  return new StartModule(options);
}

// 2. Construction and lifecycle
class StartModule implements WorldModule {
  private readonly runtime = new ModuleRuntime();
  private readonly game = createStartGame({
    exerciseCount: START_EXERCISES.length,
    retireSeconds: START_SETTINGS.retireSeconds,
  });
  private readonly path: ReturnType<typeof createFlightPath>;
  private readonly modules: readonly WorldModule[];
  private progress: ReturnType<typeof createFlightProgress> | undefined;

  constructor(private readonly options: StartModuleOptions) {
    this.path = createFlightPath({
      scene: options.scene,
      belowFlightMeters: START_SETTINGS.belowFlightMeters,
      createMaterial: () =>
        createPathParticleMaterial(createAirParticleMaterial),
    });
    this.modules = [
      createAirParticlesModule(options),
      this.path,
      createFlightGuidance({
        scene: options.scene,
        viewpoint: options.viewpoint,
        parameters: options.guidance,
        constrainFlightPosition: options.constrainFlightPosition,
      }),
    ];
  }

  readonly load = (): void => {
    for (const module of this.modules) this.runtime.load(module);
  };

  readonly activate = (): void => {
    this.game.reset();
    this.progress = undefined;
    for (const module of this.modules) this.runtime.activate(module);
  };

  readonly deactivate = (): void => {
    for (const module of this.modules) this.runtime.deactivate(module);
  };

  readonly unload = (): void => {
    const errors: unknown[] = [];
    for (const module of this.modules) {
      try {
        this.runtime.unload(module);
      } catch (error) {
        errors.push(error);
      }
    }
    this.progress = undefined;
    if (errors.length) throw new AggregateError(errors, "Start cleanup failed");
  };

  // 3. Observation and decision wiring
  // The temporary cue adapter can later read native audio instead of phase time.
  readonly update = (deltaSeconds: number): void => {
    const state = this.game.readState();
    const viewpoint = this.options.viewpoint;
    const position = viewpoint.worldFlightPosition ?? viewpoint.worldPosition;
    const progress =
      state.phase === "flying" ? this.progress?.update(position) : undefined;
    const action = this.game.update({
      deltaSeconds,
      progress: progress ?? "pending",
      instructionReleased:
        state.elapsedSeconds >= START_SETTINGS.demonstrationCueSeconds,
      instructionEnded: true,
    });
    if (action === "show") this.showAttempt();
    if (action === "retire") this.path.retire(START_SETTINGS.retireSeconds);
    this.runtime.update(deltaSeconds);
  };

  // 4. Generate one attempt and share its geometry with progress and presentation
  private showAttempt(): void {
    const state = this.game.readState();
    const exercise = START_EXERCISES[state.exerciseIndex];
    if (!exercise) return;
    const route = createFlightRoute(
      exercise.route,
      START_SETTINGS.seed + state.attempt,
    );
    const pose = this.capturePose();
    this.progress = createFlightProgress(route, pose, exercise.progress);
    const geometry = createPathParticleGeometry(route, {
      ...exercise.particles,
      seed: exercise.particles.seed + state.attempt,
    });
    this.path.show(geometry, pose);
  }

  private capturePose(): ExercisePose {
    const { viewpoint } = this.options;
    const direction = viewpoint.worldFlightDirection;
    return {
      position: new Vector3().copy(
        viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
      ),
      yawRadians: direction ? Math.atan2(-direction.x, -direction.z) : 0,
    };
  }
}
