import type { EntityId } from "@/domain/ids";
import type { Movement } from "@/domain/movement";
import type { Gear } from "@/domain/gear";
import { isValidModule, isValidToothCount } from "@/math/gearMath";
import type { PlacementSolution } from "@/kinematics/solvePlacement";
import type { GearTrainSolution } from "@/kinematics/solveGearTrain";
import type { RuleId } from "@/reference/ruleIds";
import type {
  ReferenceId,
  ValidationIssue,
  ValidationLevel,
  ValidationSeverity,
} from "../validationIssue";

export interface RuleContext {
  movement: Movement;
  placement: PlacementSolution;
  train: GearTrainSolution;
}

export type Rule = (ctx: RuleContext) => ValidationIssue[];

export function issue(
  rule: RuleId,
  variant: string,
  severity: ValidationSeverity,
  validationLevel: ValidationLevel,
  entityIds: EntityId[],
  message: string,
  references: ReferenceId[],
): ValidationIssue {
  return {
    id: [rule, variant, ...entityIds].join(":"),
    rule,
    severity,
    validationLevel,
    entityIds,
    message,
    references,
  };
}

export function hasValidGearParameters(gear: Gear): boolean {
  return isValidToothCount(gear.toothCount) && isValidModule(gear.module);
}

export function mm(metresValue: number, digits = 4): string {
  return `${(metresValue * 1000).toFixed(digits)} mm`;
}
