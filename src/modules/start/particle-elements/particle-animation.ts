import type { AnimationSettings, ParticleAnimation } from "./particle-contract";

// 1. Shape-independent reversible envelope
/** Return presence in [0,1]; reversing a fade never jumps in opacity or scatter. */
export function createParticleAnimation(
  settings: AnimationSettings,
): ParticleAnimation {
  let presence = 0;
  let target = 0;
  return {
    reset: () => {
      presence = 0;
      target = 0;
    },
    reveal: () => {
      target = 1;
    },
    dissolve: () => {
      target = 0;
    },
    update: (seconds) => {
      const duration = target
        ? settings.revealSeconds
        : settings.dissolveSeconds;
      const step = duration > 0 ? Math.max(0, seconds) / duration : 1;
      presence +=
        Math.sign(target - presence) *
        Math.min(Math.abs(target - presence), step);
      return presence * presence * (3 - 2 * presence);
    },
    isFinished: () => target === 0 && presence === 0,
  };
}
