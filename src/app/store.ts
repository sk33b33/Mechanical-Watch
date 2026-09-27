import type { Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import { removeEntity } from "@/domain/editing";
import { TUTORIAL_STEPS } from "./tutorial/tutorialSteps";
import { designsEqual } from "@/persistence/designFile";
import { findEntity } from "@/domain/lookup";
import { analyzeMovement, EMPTY_ANALYSIS, type MovementAnalysis } from "@/analysis/analyzeMovement";
import type { ValidationIssue } from "@/validation/validationIssue";
import {
  handsForwardCrownSense,
  primaryKeyless,
  solveGearTrain,
  windingCrownSense,
  type GearTrainSolution,
} from "@/kinematics/solveGearTrain";
import { radiansPerSecond } from "@/units/angularVelocity";
import { radians, type Angle } from "@/units/angle";
import type { CouplingId } from "@/domain/coupling";
import { amplitudeAtWind, summarizeEnergy, type EnergySummary } from "@/kinematics/energySummary";
import {
  advanceSimulation,
  createSimulationState,
  reconcileWind,
  stepSimulation,
  windTracks,
  type SimulationState,
  type WindTrack,
} from "@/simulation/simulationState";

const HISTORY_LIMIT = 200;

/**
 * Direct hand-setting speed (movements without keyless works): the minutes
 * hand turns once per real second (one hour per second). A UI choice, not
 * a property of any mechanism.
 */
const HAND_SETTING_ANGULAR_VELOCITY = 2 * Math.PI;

/**
 * How fast the user turns the crown: one revolution per real second. A UI
 * choice, not a property of any mechanism; the hands' or ratchet's speed
 * then follows from the keyless works' ratios.
 */
export const CROWN_TURNING_ANGULAR_VELOCITY = 2 * Math.PI;

/**
 * What the user is doing with the crown (UI state, not part of the design).
 * With keyless works, setting and winding go through the crown; without
 * them, setting turns the minutes-hand arbor directly.
 */
export type CrownAction = "RUNNING" | "SET_FORWARD" | "SET_BACKWARD" | "WIND" | "WIND_REVERSE";

/** Playback speeds offered in the UI; 60× stays within the per-frame step cap down to 15 fps. */
export const PLAYBACK_RATES = [0.1, 1, 10, 60] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The single client-side owner of application state. The domain model
 * (`movement`) is authoritative. `analysis` (placement, gear train,
 * validation) and `simulation` are derived from it, never the other way
 * around.
 */
export class AppStore {
  movement: Movement;
  analysis: MovementAnalysis = EMPTY_ANALYSIS;
  /** Validation issues plus any simulation-runtime issue. */
  issues: ValidationIssue[] = [];
  simulation: SimulationState;
  /** Set when the simulation hit a non-finite state; it stays stopped until the design changes. */
  simulationHalted = false;
  selectedId: EntityId | null = null;
  /** Increments whenever a different design is loaded, so views can refit. */
  designGeneration = 0;

  private readonly listeners = new Set<() => void>();
  /** Undo history. Designs are immutable, so each entry is a whole design, sharing unchanged parts. */
  private past: Movement[] = [];
  private future: Movement[] = [];
  private readonly designListeners = new Set<(movement: Movement) => void>();
  private simulationIssue: ValidationIssue | null = null;
  /** The mainspring → balance energy chain for the running train (ASM-0026), or null without a mainspring. */
  energy: EnergySummary | null = null;
  private windTracks: WindTrack[] = [];
  /**
   * When the balance-governed going train stops: the primary spring's wind
   * at or below `turns` (where the balance can no longer unlock, or let
   * down). Null when the drive is not the balance or the spring has no data.
   */
  private runDown: { id: CouplingId; turns: number } | null = null;
  /** The simulated setting or winding with the going train stopped; null when it cannot stop. */
  private stoppedTrain: GearTrainSolution | null = null;

  constructor(movement: Movement) {
    this.movement = movement;
    this.simulation = createSimulationState(movement);
    this.recompute();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Called whenever the design itself changes (edit or load), not on selection. */
  onDesignChange(listener: (movement: Movement) => void): () => void {
    this.designListeners.add(listener);
    return () => {
      this.designListeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Recomputes derived state. If analysis itself fails, that is a VAL-001
   * blocker shown to the user; the UI is never left stale.
   */
  private recompute(): void {
    try {
      this.analysis = analyzeMovement(this.movement);
    } catch (error) {
      this.analysis = {
        ...EMPTY_ANALYSIS,
        issues: [
          {
            id: "VAL-001:engine",
            rule: "VAL-001",
            severity: "blocker",
            entityIds: [],
            message: `Validation could not complete: ${errorMessage(error)}`,
            validationLevel: "L1_GEOMETRIC",
            references: [],
          },
        ],
      };
    }
    try {
      this.energy = summarizeEnergy(this.movement, this.analysis.train);
    } catch {
      // Energy is a derived readout; an analysis failure is already reported as VAL-001.
      this.energy = null;
    }
    this.windTracks = windTracks(this.movement, this.analysis.train);
    this.simulation = reconcileWind(this.simulation, this.movement);
    const spring = this.energy?.spec == null ? null : this.energy.spring;
    this.runDown = this.movement.drive?.kind === "BALANCE" && spring !== null && this.simulation.mainspringWind[spring.id] !== undefined
      ? { id: spring.id, turns: this.energy?.stopWindTurns ?? 0 }
      : null;
    this.updateSimulationTrain();
    this.issues =
      this.simulationIssue === null ? this.analysis.issues : [...this.analysis.issues, this.simulationIssue];
    this.advanceTutorialIfComplete();
  }

  /** Applies a pure domain update, then re-derives everything. Undoable. */
  edit(update: (movement: Movement) => Movement): void {
    const next = update(this.movement);
    // An edit that changes nothing (e.g. a field committing its unchanged value on blur) is not a history step.
    if (designsEqual(next, this.movement)) return;
    this.record();
    this.replaceDesign(next);
  }

  /** Removes a part and the parts it owns (see removeEntity). Undoable. */
  remove(id: EntityId): void {
    this.edit((m) => removeEntity(m, id).movement);
  }

  /**
   * Replaces the whole design (open file, new movement). The simulation
   * restarts from rest. Undoable, so replacing a design never loses work.
   */
  load(movement: Movement): void {
    this.record();
    this.simulation = createSimulationState(movement);
    this.designGeneration += 1;
    this.replaceDesign(movement);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const previous = this.past.pop();
    if (previous === undefined) return;
    this.future.push(this.movement);
    this.replaceDesign(previous);
  }

  redo(): void {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(this.movement);
    this.replaceDesign(next);
  }

  private record(): void {
    this.past.push(this.movement);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  private replaceDesign(movement: Movement): void {
    this.movement = movement;
    this.simulationHalted = false;
    this.simulationIssue = null;
    if (this.selectedId !== null && findEntity(movement, this.selectedId) === undefined) {
      this.selectedId = null;
    }
    this.measureIds = this.measureIds.map((id) => (id !== null && findEntity(movement, id) !== undefined ? id : null)) as [
      EntityId | null,
      EntityId | null,
    ];
    this.recompute();
    for (const listener of this.designListeners) listener(movement);
    this.notify();
  }

  select(id: EntityId | null): void {
    if (this.measuring && id !== null) {
      const [a, b] = this.measureIds;
      this.measureIds = a === null || b !== null ? [id, null] : [a, id];
      this.selectedId = id;
      this.notify();
      return;
    }
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.notify();
  }

  /** Measure mode (UI state): the next two picks become parts A and B. */
  measuring = false;
  measureIds: [EntityId | null, EntityId | null] = [null, null];

  setMeasuring(on: boolean): void {
    this.measuring = on;
    this.measureIds = [null, null];
    this.notify();
  }

  /**
   * Guided "build the teaching movement" walkthrough (UI state, not part
   * of the design; see tutorial/tutorialSteps.ts). A step with a
   * completion check advances on its own when the design satisfies it,
   * checked from recompute() on every edit — never on a UI event alone,
   * since the domain model is what's authoritative here too.
   */
  tutorialActive = false;
  tutorialStepIndex = 0;
  /** Entity id created by each tutorial step so far, keyed by step id — lets a later step reselect an earlier part. */
  private tutorialCreatedIds = new Map<string, EntityId>();

  get tutorialStep(): (typeof TUTORIAL_STEPS)[number] | null {
    return this.tutorialActive ? (TUTORIAL_STEPS[this.tutorialStepIndex] ?? null) : null;
  }

  startTutorial(): void {
    this.tutorialActive = true;
    this.tutorialStepIndex = 0;
    this.tutorialCreatedIds.clear();
    this.advanceTutorialIfComplete();
    this.enterTutorialStep();
    this.notify();
  }

  stopTutorial(): void {
    this.tutorialActive = false;
    this.notify();
  }

  /** Advances past the current step regardless of its own completion check (a manual "Next" / "Skip this step"). */
  advanceTutorial(): void {
    if (!this.tutorialActive) return;
    if (this.tutorialStepIndex >= TUTORIAL_STEPS.length - 1) {
      this.tutorialActive = false;
    } else {
      this.tutorialStepIndex += 1;
      this.enterTutorialStep();
    }
    this.notify();
  }

  /**
   * Runs a tutorial step's part-creation override (in place of the UI
   * control's normal "create an empty part" action), then resolves
   * selection once the design (and so possibly the current step) has
   * settled: the now-current step's `selectFromStep`, if it names one, or
   * else the part just created.
   */
  runTutorialCreation(stepId: string, build: (movement: Movement) => { movement: Movement; id: EntityId }): void {
    const { movement, id } = build(this.movement);
    this.edit(() => movement);
    this.tutorialCreatedIds.set(stepId, id);
    const current = this.tutorialStep;
    if (current?.deselect === true) {
      this.select(null);
      return;
    }
    const target = current?.selectFromStep === undefined ? id : (this.tutorialCreatedIds.get(current.selectFromStep) ?? id);
    this.select(target);
  }

  /**
   * Reselects the entity an earlier step created, if the step now current
   * asks for one (TutorialStep.selectFromStep), or deselects entirely if
   * it wants the movement-level section instead (TutorialStep.deselect).
   */
  private enterTutorialStep(): void {
    const step = this.tutorialStep;
    if (step?.deselect === true) {
      this.selectedId = null;
      return;
    }
    if (step?.selectFromStep === undefined) return;
    const id = this.tutorialCreatedIds.get(step.selectFromStep);
    if (id !== undefined) this.selectedId = id;
  }

  /** Auto-advances while the current step's own completion check is satisfied by the design. Called from recompute(). */
  private advanceTutorialIfComplete(): void {
    if (!this.tutorialActive) return;
    let step = TUTORIAL_STEPS[this.tutorialStepIndex];
    while (step?.isComplete?.(this.movement) === true) {
      if (this.tutorialStepIndex >= TUTORIAL_STEPS.length - 1) {
        this.tutorialActive = false;
        return;
      }
      this.tutorialStepIndex += 1;
      this.enterTutorialStep();
      step = TUTORIAL_STEPS[this.tutorialStepIndex];
    }
  }

  /** Simulation playback (UI state, not part of the design). */
  playing = true;
  playbackRate: PlaybackRate = 1;
  crownAction: CrownAction = "RUNNING";
  /**
   * The solution the simulation integrates: the running solve from the
   * analysis, or a setting or winding solve. Validation always uses the running solve.
   */
  simulationTrain: GearTrainSolution = EMPTY_ANALYSIS.train;

  setCrownAction(action: CrownAction): void {
    this.crownAction = action;
    this.updateSimulationTrain();
    this.notify();
  }

  private updateSimulationTrain(): void {
    this.simulationTrain = this.solveForAction(false);
    this.stoppedTrain = this.runDown === null ? null : this.solveForAction(true);
  }

  /**
   * The balance-governed going train has run down (ASM-0026): the balance no
   * longer unlocks, or the spring is let down. Winding above the stop
   * restarts it (the model assumes the balance self-starts).
   */
  get goingTrainStopped(): boolean {
    return this.isRunDown(this.simulation);
  }

  private isRunDown(state: SimulationState): boolean {
    const r = this.runDown;
    if (r === null) return false;
    const wind = state.mainspringWind[r.id];
    return wind !== undefined && wind <= r.turns;
  }

  /** The solution in effect now: the stopped variant once the going train has run down. */
  get effectiveTrain(): GearTrainSolution {
    return this.trainFor(this.simulation);
  }

  private trainFor(state: SimulationState): GearTrainSolution {
    return this.stoppedTrain !== null && this.isRunDown(state) ? this.stoppedTrain : this.simulationTrain;
  }

  /** State of wind of the primary mainspring in turns from let-down, or null without spring data. */
  get mainspringWindTurns(): number | null {
    const spring = this.energy?.spec == null ? null : this.energy.spring;
    return spring === null ? null : this.simulation.mainspringWind[spring.id] ?? null;
  }

  /** Wind at which the going train stops (null when it cannot stop: not balance-governed, or no spring data). */
  get runDownWindTurns(): number | null {
    return this.runDown?.turns ?? null;
  }

  /**
   * Running time left at the current wind (ASM-0026): until the balance
   * stops when the movement is balance-governed, else until let down.
   */
  get reserveRemainingSeconds(): number | null {
    const wind = this.mainspringWindTurns;
    const spec = this.energy?.spec;
    const reserve = this.energy?.reserveSeconds;
    if (wind === null || spec == null || reserve == null) return null;
    return (reserve * Math.max(0, wind - (this.runDown?.turns ?? 0))) / spec.usableTurns;
  }

  /**
   * The balance amplitude to show: 0 once run down, the energy model's
   * prediction at the current wind when it has its inputs (ASM-0026), else
   * the declared amplitude (null here).
   */
  get displayAmplitude(): Angle | null {
    if (this.goingTrainStopped) return radians(0);
    const wind = this.mainspringWindTurns;
    return this.energy === null || wind === null ? null : amplitudeAtWind(this.energy, wind);
  }

  private solveForAction(goingTrainStopped: boolean): GearTrainSolution {
    const action = this.crownAction;
    if (action === "RUNNING") {
      return goingTrainStopped ? solveGearTrain(this.movement, { mode: "RUNNING", goingTrainStopped }) : this.analysis.train;
    }
    const direction = action === "SET_FORWARD" || action === "WIND" ? 1 : -1;
    const hasKeyless = primaryKeyless(this.movement) !== null;
    if (action === "SET_FORWARD" || action === "SET_BACKWARD") {
      return hasKeyless
        ? solveGearTrain(this.movement, {
            mode: "CROWN_SETTING",
            // Turn the crown whichever way moves the hands the requested way (derived from the setting train).
            crownAngularVelocity: radiansPerSecond(direction * (handsForwardCrownSense(this.movement) ?? 1) * CROWN_TURNING_ANGULAR_VELOCITY),
            goingTrainStopped,
          })
        : solveGearTrain(this.movement, {
            mode: "HAND_SETTING",
            settingAngularVelocity: radiansPerSecond(direction * HAND_SETTING_ANGULAR_VELOCITY),
            goingTrainStopped,
          });
    }
    return solveGearTrain(this.movement, {
      mode: "WINDING",
      // WIND turns the crown the winding way; WIND_REVERSE the other way, where the ratchet teeth slip.
      crownAngularVelocity: radiansPerSecond(direction * (windingCrownSense(this.movement) ?? 1) * CROWN_TURNING_ANGULAR_VELOCITY),
      goingTrainStopped,
    });
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.notify();
  }

  setPlaybackRate(rate: PlaybackRate): void {
    this.playbackRate = rate;
    this.notify();
  }

  /** Advances exactly one fixed simulation step, whether playing or paused. */
  stepOnce(): void {
    this.runSimulation(() => stepSimulation(this.simulation, this.trainFor(this.simulation), undefined, this.windTracks));
    this.notify();
  }

  /** Returns every shaft to angle 0 at t = 0. The design is unchanged. */
  resetSimulation(): void {
    this.simulation = createSimulationState(this.movement);
    this.simulationHalted = false;
    this.simulationIssue = null;
    this.recompute();
    this.notify();
  }

  /**
   * Feeds real elapsed time, scaled by the playback rate, to the
   * fixed-step simulation (SIM-002). Never mutates `movement`. Does not
   * notify subscribers on normal frames, so DOM panels don't re-render at
   * frame rate.
   */
  tick(elapsedRealSeconds: number): void {
    if (!this.playing) return;
    const wasStopped = this.goingTrainStopped;
    this.runSimulation(() =>
      advanceSimulation(this.simulation, (state) => this.trainFor(state), elapsedRealSeconds * this.playbackRate, this.windTracks),
    );
    // Running down or restarting changes what panels show; normal frames stay silent.
    if (this.goingTrainStopped !== wasStopped) this.notify();
  }

  private runSimulation(advance: () => SimulationState): void {
    if (this.simulationHalted) return;
    try {
      this.simulation = advance();
    } catch (error) {
      this.simulationHalted = true;
      this.simulationIssue = {
        id: "SIM-001:halted",
        rule: "SIM-001",
        severity: "blocker",
        entityIds: [],
        message: `Simulation stopped: ${errorMessage(error)}`,
        validationLevel: "L2_KINEMATIC",
        references: [],
      };
      this.issues = [...this.analysis.issues, this.simulationIssue];
      this.notify();
    }
  }
}
