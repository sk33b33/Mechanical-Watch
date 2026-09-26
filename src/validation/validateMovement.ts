import type { Movement } from "@/domain/movement";
import { solvePlacement } from "@/kinematics/solvePlacement";
import { solveGearTrain } from "@/kinematics/solveGearTrain";
import type { ValidationIssue } from "./validationIssue";
import type { Rule, RuleContext } from "./rules/context";
import { gearParameterRules, meshRules } from "./rules/gearRules";
import { placementRules } from "./rules/placementRules";
import { gearAxialRules, interferenceRules } from "./rules/interferenceRules";
import { bearingRules, frameRules } from "./rules/bearingRules";
import { kinematicRules } from "./rules/kinematicRules";
import { timeRules } from "./rules/timeRules";
import { couplingRules } from "./rules/couplingRules";
import { toleranceRules } from "./rules/toleranceRules";
import { dialRules, keylessRules } from "./rules/keylessRules";
import { escapementRules } from "./rules/escapementRules";

/** Rule families, in the order their issues are reported. */
const RULES: readonly Rule[] = [
  placementRules,
  frameRules,
  gearParameterRules,
  gearAxialRules,
  meshRules,
  bearingRules,
  toleranceRules,
  couplingRules,
  interferenceRules,
  kinematicRules,
  timeRules,
  keylessRules,
  dialRules,
  escapementRules,
];

/**
 * Runs every implemented rule (reference/validation/VALIDATION_RULES.md).
 * Output order and issue IDs are deterministic. Warnings and info never
 * block a declared level; errors and blockers do. Pass precomputed
 * solutions to avoid solving twice; otherwise they are computed here.
 */
export function validateMovement(
  movement: Movement,
  solved?: Omit<RuleContext, "movement">,
): ValidationIssue[] {
  const ctx: RuleContext = {
    movement,
    placement: solved?.placement ?? solvePlacement(movement),
    train: solved?.train ?? solveGearTrain(movement),
  };
  return RULES.flatMap((rule) => rule(ctx));
}
