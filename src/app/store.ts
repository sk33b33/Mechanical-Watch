import type { Movement } from "@/domain/movement";
import type { EntityId } from "@/domain/ids";
import { removeEntity } from "@/domain/editing";
import { findEntity } from "@/domain/lookup";
import { analyzeMovement, EMPTY_ANALYSIS, type MovementAnalysis } from "@/analysis/analyzeMovement";
import type { ValidationIssue } from "@/validation/validationIssue";
import { solveGearTrain, type GearTrainSolution, type KinematicMode } from "@/kinematics/solveGearTrain";
import { radiansPerSecond } from "@/units/angularVelocity";
import {
  advanceSimulation,
  createSimulationState,
  stepSimulation,
  type SimulationState,
} from "@/simulation/simulationState";

const HISTORY_LIMIT = 200;

/**
 * Hand-setting speed: the minutes hand turns once per real second (one
 * hour per second). A UI choice, not a property of any mechanism.
 */
const HAND_SETTING_ANGULAR_VELOCITY = 2 * Math.PI;

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
    this.updateSimulationTrain();
    this.issues =
      this.simulationIssue === null ? this.analysis.issues : [...this.analysis.issues, this.simulationIssue];
  }

  /** Applies a pure domain update, then re-derives everything. Undoable. */
  edit(update: (movement: Movement) => Movement): void {
    const next = update(this.movement);
    if (next === this.movement) return;
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

  /** Simulation playback (UI state, not part of the design). */
  playing = true;
  playbackRate: PlaybackRate = 1;
  /** Running, or setting the hands (clutches slip). UI state, not part of the design. */
  kinematicMode: KinematicMode = "RUNNING";
  settingDirection: 1 | -1 = 1;
  /**
   * The solution the simulation integrates: the running solve from the
   * analysis, or a hand-setting solve. Validation always uses the running solve.
   */
  simulationTrain: GearTrainSolution = EMPTY_ANALYSIS.train;

  setKinematicMode(mode: KinematicMode, direction: 1 | -1 = this.settingDirection): void {
    this.kinematicMode = mode;
    this.settingDirection = direction;
    this.updateSimulationTrain();
    this.notify();
  }

  private updateSimulationTrain(): void {
    this.simulationTrain =
      this.kinematicMode === "RUNNING"
        ? this.analysis.train
        : solveGearTrain(this.movement, {
            mode: "HAND_SETTING",
            settingAngularVelocity: radiansPerSecond(this.settingDirection * HAND_SETTING_ANGULAR_VELOCITY),
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
    this.runSimulation(() => stepSimulation(this.simulation, this.simulationTrain));
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
    this.runSimulation(() =>
      advanceSimulation(this.simulation, this.simulationTrain, elapsedRealSeconds * this.playbackRate),
    );
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
