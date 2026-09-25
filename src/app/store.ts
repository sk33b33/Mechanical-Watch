import type { Movement } from "@/domain/movement";
import { updateGear } from "@/domain/movement";
import type { GearId } from "@/domain/gear";
import { solveGearTrain, type GearTrainSolution } from "@/kinematics/solveGearTrain";
import { validateMovement } from "@/validation/validateMovement";
import type { ValidationIssue } from "@/validation/validationIssue";
import { createSimulationState, stepSimulation, type SimulationState } from "@/simulation/simulationState";

/**
 * The single client-side owner of application state. The domain model
 * (`movement`) is authoritative; `solution`, `issues` and `simulation`
 * are all derived from it, never the other way around (see
 * docs/MASTER_BUILD_PROMPT.md "Single source of truth").
 */
export class AppStore {
  movement: Movement;
  solution: GearTrainSolution;
  issues: ValidationIssue[];
  simulation: SimulationState;
  selectedGearId: GearId | null = null;

  private readonly listeners = new Set<() => void>();

  constructor(movement: Movement) {
    this.movement = movement;
    this.solution = solveGearTrain(movement);
    this.issues = validateMovement(movement);
    this.simulation = createSimulationState(movement);
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
   * Recomputes derived state. Deliberately defensive: a bug in a
   * validation rule must never leave the store silently un-notified
   * (stale UI) — it is surfaced as an issue instead, per
   * docs/MASTER_BUILD_PROMPT.md "the application must never imply ...
   * accuracy beyond what has actually been validated".
   */
  private recompute(): void {
    try {
      this.solution = solveGearTrain(this.movement);
      this.issues = validateMovement(this.movement);
    } catch (error) {
      this.solution = { shaftAngularVelocity: new Map(), unreachableShaftIds: [], conflicts: [] };
      this.issues = [
        {
          id: "issue_validation_internal_error",
          severity: "error",
          category: "internal",
          entityIds: [],
          message: `Validation could not complete: ${error instanceof Error ? error.message : String(error)}`,
          rule: "validation-engine-error",
          validationLevel: "GEOMETRIC",
        },
      ];
    }
  }

  updateGearParams(gearId: GearId, patch: Parameters<typeof updateGear>[2]): void {
    this.movement = updateGear(this.movement, gearId, patch);
    this.recompute();
    this.notify();
  }

  selectGear(gearId: GearId | null): void {
    this.selectedGearId = gearId;
    this.notify();
  }

  /**
   * Advances the visual simulation only — never mutates `movement`, and
   * deliberately does not notify subscribers: this runs once per
   * animation frame, and DOM panels (tree/inspector/console) must not
   * re-render at that rate. The viewport reads `simulation` directly
   * after calling this.
   */
  tick(dtSeconds: number): void {
    this.simulation = stepSimulation(this.simulation, this.solution, dtSeconds);
  }
}
