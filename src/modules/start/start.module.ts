import type { WorldModule } from "../../world/module-runtime";
import type { StartParticleEffect } from "./start-particles.effect";
import {
  createStartPractice,
  type StartObservation,
  type StartPracticeOptions,
} from "./start-practice.runtime";

export type StartModuleHandle = Readonly<ReturnType<typeof createStartModule>>;

interface StartModuleOptions extends StartPracticeOptions {
  /** Composition selects the presentation; Start owns its complete lifetime. */
  readonly particles?: StartParticleEffect;
}

/** Bind practice and presentation to World, which owns activation and frame dispatch. */
export function createStartModule(options: StartModuleOptions) {
  const practice = createStartPractice(options);
  const { particles } = options;

  return {
    readObservation: (): StartObservation => practice.observation,
    setPlaying: practice.setPlaying,
    setFormationAllowed: practice.setFormationAllowed,
    setGoalAdvanceAllowed: practice.setGoalAdvanceAllowed,
    resetPractice: practice.resetPractice,
    module: {
      load: () => {
        practice.resetPractice();
        particles?.load();
      },
      activate: () => {
        practice.resetMotionHistory();
        particles?.setVisible(true);
      },
      update: (deltaSeconds: number) => {
        practice.update(deltaSeconds);
        particles?.update(practice.frame);
        practice.observation.objects = particles?.readObjectAnchors();
      },
      deactivate: () => {
        particles?.setVisible(false);
        practice.observation.objects = undefined;
      },
      unload: () => {
        particles?.unload();
        practice.observation.objects = undefined;
      },
    } satisfies WorldModule,
  };
}
