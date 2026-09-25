import type { EntityId } from "@/domain/ids";

export type ValidationSeverity = "error" | "warning";

/**
 * Matches docs/MASTER_BUILD_PROMPT.md "Validation levels". A design must
 * never silently claim a higher level than it has actually earned.
 */
export type ValidationLevel =
  | "GEOMETRIC"
  | "KINEMATIC"
  | "DYNAMIC_SIMPLIFIED"
  | "PHYSICAL_VALIDATION_PENDING";

export interface ValidationIssue {
  readonly id: string;
  severity: ValidationSeverity;
  category: string;
  entityIds: EntityId[];
  message: string;
  rule: string;
  validationLevel: ValidationLevel;
}
