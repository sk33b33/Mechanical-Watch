import type { PlacementFailureReason } from "@/kinematics/solvePlacement";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

const MESSAGES: Record<PlacementFailureReason, string> = {
  NON_FINITE: "placement contains a non-finite coordinate or angle.",
  MISSING_REFERENCE: "placement refers to a shaft that does not exist.",
  MESH_NOT_BETWEEN_SHAFTS: "placement refers to a mesh that does not connect this shaft to its reference shaft.",
  INVALID_MESH_PARAMETERS:
    "placement uses a mesh whose gears have invalid or unequal module/tooth counts, so the centre distance is undefined.",
  REFERENCE_UNRESOLVED: "its reference shaft could not be placed.",
  CIRCULAR_REFERENCE: "placement constraints form a cycle.",
};

/** SHAFT-001 (non-finite axis) and ASSY-001 (unresolved placement constraints). */
export const placementRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
  for (const failure of placement.failures) {
    const shaft = movement.shafts[failure.shaftId];
    const name = shaft?.name ?? failure.shaftId;
    const rule = failure.reason === "NON_FINITE" ? "SHAFT-001" : "ASSY-001";
    issues.push(
      issue(rule, `placement-${failure.reason}`, "error", "L1_GEOMETRIC", [failure.shaftId],
        `${name}: cannot be placed because ${MESSAGES[failure.reason]}`,
        failure.reason === "NON_FINITE" ? ["ASM-0006"] : []),
    );
  }
  return issues;
};
