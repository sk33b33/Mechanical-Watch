import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/** SIM-001, SIM-003, ASSY-001 (over-constrained train), KIN-001. */
export const kinematicRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];

  if (movement.drivingShaftId !== null) {
    if (!Number.isFinite(movement.drivingAngularVelocity)) {
      issues.push(
        issue("SIM-001", "drive", "error", "L2_KINEMATIC", [movement.drivingShaftId],
          "Driving angular velocity is not finite.", []),
      );
    } else {
      issues.push(
        issue("SIM-003", "prescribed-drive", "info", "L2_KINEMATIC", [movement.drivingShaftId],
          "The drive is a prescribed angular velocity, not an energy source. No torque, energy or power reserve is modeled.",
          ["ASM-0007"]),
      );
    }
  }

  for (const conflict of train.conflicts) {
    const shaft = movement.shafts[conflict.shaftId];
    issues.push(
      issue("ASSY-001", "over-constrained", "error", "L2_KINEMATIC", [conflict.shaftId, conflict.computedFromMeshId],
        `${shaft?.name ?? conflict.shaftId}: over-constrained gear train, because two paths give different angular velocities.`,
        ["REF-ENG §5.3", "ASM-0001"]),
    );
  }

  if (movement.drivingShaftId !== null) {
    for (const shaftId of train.unreachableShaftIds) {
      const shaft = movement.shafts[shaftId];
      issues.push(
        issue("KIN-001", "unpowered", "warning", "L2_KINEMATIC", [shaftId],
          `${shaft?.name ?? shaftId}: not connected to the driving shaft (unpowered).`, []),
      );
    }
  }
  return issues;
};
