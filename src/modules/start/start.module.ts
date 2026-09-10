import { ModuleRuntime, type WorldModule } from "../../world/module-runtime";
import {
  createFlightGuidance,
  type FlightGuidanceParameters,
} from "./flight-guidance";
import {
  type AirParticlesModuleOptions,
  createAirParticlesModule,
} from "./point-cloud/point-cloud.module";

// 1. Center of the local star

// Level Composition constructs Start. World supplies its lifecycle and sole loop.
// This file alone connects Start's concrete leaves. Leaves do not import each other
// or this center. They receive borrowed World facts and own their graphics resources.

interface StartModuleOptions extends AirParticlesModuleOptions {
  readonly guidance: FlightGuidanceParameters;
}

// 2. Presentation and lifetime

/** Own the particle environment and flight guide within one World module lifetime. */
export function createStartModule(options: StartModuleOptions): WorldModule {
  const runtime = new ModuleRuntime();
  const modules = [
    createAirParticlesModule(options),
    createFlightGuidance({
      scene: options.scene,
      viewpoint: options.viewpoint,
      parameters: options.guidance,
    }),
  ];
  return new StartModule(runtime, modules);
}

class StartModule implements WorldModule {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly modules: readonly WorldModule[],
  ) {}

  readonly load = (): void => {
    for (const module of this.modules) this.runtime.load(module);
  };

  readonly activate = (): void => {
    for (const module of this.modules) this.runtime.activate(module);
  };

  readonly update = (deltaSeconds: number): void => {
    this.runtime.update(deltaSeconds);
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
    if (errors.length) throw new AggregateError(errors, "Start cleanup failed");
  };
}

// 3. Exercise architecture

// start-game.runtime.ts owns exercise decisions and progress.
// start-chunks.ts owns procedural geometry and passage facts.
// start-audio-cues.ts describes recording bindings and spoken markers.
// These outlines remain inactive. Their future connections pass through this center.
// Control remains the sole owner of movement; Show and Sound own playback.
