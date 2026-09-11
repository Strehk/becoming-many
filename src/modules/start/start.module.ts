import { Vector3 } from "three";
import { ModuleRuntime, type WorldModule } from "../../world/module-runtime";
import type { StartAudio } from "./audio/audio-contract";
import {
  createFlightGuidance,
  type FlightGuidanceParameters,
} from "./flight-guidance";
import { connectFlightRoute } from "./flight-path/flight-connection";
import { createFlightCourse } from "./flight-path/flight-course";
import { createFlightDeviation } from "./flight-path/flight-deviation";
import {
  createFlightEntry,
  prependFlightEntry,
} from "./flight-path/flight-entry";
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
import { createPathRevealMaterial } from "./flight-path/path-reveal";
import { createArrowStroke } from "./particle-elements/arrow-shape";
import { placeElements } from "./particle-elements/element-placement";
import { createElementRetirement } from "./particle-elements/element-retirement";
import { placeEntryArrow } from "./particle-elements/entry-arrow";
import {
  createElementReveal,
  createParticleAnimation,
} from "./particle-elements/particle-animation";
import type {
  ElementRetirement,
  ElementSource,
  ParticleLight,
  RingPassage,
  RingTarget,
} from "./particle-elements/particle-contract";
import { createParticleElements } from "./particle-elements/particle-elements";
import { createParticleLight } from "./particle-elements/particle-light";
import { createParticleSimulation } from "./particle-elements/particle-simulation";
import {
  createVolumeMaterial,
  fillParticleVolume,
} from "./particle-elements/particle-volume";
import { createRingPassage } from "./particle-elements/ring-passage";
import { createRingShape } from "./particle-elements/ring-shape";
import {
  type AirParticlesModuleOptions,
  createAirParticlesModule,
} from "./point-cloud/point-cloud.module";
import { createAirParticleMaterial } from "./point-cloud/point-cloud-material";
import type {
  ExerciseAction,
  ExerciseDefinition,
  ExercisePose,
  ExerciseRoute,
  PlacedRoute,
  StartExperience,
  StartVoice,
} from "./start-contract";
import {
  START_EXERCISES,
  START_SETTINGS,
  START_TIMING,
} from "./start-exercises";
import { createStartGame } from "./start-game.runtime";
import { samplePathPresence, sampleWorldPresence } from "./start-sequence";
import { StartTiming } from "./start-timing";

// 1. Local star: all concrete connections and the fixed display pool live here
interface StartModuleOptions extends AirParticlesModuleOptions {
  readonly voice?: StartVoice;
  readonly atmosphere?: StartAudio;
  readonly guidance: FlightGuidanceParameters;
  readonly constrainFlightPosition: (position: Vector3) => void;
}
type Display = ReturnType<typeof createFlightPath>;
type ElementDisplay = ReturnType<typeof createParticleElements>;
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

export function createStartModule(
  options: StartModuleOptions,
): StartExperience {
  return new StartModule(options);
}

// 2. Lifetime and borrowed streaming resources
class StartModule implements StartExperience {
  private readonly runtime = new ModuleRuntime();
  private readonly generationKey = {};
  private readonly noFlightDirection = new Vector3();
  private readonly game: ReturnType<typeof createStartGame>;
  private readonly timing = new StartTiming(START_TIMING);
  private readonly paths: readonly Display[];
  private readonly elements: readonly ElementDisplay[];
  private readonly bindings = new Map<Display, ElementDisplay>();
  private readonly feedback = new Map<
    ElementDisplay,
    {
      light: ParticleLight;
      passage: RingPassage;
      reveal: ReturnType<typeof createElementReveal>;
      retirement: ElementRetirement;
      presence: Float32Array;
    }
  >();
  private readonly retiringPaths = new Map<Display, Vector3>();
  private readonly course = createFlightCourse(connectFlightRoute);
  private readonly relative = new Vector3();
  private entry: (PlacedRoute & { display: Display }) | undefined;
  private recoveryEntryNeeded = false;
  private readonly modules: readonly WorldModule[];
  private current: ActiveSection | undefined;
  private pending: PendingSection | undefined;
  private active = false;
  private worldPresence = 1;
  private presence = 1;
  private pathPresence = 1;
  private openingNeeded = false;

  constructor(private readonly options: StartModuleOptions) {
    this.game = createStartGame({
      exerciseCount: START_EXERCISES.length,
      repeatSequence: !options.voice,
      retireSeconds: START_SETTINGS.retireSeconds,
    });
    this.paths = this.createPaths();
    this.elements = Array.from({ length: START_SETTINGS.elementPoolSize }, () =>
      this.createElements(),
    );
    this.modules = this.createModules();
  }

  private createPaths(): Display[] {
    return Array.from({ length: START_SETTINGS.pathPoolSize }, () =>
      createFlightPath({
        scene: this.options.scene,
        belowFlightMeters: START_SETTINGS.belowFlightMeters,
        opacity: START_SETTINGS.pathOpacity,
        growth: START_SETTINGS.pathGrowth,
        readPresence: () => this.pathPresence * this.presence,
        createMaterial: () =>
          createPathRevealMaterial(
            createPathParticleMaterial(createAirParticleMaterial),
            START_SETTINGS.pathGrowth.softEdgeMeters,
          ),
      }),
    );
  }

  private createModules(): WorldModule[] {
    return [
      createAirParticlesModule({
        ...this.options,
        readPresence: () => this.worldPresence * this.presence,
      }),
      ...this.paths,
      ...this.elements,
      ...(START_SETTINGS.showFlightGuidance
        ? [
            createFlightGuidance({
              scene: this.options.scene,
              viewpoint: this.options.viewpoint,
              parameters: this.options.guidance,
              constrainFlightPosition: this.options.constrainFlightPosition,
            }),
          ]
        : []),
    ];
  }

  private createElements() {
    const feedback = this.createFeedback();
    const { light, retirement, reveal } = feedback;
    const display = createParticleElements({
      light,
      reveal,
      retirement,
      readDirection: () =>
        this.options.viewpoint.worldFlightDirection ?? this.noFlightDirection,
      grainsPerSample: START_SETTINGS.elementVolume.grainsPerSample,
      scene: this.options.scene,
      belowFlightMeters: START_SETTINGS.belowFlightMeters,
      animationSettings: START_SETTINGS.elementAnimation,
      animation: createParticleAnimation(START_SETTINGS.elementAnimation),
      simulation: createParticleSimulation(START_SETTINGS.elementSimulation),
      readPosition: () => this.readPosition(),
      readPresence: () => this.presence,
      createGeometry: this.createElementGeometry,
      createMaterial: () =>
        this.createElementMaterial(light, retirement, reveal.presence),
    });
    this.feedback.set(display, feedback);
    return display;
  }

  private createFeedback() {
    return {
      light: createParticleLight(START_SETTINGS.elementLight),
      passage: createRingPassage(
        START_SETTINGS.elementPassage.maximumStepMeters,
      ),
      retirement: createElementRetirement(START_SETTINGS.elementRetirement),
      reveal: createElementReveal(START_SETTINGS.elementReveal),
      presence: new Float32Array(START_SETTINGS.elementReveal.capacity),
    };
  }

  private createElementMaterial(
    light: ParticleLight,
    retirement: ElementRetirement,
    reveal: Float32Array,
  ) {
    return createVolumeMaterial(
      createPathParticleMaterial(createAirParticleMaterial),
      START_SETTINGS.elementVolume,
      {
        settings: START_SETTINGS.elementLight,
        animation: light,
        retirement,
        reveal,
        wind: START_SETTINGS.elementWind,
      },
    );
  }

  private readonly createElementGeometry = (
    shape: ElementSource["shape"],
    kind: "ring" | "arrow",
  ) =>
    fillParticleVolume(
      createPathParticleGeometry(shape, START_SETTINGS.elementParticles),
      kind === "arrow"
        ? { ...START_SETTINGS.elementVolume, ...START_SETTINGS.arrowVolume }
        : START_SETTINGS.elementVolume,
    );

  readonly load = (): void => {
    for (const module of this.modules) this.runtime.load(module);
  };
  readonly activate = (): void => {
    for (const { passage } of this.feedback.values())
      passage.reset([], this.readPosition());
    this.cancelPending();
    this.game.reset();
    this.timing.reset();
    this.current = undefined;
    this.bindings.clear();
    this.retiringPaths.clear();
    this.course.clear();
    this.entry = undefined;
    this.recoveryEntryNeeded = false;
    this.worldPresence = this.options.voice ? 0 : 1;
    this.pathPresence = this.worldPresence;
    this.openingNeeded = true;
    this.active = true;
    this.presence = 1;
    for (const module of this.modules) this.runtime.activate(module);
    this.playInstruction(false);
    this.updateOpening();
  };
  readonly deactivate = (): void => {
    this.active = false;
    this.stopAtmosphere();
    this.options.voice?.stop();
    this.bindings.clear();
    this.retiringPaths.clear();
    this.course.clear();
    this.entry = undefined;
    this.recoveryEntryNeeded = false;
    for (const { passage } of this.feedback.values())
      passage.reset([], this.readPosition());
    this.cancelPending();
    for (const module of this.modules) this.runtime.deactivate(module);
  };
  readonly unload = (): void => {
    this.active = false;
    this.stopAtmosphere();
    this.options.voice?.stop();
    this.bindings.clear();
    this.retiringPaths.clear();
    this.course.clear();
    this.entry = undefined;
    this.recoveryEntryNeeded = false;
    for (const { passage } of this.feedback.values())
      passage.reset([], this.readPosition());
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
    this.options.atmosphere?.unload();
    if (errors.length) throw new AggregateError(errors, "Start cleanup failed");
  };

  /** Passage or the deadline ends exercises; the closing recording must finish naturally. */
  readonly readComplete = (): boolean => {
    const voice = this.options.voice?.read();
    return (
      this.active &&
      this.game.readState().phase === "complete" &&
      !!voice &&
      voice.ended &&
      !voice.failed
    );
  };

  readonly setPresence = (presence: number): void => {
    this.presence = Number.isFinite(presence)
      ? Math.max(0, Math.min(1, presence))
      : 0;
  };

  // 3. One coherent observation, followed by one engine decision
  readonly update = (deltaSeconds: number): void => {
    if (!this.active) return;
    this.timing.update(
      deltaSeconds,
      this.options.voice?.read().offsetSeconds ?? 0,
    );
    this.updateOpening();
    this.updateRetiredPaths();
    this.resumeRecovery();
    this.enqueuePending();
    this.publishPreparedPath();
    const position = this.readPosition();
    this.applyAction(this.observeFlight(deltaSeconds));
    for (const { light, passage } of this.feedback.values())
      for (const index of passage.update(position)) light.pass(index);
    this.runtime.update(deltaSeconds);
    this.updateAtmosphere();
  };

  // Capture the moving player after "Anfang"; the surrounding room has its own cue.
  private updateOpening(): void {
    const first = START_EXERCISES[0];
    if (
      this.options.voice &&
      (this.worldPresence < 1 || this.pathPresence < 1)
    ) {
      const playback = this.options.voice.read();
      if (!playback.failed) {
        this.worldPresence = Math.max(
          this.worldPresence,
          sampleWorldPresence(first.sequence, playback.offsetSeconds),
        );
        this.pathPresence = Math.max(
          this.pathPresence,
          samplePathPresence(first.sequence, playback.offsetSeconds),
        );
      }
    }
    if (!this.openingNeeded || this.pathPresence <= 0) return;
    if (!this.showEntry(false)) return;
    this.openingNeeded = false;
    this.prepareSection(false);
  }

  private observeFlight(deltaSeconds: number): ExerciseAction {
    const voice = this.options.voice?.read();
    if (this.timing.expired() && voice && (voice.ended || voice.failed)) {
      this.cancelPending();
      this.recoveryEntryNeeded = false;
      return this.game.finishExercises();
    }
    const position = this.readPosition();
    return this.game.update({
      deltaSeconds,
      progress: this.current?.exerciseProgress.update(position) ?? "pending",
      reachedEnd: this.current?.exitProgress.update(position) === "passed",
      deviated:
        this.current?.deviation.update(position, this.options.viewpoint) ??
        false,
      prepared:
        !!this.pending?.display &&
        (this.bindings.has(this.pending.display) ||
          (!this.pending.continuation &&
            this.elements.every((element) => !element.isVisible()))),
      instructionReleased: this.instructionReleased(),
      instructionEnded: this.options.voice
        ? this.options.voice.read().ended && !this.options.voice.read().failed
        : true,
    });
  }

  private applyAction(action: ExerciseAction): void {
    if (action === "show") this.beginPreparedSection(false);
    if (action === "prepare-next") {
      if (this.playInstruction(false, true)) this.prepareSection(true);
    }
    if (action === "complete")
      this.options.voice?.play(START_SETTINGS.completeVoice, 0);
    if (action === "finish" && this.current)
      this.retireElements(this.current.display);
    if (action === "advance") this.beginPreparedSection(true);
    if (action === "recover") this.recoverCourse();
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
    this.pending = {
      section: this.course.append(route),
      generation: this.createGeneration(route, exercise.particles, attempt),
      continuation,
      elements: this.createElementSources(route, exercise),
      queued: false,
    };
    if (!continuation && this.entry)
      this.current = this.observeSection(
        this.pending.section,
        this.entry.display,
        this.entry,
      );
    this.enqueuePending();
  }

  private createElementSources(
    route: ExerciseRoute,
    exercise: ExerciseDefinition,
  ): ElementSource[] {
    const placements = placeElements(route, exercise.elements);
    if (exercise.elements.entryArrow !== undefined) {
      const arrow = placeEntryArrow(
        route,
        placements,
        exercise.elements.entryArrow,
      );
      if (arrow) placements.push(arrow);
    }
    return placements.map((placement) => ({
      placement,
      openingRadiusMeters:
        placement.kind === "ring"
          ? exercise.elements.ringRadiusMeters -
            START_SETTINGS.elementVolume.coreRadiusMeters
          : undefined,
      shape:
        placement.kind === "ring"
          ? createRingShape(exercise.elements.ringRadiusMeters)
          : createArrowStroke(exercise.elements.arrowLengthMeters),
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

  // 5. Separate pools keep a retained ring from blocking a continuous path.
  private availableDisplay(): Display | undefined {
    return this.paths.find((path) => !path.isVisible());
  }

  private publishPreparedPath(): void {
    const pending = this.pending;
    if (!pending?.generation.isReady() || !this.pathReleased()) return;
    if (!pending.display) {
      const previous = pending.continuation
        ? this.current?.display
        : this.entry?.display;
      if (previous && !previous.isRevealed()) return;
      const display = this.availableDisplay();
      if (!display) return;
      display.show(pending.generation.takeGeometry(), pending.section.pose);
      pending.display = display;
      if (!pending.continuation) this.observeEntry(display);
    }
    if (pending.continuation && this.instructionReleased())
      this.showElements(
        pending.display,
        pending.elements,
        pending.section.pose,
      );
  }

  private observeEntry(display: Display): void {
    if (this.current) this.current = { ...this.current, display };
    if (this.entry) this.retainPath(this.entry, this.entry.display);
    this.entry = undefined;
  }

  private beginPreparedSection(connected: boolean): void {
    const pending = this.pending;
    if (!pending?.display) return;
    this.showElements(pending.display, pending.elements, pending.section.pose);
    if (connected) {
      if (this.current) {
        this.retainPath(this.current, this.current.display);
        this.retireElements(this.current.display);
      }
      this.current = this.observeSection(pending.section, pending.display);
    }
    this.pending = undefined;
  }

  // A retired line remains under and behind the player through the handoff.
  private retainPath(section: PlacedRoute, display: Display): void {
    const end = new Vector3();
    section.route.sample(section.route.lengthMeters, end);
    end
      .applyAxisAngle(new Vector3(0, 1, 0), section.pose.yawRadians)
      .add(section.pose.position);
    this.retiringPaths.set(display, end);
  }

  private updateRetiredPaths(): void {
    const direction =
      this.options.viewpoint.worldFlightDirection ?? this.noFlightDirection;
    for (const [display, end] of this.retiringPaths) {
      const behind = this.relative
        .subVectors(end, this.readPosition())
        .dot(direction);
      if (behind >= -START_SETTINGS.keepPathBehindMeters) continue;
      display.retire(START_SETTINGS.retireSeconds);
      this.retiringPaths.delete(display);
    }
  }

  private retireElements(display: Display): void {
    const elements = this.bindings.get(display);
    if (!elements) return;
    elements.dissolve();
    this.feedback.get(elements)?.passage.reset([], this.readPosition());
    this.bindings.delete(display);
  }

  // 6. Start immediately on a short line; recovery first offers an approach ahead.
  private showEntry(recovery: boolean): boolean {
    const display = this.availableDisplay();
    const exercise = START_EXERCISES[this.game.readState().exerciseIndex];
    if (!display || !exercise) return false;
    const direction =
      this.options.viewpoint.worldFlightDirection ?? this.noFlightDirection;
    const length =
      !recovery && this.options.voice
        ? exercise.sequence.approachMeters
        : START_SETTINGS.entryLineMeters;
    const route = createFlightEntry(length, direction);
    const pose = placeFlightRecovery(
      this.options.viewpoint,
      recovery ? START_SETTINGS.recoveryLeadMeters : 0,
      this.options.constrainFlightPosition,
    );
    const behind = recovery ? 0 : START_SETTINGS.entryBehindMeters;
    const geometry = createPathParticleGeometry(
      {
        lengthMeters: route.lengthMeters + behind,
        sample: (distance, target) => route.sample(distance - behind, target),
      },
      exercise.particles,
    );
    display.show(geometry, pose, recovery ? START_SETTINGS.revealSeconds : 0);
    this.entry = { route, pose, display };
    this.course.begin(this.entry);
    return true;
  }

  private recoverCourse(): void {
    this.cancelPending();
    // A reset retires the complete course on one timeline, including front rings.
    for (const path of this.paths) path.retire(START_SETTINGS.retireSeconds);
    for (const elements of this.elements)
      elements.dissolve("abandoned", START_SETTINGS.retireSeconds);
    for (const { passage } of this.feedback.values())
      passage.reset([], this.readPosition());
    this.bindings.clear();
    this.course.clear();
    this.retiringPaths.clear();
    this.current = undefined;
    this.entry = undefined;
    this.recoveryEntryNeeded = true;
    this.resumeRecovery();
  }

  private resumeRecovery(): void {
    if (!this.recoveryEntryNeeded || !this.showEntry(true)) return;
    this.recoveryEntryNeeded = false;
    this.playInstruction(true);
    this.prepareSection(false);
  }

  // Visual passage feedback is independent of the exercise progression observer.
  private showElements(
    display: Display,
    sources: readonly ElementSource[],
    pose: ExercisePose,
  ): void {
    if (this.bindings.has(display)) return;
    const elements = this.elements.find((element) => !element.isVisible());
    if (!elements) return;
    elements.show(sources, pose, display.readRevealMeters);
    this.bindings.set(display, elements);
    this.placeSectionAudio(
      display,
      elements,
      this.createRingTargets(sources, pose),
    );
    this.feedback
      .get(elements)
      ?.passage.reset(
        this.createRingTargets(sources, pose),
        this.readPosition(),
      );
  }

  // Sound observes the same placements and envelopes as the rendered rings.
  private placeSectionAudio(
    display: Display,
    elements: ElementDisplay,
    rings: RingTarget[],
  ): void {
    const section =
      this.pending?.display === display ? this.pending.section : this.current;
    if (!section || !this.options.atmosphere) return;
    const center = new Vector3();
    section.route.sample(section.route.lengthMeters / 2, center);
    center
      .applyAxisAngle(new Vector3(0, 1, 0), section.pose.yawRadians)
      .add(section.pose.position);
    center.y -= START_SETTINGS.belowFlightMeters;
    this.options.atmosphere.configureSection(this.elements.indexOf(elements), {
      center,
      rings: rings.map((ring) => ({ ...ring, index: ring.elementIndex })),
    });
  }

  private updateAtmosphere(): void {
    const atmosphere = this.options.atmosphere;
    if (!atmosphere) return;
    const voice = this.options.voice?.read();
    atmosphere.update({
      active: this.active,
      presence: this.presence * this.readAtmospherePresence(),
      speaking: !!voice && !voice.ended && !voice.failed,
    });
    this.elements.forEach((display, slot) => {
      if (!display.isVisible()) {
        atmosphere.clearSection(slot);
        return;
      }
      const feedback = this.feedback.get(display);
      if (!feedback) return;
      for (let index = 0; index < feedback.presence.length; index++)
        feedback.presence[index] =
          (feedback.reveal.presence[index] ?? 0) *
          (feedback.retirement.presence[index] ?? 0);
      atmosphere.updateSection(slot, {
        presence: feedback.presence,
        pulses: feedback.light.readPulses(),
      });
    });
  }

  private stopAtmosphere(): void {
    this.options.atmosphere?.update({ active: false, speaking: false });
    this.elements.forEach((_, slot) => {
      this.options.atmosphere?.clearSection(slot);
    });
  }

  // Let source gains fade during the closing voice, leaving time for reverb tails.
  private readAtmospherePresence(): number {
    const phase = this.game.readState().phase;
    if (phase !== "closing" && phase !== "complete") return 1;
    const offset = this.options.voice?.read().offsetSeconds ?? 0;
    return Math.max(0, 1 - offset / START_TIMING.closingAtmosphereFadeSeconds);
  }

  private createRingTargets(
    sources: readonly ElementSource[],
    pose: ExercisePose,
  ): RingTarget[] {
    const targets: RingTarget[] = [];
    sources.forEach((source, elementIndex) => {
      if (!source.openingRadiusMeters) return;
      const center = source.placement.position
        .clone()
        .applyAxisAngle(new Vector3(0, 1, 0), pose.yawRadians)
        .add(pose.position);
      center.y -= START_SETTINGS.belowFlightMeters;
      targets.push({
        elementIndex,
        center,
        radiusMeters: source.openingRadiusMeters,
        direction: source.placement.direction
          .clone()
          .applyAxisAngle(new Vector3(0, 1, 0), pose.yawRadians),
      });
    });
    return targets;
  }

  private observeSection(
    section: PlacedRoute,
    display: Display,
    entry?: PlacedRoute,
  ): ActiveSection {
    if (entry) section = prependFlightEntry(entry, section);
    const exercise = START_EXERCISES[this.game.readState().exerciseIndex];
    if (!exercise) throw new Error("Unknown Start exercise");
    const exerciseRoute = {
      ...section.route,
      lengthMeters: section.route.exerciseEndMeters,
    };
    const exerciseProgress = createFlightProgress(
      { route: exerciseRoute, pose: section.pose },
      exercise.progress,
      this.readPosition(),
    );
    const exitProgress = createFlightProgress(
      section,
      exercise.progress,
      this.readPosition(),
    );
    const deviation = createFlightDeviation(
      section,
      this.readPosition(),
      exercise.deviation,
    );
    return { ...section, display, exerciseProgress, exitProgress, deviation };
  }

  // 7. Native speech facts gate visuals; elapsed frame time is only the silent demo fallback.
  private pathReleased(): boolean {
    if (!this.options.voice) return this.instructionReleased();
    const state = this.game.readState();
    const exercise: ExerciseDefinition | undefined =
      START_EXERCISES[state.exerciseIndex + Number(state.phase === "outro")];
    const cue =
      exercise?.sequence.pathAtSeconds ?? exercise?.voice.instructionAtSeconds;
    const playback = this.options.voice.read();
    return (
      cue !== undefined && !playback.failed && playback.offsetSeconds >= cue
    );
  }

  private instructionReleased(): boolean {
    const state = this.game.readState();
    if (!this.options.voice)
      return (
        state.elapsedSeconds >= START_SETTINGS.demonstrationCueSeconds ||
        state.phase === "outro"
      );
    const index = state.exerciseIndex + Number(state.phase === "outro");
    const cue = START_EXERCISES[index]?.voice;
    const playback = this.options.voice.read();
    return (
      !!cue &&
      !playback.failed &&
      playback.offsetSeconds >= cue.instructionAtSeconds
    );
  }

  private playInstruction(retry: boolean, successor = false): boolean {
    const voice = this.options.voice;
    if (!voice) return true;
    // Keep unfinished orientation intact during an early deviation.
    if (retry && !voice.read().ended) return true;
    const index = this.game.readState().exerciseIndex + Number(successor);
    const cue = START_EXERCISES[index]?.voice;
    if (!cue) return false;
    const offset = retry ? cue.instructionAtSeconds : 0;
    if (!this.timing.canPlay(cue.durationSeconds - offset)) return false;
    voice.play(cue, offset);
    return true;
  }

  private readPosition(): Readonly<Vector3> {
    return (
      this.options.viewpoint.worldFlightPosition ??
      this.options.viewpoint.worldPosition
    );
  }
}
