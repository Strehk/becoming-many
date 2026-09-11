import type {
  ExerciseAction,
  ExerciseFrame,
  ExerciseState,
} from "./start-contract";

// 1. Engine contract: lesson decisions only, no geometry or rendering dependencies
interface GameSettings {
  readonly exerciseCount: number;
  readonly repeatSequence?: boolean;
  readonly retireSeconds: number;
}
export function createStartGame(settings: GameSettings) {
  return new StartGame(settings);
}

class StartGame {
  private state: ExerciseState = this.initialState();
  private exercisePassed = false;
  private completedChunks = 0;
  constructor(private readonly settings: GameSettings) {}
  readonly readState = (): Readonly<ExerciseState> => this.state;
  readonly readProgress = () => ({
    completedChunks: this.completedChunks,
    totalChunks: this.settings.exerciseCount,
    phase:
      this.state.phase === "closing" || this.state.phase === "complete"
        ? ("closing" as const)
        : ("active" as const),
  });
  /** Deadline completion needs no further passage and never repeats the closing voice. */
  readonly finishExercises = (): ExerciseAction => {
    const phase = this.state.phase;
    if (phase === "complete") return;
    this.enterPhase("complete");
    return phase === "closing" ? undefined : "complete";
  };
  readonly reset = (): void => {
    this.state = this.initialState();
    this.completedChunks = 0;
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

  // 2. The ring goal starts the successor immediately; preparation and its cue gate activation.
  readonly update = (frame: ExerciseFrame): ExerciseAction => {
    this.state.elapsedSeconds += Math.max(0, frame.deltaSeconds);
    switch (this.state.phase) {
      case "instruction":
        if (frame.deviated) return this.recover(false);
        if (!frame.instructionReleased || !frame.prepared) return;
        this.enterPhase("flying");
        return "show";
      case "recovering":
        if (this.state.elapsedSeconds >= this.settings.retireSeconds)
          this.enterPhase("instruction");
        return;
      case "flying":
        return this.observeExercise(frame);
      case "closing":
        if (!frame.reachedEnd) return;
        this.enterPhase("complete");
        return "finish";
      case "complete":
        return;
      case "outro":
        return this.observeExit(frame);
    }
  };

  private observeExercise(frame: ExerciseFrame): ExerciseAction {
    if (frame.deviated && !this.exercisePassed) return this.recover(false);
    if (frame.progress === "passed" && !this.exercisePassed) {
      this.exercisePassed = true;
      this.completedChunks = Math.min(
        this.settings.exerciseCount,
        this.completedChunks + 1,
      );
    }
    if (!this.exercisePassed) return;
    if (
      this.settings.repeatSequence === false &&
      this.state.exerciseIndex === this.settings.exerciseCount - 1
    ) {
      this.enterPhase("closing");
      return "complete";
    }
    this.enterPhase("outro");
    return "prepare-next";
  }

  private observeExit(frame: ExerciseFrame): ExerciseAction {
    if (frame.deviated) return this.recover(true);
    if (!frame.prepared || !frame.instructionReleased) return;
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
