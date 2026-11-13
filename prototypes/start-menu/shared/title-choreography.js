/**
 * Purpose: Turn particles into the title and the title back into particles.
 * Context: When loading completes, every particle of the swarm flies into the
 *   strokes of "Becoming Many"; once they have landed the set Rubik type takes
 *   over and the particles fade into it. Leaving the menu dissolves the title
 *   into the air again; coming back gathers it anew.
 * Responsibility: Size the swarm to the title, gather, hand over, dissolve.
 * Boundary: The loading figure before the gather belongs to the variant.
 */

import { sampleTextFormation } from "./title-swarm.js";

const wait = (seconds) =>
  new Promise((resolve) => window.setTimeout(resolve, seconds * 1000));

/** On-screen particle size that keeps the strokes legible at this type size. */
export function particlePixelsFor(title) {
  const fontSize = Number.parseFloat(getComputedStyle(title).fontSize) || 64;
  return Math.min(4.6, Math.max(2.2, fontSize * 0.04));
}

export function bindTitle({ menu, swarm, title, timing = {} }) {
  // Screens below the title read where it ends, through --title-bottom.
  const root = document.documentElement;
  const mark = () =>
    root.style.setProperty(
      "--title-bottom",
      `${Math.round(title.getBoundingClientRect().bottom)}px`,
    );
  mark();
  window.addEventListener("resize", mark);
  document.fonts.ready.then(mark);

  const gatherStagger = timing.gatherStagger ?? 1.1;
  const travelSeconds = timing.travelSeconds ?? 1.7;
  // How long the finished particle title holds before the type takes over.
  const holdSeconds = timing.holdSeconds ?? 0.7;
  const handoverSeconds = timing.handoverSeconds ?? 0.9;
  const titleScreens = timing.screens ?? ["loading", "menu"];
  let shown = false;
  let generation = 0;

  const textFormation = () =>
    sampleTextFormation(title, { step: swarm.pixelSize * 1.12 });

  function size() {
    swarm.pixelSize = particlePixelsFor(title);
  }
  size();

  async function gather({ stagger = gatherStagger } = {}) {
    const run = ++generation;
    size();
    const formation = textFormation();
    formation.onResize = () => {
      if (swarm.formation !== formation || shown) return;
      size();
      swarm.form(textFormation(), { order: "now" });
    };
    swarm.fade(1, 0.3);
    swarm.form(formation, { stagger, travel: travelSeconds });
    await wait(stagger + travelSeconds + holdSeconds);
    if (run !== generation) return;
    // The set type takes over the strokes the particles are holding.
    title.classList.add("is-set");
    swarm.fade(0, handoverSeconds);
    shown = true;
    await wait(handoverSeconds);
    if (run !== generation) return;
    swarm.release({ stiffness: 4 });
    await wait(1.4);
    if (run !== generation) return;
    swarm.fade(1, 1.6);
  }

  async function dissolve() {
    const run = ++generation;
    if (!shown) {
      swarm.release();
      swarm.fade(1, 0.4);
      return;
    }
    shown = false;
    size();
    swarm.form(textFormation(), { order: "now" });
    swarm.snap();
    swarm.fade(1, 0.12);
    await wait(0.12);
    if (run !== generation) return;
    title.classList.remove("is-set");
    swarm.release({ stiffness: 1.1 });
  }

  /** Set the title without particles (?skip). */
  function setAtOnce() {
    generation += 1;
    title.classList.add("is-set");
    shown = true;
  }

  menu.on("screen", (screen, previous) => {
    if (!menu.ready) return;
    const wants = titleScreens.includes(screen);
    const had = titleScreens.includes(previous);
    // A newer call cancels an older one through the generation counter.
    if (wants && !had) gather({ stagger: 0.55 });
    else if (!wants && had) dissolve();
  });

  return {
    gather,
    dissolve,
    setAtOnce,
    get shown() {
      return shown;
    },
  };
}
