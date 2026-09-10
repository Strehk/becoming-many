import type {
  ExerciseAction,
  ExerciseFrame,
  ExerciseState,
} from "./start-contract";

// 1. Engine contract: lesson decisions only, no geometry or rendering dependencies
interface GameSettings {
  readonly exerciseCount: number;
  readonly retireSeconds: number;
}
export function createStartGame(settings: GameSettings) {
  return new StartGame(settings);
}

class StartGame {
  private state: ExerciseState = this.initialState();
  private exercisePassed = false;
  constructor(private readonly settings: GameSettings) {}
  readonly readState = (): Readonly<ExerciseState> => this.state;
  readonly reset = (): void => {
    this.state = this.initialState();
    this.exercisePassed = false;
  };

  private initialState(): ExerciseState {
    return {
      phase: "instruction",
      exerciseIndex: 0,
      attempt: 1,
      elapsedSeconds: 0,
    };
  }

  // 2. Success prepares the successor while the player traverses the exit area
  readonly update = (frame: ExerciseFrame): ExerciseAction => {
    this.state.elapsedSeconds += Math.max(0, frame.deltaSeconds);
    switch (this.state.phase) {
      case "instruction":
        if (!frame.instructionReleased || !frame.prepared) return;
        this.enterPhase("flying");
        return "show";
      case "recovering":
        if (this.state.elapsedSeconds >= this.settings.retireSeconds)
          this.enterPhase("instruction");
        return;
      case "flying":
        return this.observeExercise(frame);
      case "outro":
        return this.observeExit(frame);
    }
  };

  private observeExercise(frame: ExerciseFrame): ExerciseAction {
    if (frame.deviated || frame.progress === "missed")
      return this.recover(false);
    if (frame.progress === "passed") this.exercisePassed = true;
    if (!this.exercisePassed || !frame.instructionEnded) return;
    this.enterPhase("outro");
    return "prepare-next";
  }

  private observeExit(frame: ExerciseFrame): ExerciseAction {
    if (frame.deviated) return this.recover(true);
    if (!frame.reachedEnd || !frame.prepared) return;
    this.advanceExercise();
    this.enterPhase("flying");
    return "advance";
  }

  // 3. Recovery retains an unearned lesson; the demo sequence repeats continuously
  private recover(earned: boolean): ExerciseAction {
    if (earned) this.advanceExercise();
    else this.state.attempt++;
    this.enterPhase("recovering");
    return "recover";
  }

  private advanceExercise(): void {
    this.state.exerciseIndex =
      (this.state.exerciseIndex + 1) % this.settings.exerciseCount;
    this.state.attempt++;
  }

  private enterPhase(phase: ExerciseState["phase"]): void {
    if (phase === "flying") this.exercisePassed = false;
    this.state.phase = phase;
    this.state.elapsedSeconds = 0;
  }
}
