import type { EntityId } from "@/domain/ids";
import type { RuleId } from "@/reference/ruleIds";
import type { AssumptionId } from "@/reference/assumptions";
import type { ValidationLevel } from "@/reference/validationLevels";
import { levelRank } from "@/reference/validationLevels";

export type { ValidationLevel } from "@/reference/validationLevels";

/** reference/validation/VALIDATION_RULES.md "Severity". */
export type ValidationSeverity = "info" | "warning" | "error" | "blocker";

/** A source (SRC-xxxx), assumption (ASM-xxxx) or reference-document section. */
export type ReferenceId = AssumptionId | `SRC-${string}` | `REF-ENG §${string}`;

/** reference/validation/VALIDATION_RULES.md "Validation output". */
export interface ValidationIssue {
  /** Deterministic: derived from rule + entities, so it is stable across recomputes. */
  readonly id: string;
  rule: RuleId;
  severity: ValidationSeverity;
  entityIds: EntityId[];
  message: string;
  validationLevel: ValidationLevel;
  references: ReferenceId[];
}

export function blocksLevel(issue: ValidationIssue): boolean {
  return issue.severity === "error" || issue.severity === "blocker";
}

export interface DeclaredLevelStatus {
  declared: ValidationLevel;
  satisfied: boolean;
  blockingIssues: ValidationIssue[];
}

/**
 * Is the DECLARED level currently satisfied? Only errors/blockers at or
 * below the declared level count. This never computes or raises a level.
 * If `entityIds` is given, only issues touching those entities count.
 */
export function declaredLevelStatus(
  declared: ValidationLevel,
  issues: readonly ValidationIssue[],
  entityIds?: readonly string[],
): DeclaredLevelStatus {
  const blockingIssues = issues.filter(
    (i) =>
      blocksLevel(i) &&
      levelRank(i.validationLevel) <= levelRank(declared) &&
      (entityIds === undefined || i.entityIds.some((id) => entityIds.includes(id))),
  );
  return { declared, satisfied: blockingIssues.length === 0, blockingIssues };
}
