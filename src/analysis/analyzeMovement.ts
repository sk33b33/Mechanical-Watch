import type { Movement } from "@/domain/movement";
import { solvePlacement, type PlacementSolution } from "@/kinematics/solvePlacement";
import { solveGearTrain, type GearTrainSolution } from "@/kinematics/solveGearTrain";
import { validateMovement } from "@/validation/validateMovement";
import type { ValidationIssue } from "@/validation/validationIssue";

/** Everything derived from a movement. Recomputed as a whole after each edit. */
export interface MovementAnalysis {
  placement: PlacementSolution;
  train: GearTrainSolution;
  issues: ValidationIssue[];
}

export function analyzeMovement(movement: Movement): MovementAnalysis {
  const placement = solvePlacement(movement);
  const train = solveGearTrain(movement);
  return { placement, train, issues: validateMovement(movement, { placement, train }) };
}

export const EMPTY_ANALYSIS: MovementAnalysis = {
  placement: { shaftPositions: new Map(), failures: [] },
  train: { shaftAngularVelocity: new Map(), unreachableShaftIds: [], conflicts: [] },
  issues: [],
};
