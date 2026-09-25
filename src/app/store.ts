import type { Movement } from "@/domain/movement";
import type { GearId } from "@/domain/gear";
import { analyzeMovement, EMPTY_ANALYSIS, type MovementAnalysis } from "@/analysis/analyzeMovement";
import type { ValidationIssue } from "@/validation/validationIssue";
import {
  advanceSimulation,
  createSimulationState,
  type SimulationState,
} from "@/simulation/simulationState";

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
  selectedGearId: GearId | null = null;

  private readonly listeners = new Set<() => void>();
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
    this.issues =
      this.simulationIssue === null ? this.analysis.issues : [...this.analysis.issues, this.simulationIssue];
  }

  /** Applies a pure domain update, then re-derives everything. */
  edit(update: (movement: Movement) => Movement): void {
    this.movement = update(this.movement);
    this.simulationHalted = false;
    this.simulationIssue = null;
    this.recompute();
    this.notify();
  }

  selectGear(gearId: GearId | null): void {
    this.selectedGearId = gearId;
    this.notify();
  }

  /**
   * Feeds real elapsed time to the fixed-step simulation (SIM-002). Never
   * mutates `movement`. Does not notify subscribers on normal frames, so
   * DOM panels don't re-render at frame rate.
   */
  tick(elapsedRealSeconds: number): void {
    if (this.simulationHalted) {
      return;
    }
    try {
      this.simulation = advanceSimulation(this.simulation, this.analysis.train, elapsedRealSeconds);
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
