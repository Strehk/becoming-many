/**
 * Purpose: The two generative figures the melodic voices play, as pure
 *   functions of the step they are asked for.
 * Context: A random walk and a mutating loop are both cumulative by nature.
 *   Replaying them from step zero keeps their character and makes any step's
 *   note derivable from show time alone — which is what lets a seek land on
 *   the note playing through would have reached.
 * Responsibility: Own the walk, the loop memory, its mutation, and the replay.
 * Boundary: Which instrument sounds the degree, and when, belongs to the voice.
 */

import { stepRandom } from "../organ-random";

/** Step sizes drawn per tick: small moves are likelier than leaps. */
const WALK_STEPS = [-2, -1, -1, 0, 1, 1, 2] as const;

/** Steps held in memory; `length` decides how many of them are played. */
const SEQUENCE_CAPACITY = 16;

/** How many steps a full turn may rewrite, at mutation 1. */
const MUTATION_REACH = 0.3;

/** Scale degrees a mutating step may move by. */
const MUTATION_STEPS = [-2, -1, 1, 2] as const;

/** Hash channels, so one step's several draws never repeat one another. */
const CHANNEL = {
  walkStart: 0,
  walkMove: 1,
  slotDegree: 2,
  slotOpen: 3,
  slotThreshold: 4,
  mutate: 5,
  mutateKind: 6,
  mutateMove: 7,
} as const;

export interface DerivedWalk {
  /** The scale degree the walk stands on at a step, within `0..span - 1`. */
  readonly degreeAt: (stepIndex: number) => number;
}

/**
 * A random walk over `span` degrees. The degree at step k is the sum of k
 * hashed moves from a hashed start, replayed forward from the last step asked
 * for — one move per step while playing, the whole path again after a seek
 * backward.
 */
export function createDerivedWalk(span: number, salt: number): DerivedWalk {
  const start = Math.floor(stepRandom(0, CHANNEL.walkStart, salt) * span);
  let knownStep = -1;
  let degree = start;

  return {
    degreeAt: (stepIndex): number => {
      if (stepIndex < knownStep) {
        knownStep = -1;
        degree = start;
      }
      while (knownStep < stepIndex) {
        knownStep += 1;
        const draw = stepRandom(knownStep, CHANNEL.walkMove, salt);
        const move = WALK_STEPS[Math.floor(draw * WALK_STEPS.length)] ?? 0;
        degree = Math.max(0, Math.min(span - 1, degree + move));
      }
      return degree;
    },
  };
}

interface SequenceSlot {
  degree: number;
  isOpen: boolean;
  /** Fixed threshold: density picks a subset of slots rather than dicing each. */
  threshold: number;
}

export interface DerivedSequenceSettings {
  readonly span: number; // Degrees the sequence draws from.
  readonly length: number; // Slots before the loop turns over.
  readonly density: number; // 0..1 share of slots that sound.
  readonly mutation: number; // 0..1 how much a turn rewrites.
  readonly salt: number;
}

export interface DerivedSequence {
  /** The degree sounding at a step, or undefined where the step is silent. */
  readonly degreeAt: (stepIndex: number) => number | undefined;
}

/**
 * A short locked loop that rewrites a little of itself on every turn. The
 * memory at turn T is the hashed initial memory with T hashed mutations
 * applied, replayed forward from the last turn asked for.
 */
export function createDerivedSequence(
  settings: DerivedSequenceSettings,
): DerivedSequence {
  const { span, salt } = settings;
  const length = Math.max(2, Math.min(SEQUENCE_CAPACITY, settings.length));
  const slots: SequenceSlot[] = [];
  let knownTurn = -1;

  function resetMemory(): void {
    slots.length = 0;
    for (let slot = 0; slot < SEQUENCE_CAPACITY; slot += 1) {
      slots.push({
        degree: Math.floor(stepRandom(slot, CHANNEL.slotDegree, salt) * span),
        isOpen: stepRandom(slot, CHANNEL.slotOpen, salt) < 0.75,
        threshold: stepRandom(slot, CHANNEL.slotThreshold, salt),
      });
    }
    knownTurn = 0;
  }

  function mutate(turn: number): void {
    slots.forEach((slot, index) => {
      const draw = turn * SEQUENCE_CAPACITY + index;
      if (
        stepRandom(draw, CHANNEL.mutate, salt) >=
        settings.mutation * MUTATION_REACH
      ) {
        return;
      }

      if (stepRandom(draw, CHANNEL.mutateKind, salt) < 0.65) {
        const moveDraw = stepRandom(draw, CHANNEL.mutateMove, salt);
        const move =
          MUTATION_STEPS[Math.floor(moveDraw * MUTATION_STEPS.length)] ?? 0;
        slot.degree = Math.max(0, Math.min(span - 1, slot.degree + move));
      } else {
        slot.isOpen = !slot.isOpen;
      }
    });
  }

  resetMemory();

  return {
    degreeAt: (stepIndex): number | undefined => {
      if (settings.density <= 0.02) return undefined;

      const turn = Math.floor(stepIndex / length);
      if (turn < knownTurn) resetMemory();
      while (knownTurn < turn) {
        knownTurn += 1;
        if (settings.mutation > 0) mutate(knownTurn);
      }

      const slot = slots[stepIndex - turn * length];
      if (!slot?.isOpen || slot.threshold > settings.density) {
        return undefined;
      }
      return Math.min(slot.degree, span - 1);
    },
  };
}
