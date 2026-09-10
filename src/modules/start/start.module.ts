import { Vector3 } from "three";
import { ModuleRuntime, type WorldModule } from "../../world/module-runtime";
import {
  createFlightGuidance,
  type FlightGuidanceParameters,
} from "./flight-guidance";
import { connectFlightRoute } from "./flight-path/flight-connection";
import { createFlightDeviation } from "./flight-path/flight-deviation";
import { createFlightPath } from "./flight-path/flight-path";
import { createFlightProgress } from "./flight-path/flight-progress";
import { placeFlightRecovery } from "./flight-path/flight-recovery";
import { createFlightRoute } from "./flight-path/flight-route";
import type { PathParticleParameters } from "./flight-path/particle-contract";
import { createParticleGeneration } from "./flight-path/particle-generation";
import {
  createPathParticleGeometry,
  createPathParticleMaterial,
} from "./flight-path/path-particles";
import { createArrowShape } from "./particle-elements/arrow-shape";
import { placeElements } from "./particle-elements/element-placement";
import { createParticleAnimation } from "./particle-elements/particle-animation";
import type { ElementSource } from "./particle-elements/particle-contract";
import { createParticleElements } from "./particle-elements/particle-elements";
import { createParticleSimulation } from "./particle-elements/particle-simulation";
import {
  createVolumeMaterial,
  fillParticleVolume,
} from "./particle-elements/particle-volume";
import { createRingShape } from "./particle-elements/ring-shape";
import {
  type AirParticlesModuleOptions,
  createAirParticlesModule,
} from "./point-cloud/point-cloud.module";
import { createAirParticleMaterial } from "./point-cloud/point-cloud-material";
import type {
  ExerciseAction,
  ExerciseDefinition,
  ExerciseRoute,
  PlacedRoute,
} from "./start-contract";
import { START_EXERCISES, START_SETTINGS } from "./start-exercises";
import { createStartGame } from "./start-game.runtime";

// 1. Local star: all concrete connections and the fixed display pool live here
interface StartModuleOptions extends AirParticlesModuleOptions {
  readonly guidance: FlightGuidanceParameters;
  readonly constrainFlightPosition: (position: Vector3) => void;
}
type Display = ReturnType<typeof createFlightPath>;
interface PendingSection {
  readonly section: PlacedRoute;
  readonly generation: ReturnType<typeof createParticleGeneration>;
  readonly continuation: boolean;
  readonly elements: readonly ElementSource[];
  queued: boolean;
  display?: Display;
}
interface ActiveSection extends PlacedRoute {
  readonly display: Display;
  readonly exerciseProgress: ReturnType<typeof createFlightProgress>;
  readonly exitProgress: ReturnType<typeof createFlightProgress>;
  readonly deviation: ReturnType<typeof createFlightDeviation>;
}

export function createStartModule(options: StartModuleOptions): WorldModule {
  return new StartModule(options);
}

// 2. Lifetime and borrowed streaming resources
class StartModule implements WorldModule {
  private readonly runtime = new ModuleRuntime();
  private readonly generationKey = {};
  private readonly game = createStartGame({
    exerciseCount: START_EXERCISES.length,
    retireSeconds: START_SETTINGS.retireSeconds,
  });
  private readonly paths: readonly Display[];
  private readonly elements = new Map<
    Display,
    ReturnType<typeof createParticleElements>
  >();
  private readonly modules: readonly WorldModule[];
  private current: ActiveSection | undefined;
  private pending: PendingSection | undefined;
  private active = false;

  constructor(private readonly options: StartModuleOptions) {
    this.paths = Array.from({ length: 3 }, () =>
      createFlightPath({
        scene: options.scene,
        belowFlightMeters: START_SETTINGS.belowFlightMeters,
        createMaterial: () =>
          createPathParticleMaterial(createAirParticleMaterial),
      }),
    );
    for (const path of this.paths)
      this.elements.set(path, this.createElements());
    this.modules = [
      createAirParticlesModule(options),
      ...this.paths,
      ...this.elements.values(),
      createFlightGuidance({
        scene: options.scene,
        viewpoint: options.viewpoint,
        parameters: options.guidance,
        constrainFlightPosition: options.constrainFlightPosition,
      }),
    ];
  }

  private createElements() {
    return createParticleElements({
      scene: this.options.scene,
      belowFlightMeters: START_SETTINGS.belowFlightMeters,
      animationSettings: START_SETTINGS.elementAnimation,
      animation: createParticleAnimation(START_SETTINGS.elementAnimation),
      simulation: createParticleSimulation(START_SETTINGS.elementSimulation),
      readPosition: () => this.readPosition(),
      createGeometry: (shape) =>
        fillParticleVolume(
          createPathParticleGeometry(shape, START_SETTINGS.elementParticles),
          START_SETTINGS.elementVolume,
        ),
      createMaterial: () =>
        createVolumeMaterial(
          createPathParticleMaterial(createAirParticleMaterial),
        ),
    });
  }

  readonly load = (): void => {
    for (const module of this.modules) this.runtime.load(module);
  };
  readonly activate = (): void => {
    this.cancelPending();
    this.game.reset();
    this.current = undefined;
    this.active = true;
    for (const module of this.modules) this.runtime.activate(module);
    this.prepareSection(false);
  };
  readonly deactivate = (): void => {
    this.active = false;
    this.cancelPending();
    for (const module of this.modules) this.runtime.deactivate(module);
  };
  readonly unload = (): void => {
    this.active = false;
    this.cancelPending();
    this.current = undefined;
    const errors: unknown[] = [];
    for (const module of this.modules) {
      try {
        this.runtime.unload(module);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Start cleanup failed");
  };

  // 3. One coherent observation, followed by one engine decision
  readonly update = (deltaSeconds: number): void => {
    if (!this.active) return;
    this.enqueuePending();
    this.publishSuccessor();
    const state = this.game.readState();
    const position = this.readPosition();
    const action = this.game.update({
      deltaSeconds,
      progress: this.current?.exerciseProgress.update(position) ?? "pending",
      reachedEnd: this.current?.exitProgress.update(position) === "passed",
      deviated: this.current?.deviation.update(position) ?? false,
      prepared:
        state.phase === "outro"
          ? !!this.pending?.display
          : (this.pending?.generation.isReady() ?? false),
      instructionReleased:
        state.elapsedSeconds >= START_SETTINGS.demonstrationCueSeconds,
      instructionEnded: true,
    });
    this.applyAction(action);
    this.runtime.update(deltaSeconds);
  };

  private applyAction(action: ExerciseAction): void {
    if (action === "show") this.beginPreparedSection(false);
    if (action === "prepare-next") this.prepareSection(true);
    if (action === "advance") this.beginPreparedSection(true);
    if (action === "recover") {
      for (const path of this.paths) this.retireDisplay(path);
      this.current = undefined;
      this.prepareSection(false);
    }
  }

  // 4. Small cancellable jobs run on World's existing StreamQueue
  private prepareSection(continuation: boolean): void {
    this.cancelPending();
    const state = this.game.readState();
    const index =
      (state.exerciseIndex + Number(continuation)) % START_EXERCISES.length;
    const exercise = START_EXERCISES[index];
    if (!exercise) return;
    const attempt = state.attempt + Number(continuation);
    const route = createFlightRoute(
      exercise.route,
      START_SETTINGS.seed + attempt,
    );
    const pose =
      continuation && this.current
        ? connectFlightRoute(this.current, route)
        : { position: new Vector3(), yawRadians: 0 };
    const generation = this.createGeneration(
      route,
      exercise.particles,
      attempt,
    );
    this.pending = {
      section: { route, pose },
      generation,
      continuation,
      elements: this.createElementSources(route, exercise),
      queued: false,
    };
    this.enqueuePending();
  }

  private createElementSources(
    route: ExerciseRoute,
    exercise: ExerciseDefinition,
  ): ElementSource[] {
    return placeElements(route, exercise.elements).map((placement) => ({
      placement,
      shape:
        placement.kind === "ring"
          ? createRingShape(exercise.elements.ringRadiusMeters)
          : createArrowShape(exercise.elements.arrowLengthMeters),
    }));
  }

  private createGeneration(
    route: ExerciseRoute,
    parameters: PathParticleParameters,
    attempt: number,
  ) {
    return createParticleGeneration({
      route,
      maximumDensity: parameters.densityPerMeter.to,
      metersPerStep: START_SETTINGS.generationMetersPerStep,
      createSlice: (slice, index) =>
        createPathParticleGeometry(slice, {
          ...parameters,
          seed: parameters.seed + attempt + index,
        }),
    });
  }

  private enqueuePending(): void {
    const pending = this.pending;
    if (!pending || pending.queued || pending.generation.isReady()) return;
    pending.queued = this.options.streamQueue.enqueue({
      key: this.generationKey,
      isCurrent: () => this.active && this.pending === pending,
      runStep: pending.generation.step,
    });
  }

  private cancelPending(): void {
    this.pending?.generation.dispose();
    this.pending = undefined;
  }

  // 5. Show a prepared successor without moving the current route
  private publishSuccessor(): void {
    const pending = this.pending;
    if (
      !pending?.continuation ||
      pending.display ||
      !pending.generation.isReady()
    )
      return;
    const display = this.paths.find((path) => !path.isVisible());
    if (!display) return;
    display.show(
      pending.generation.takeGeometry(),
      pending.section.pose,
      START_SETTINGS.revealSeconds,
    );
    this.elements.get(display)?.show(pending.elements, pending.section.pose);
    pending.display = display;
  }

  private beginPreparedSection(connected: boolean): void {
    const pending = this.pending;
    if (!pending) return;
    const display =
      pending.display ?? this.paths.find((path) => !path.isVisible());
    if (!display) return;
    const pose = connected
      ? pending.section.pose
      : placeFlightRecovery(
          this.options.viewpoint,
          START_SETTINGS.entryLeadMeters,
          this.options.constrainFlightPosition,
        );
    if (!pending.display) {
      display.show(
        pending.generation.takeGeometry(),
        pose,
        START_SETTINGS.revealSeconds,
      );
      this.elements.get(display)?.show(pending.elements, pose);
    }
    if (connected && this.current) this.retireDisplay(this.current.display);
    this.current = this.observeSection({ ...pending.section, pose }, display);
    this.pending = undefined;
  }

  private retireDisplay(display: Display): void {
    display.retire(START_SETTINGS.retireSeconds);
    this.elements.get(display)?.dissolve();
  }

  private observeSection(
    section: PlacedRoute,
    display: Display,
  ): ActiveSection {
    const exercise = START_EXERCISES[this.game.readState().exerciseIndex];
    if (!exercise) throw new Error("Unknown Start exercise");
    const exerciseRoute = {
      ...section.route,
      lengthMeters: section.route.exerciseEndMeters,
    };
    const exerciseProgress = createFlightProgress(
      exerciseRoute,
      section.pose,
      exercise.progress,
    );
    const exitProgress = createFlightProgress(
      section.route,
      section.pose,
      exercise.progress,
    );
    const deviation = createFlightDeviation(
      section,
      this.readPosition(),
      exercise.deviation,
    );
    return { ...section, display, exerciseProgress, exitProgress, deviation };
  }

  private readPosition(): Readonly<Vector3> {
    return (
      this.options.viewpoint.worldFlightPosition ??
      this.options.viewpoint.worldPosition
    );
  }
}
