import type {
  ExerciseAction,
  ExerciseFrame,
  ExerciseState,
} from "./start-contract";

// 1. Engine construction
interface GameSettings {
  readonly exerciseCount: number;
  readonly retireSeconds: number;
}

/** Own lesson decisions only; the center executes returned actions. */
export function createStartGame(settings: GameSettings) {
  return new StartGame(settings);
}

// 2. State and reset
class StartGame {
  private state: ExerciseState = this.initialState();
  constructor(private readonly settings: GameSettings) {}

  readonly readState = (): Readonly<ExerciseState> => this.state;
  readonly reset = (): void => {
    this.state = this.initialState();
  };

  private initialState(): ExerciseState {
    return {
      phase: "instruction",
      exerciseIndex: 0,
      attempt: 1,
      elapsedSeconds: 0,
      outcome: "pending",
    };
  }

  // 3. One phase transition per frame
  readonly update = (frame: ExerciseFrame): ExerciseAction => {
    this.state.elapsedSeconds += Math.max(0, frame.deltaSeconds);
    switch (this.state.phase) {
      case "instruction":
        if (!frame.instructionReleased) return;
        this.enterPhase("flying");
        return "show";
      case "flying":
        return this.observeFlight(frame);
      case "retiring":
        if (this.state.elapsedSeconds >= this.settings.retireSeconds)
          this.finishAttempt();
        return;
      case "complete":
        return;
    }
  };

  private observeFlight(frame: ExerciseFrame): ExerciseAction {
    if (this.state.outcome === "pending") this.state.outcome = frame.progress;
    if (this.state.outcome === "pending" || !frame.instructionEnded) return;
    this.enterPhase("retiring");
    return "retire";
  }

  // 4. Retry and course completion
  private finishAttempt(): void {
    if (this.state.outcome === "passed") this.state.exerciseIndex++;
    this.state.attempt++;
    this.state.outcome = "pending";
    this.enterPhase(
      this.state.exerciseIndex < this.settings.exerciseCount
        ? "instruction"
        : "complete",
    );
  }

  private enterPhase(phase: ExerciseState["phase"]): void {
    this.state.phase = phase;
    this.state.elapsedSeconds = 0;
  }
}
