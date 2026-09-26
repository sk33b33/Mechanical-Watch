import { drivenShaftId } from "@/domain/movement";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/** SIM-001, SIM-003, ASSY-001 (over-constrained train), KIN-001. */
export const kinematicRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  const drive = movement.drive;

  if (drive === null) {
    if (Object.keys(movement.shafts).length > 0) {
      issues.push(
        issue("KIN-001", "no-drive", "info", "L2_KINEMATIC", [],
          "No drive is set, so nothing moves in the simulation. Make an arbor the drive, or run at nominal time.", ["ASM-0007"]),
      );
    }
    return issues;
  }

  const shaftId = drivenShaftId(movement);
  if (drive.kind === "PRESCRIBED") {
    if (movement.shafts[drive.shaftId] === undefined) {
      issues.push(
        issue("ASSY-001", "drive-shaft", "error", "L2_KINEMATIC", [],
          "The drive refers to a shaft that does not exist.", []),
      );
    } else if (!Number.isFinite(drive.angularVelocity)) {
      issues.push(
        issue("SIM-001", "drive", "error", "L2_KINEMATIC", [drive.shaftId],
          "The drive speed has no valid value. Enter a finite speed in rev/min.", ["ASM-0007"]),
      );
    }
  }
  // Nominal time without exactly one minutes hand is reported by TIME-001 / TIME-003.

  if (shaftId !== null && train.shaftAngularVelocity.size > 0) {
    issues.push(
      issue("SIM-003", "prescribed-drive", "info", "L2_KINEMATIC", [shaftId],
        drive.kind === "NOMINAL_TIME"
          ? "Running at nominal time: the minutes hand is prescribed to turn once per hour. This is a kinematic input, not an energy source; no torque, energy or power reserve is modeled."
          : "The drive is a prescribed angular velocity, not an energy source. No torque, energy or power reserve is modeled.",
        ["ASM-0007"]),
    );
  }

  for (const conflict of train.conflicts) {
    const shaft = movement.shafts[conflict.shaftId];
    const viaId = conflict.via.kind === "MESH" ? conflict.via.meshId : conflict.via.couplingId;
    issues.push(
      issue("ASSY-001", "over-constrained", "error", "L2_KINEMATIC", [conflict.shaftId, viaId],
        `${shaft?.name ?? conflict.shaftId}: over-constrained train, because two paths give different angular velocities.`,
        ["REF-ENG §5.3", "ASM-0001"]),
    );
  }

  if (shaftId !== null) {
    for (const id of train.unreachableShaftIds) {
      const shaft = movement.shafts[id];
      issues.push(
        issue("KIN-001", "unpowered", "warning", "L2_KINEMATIC", [id],
          `${shaft?.name ?? id}: not connected to the drive (unpowered).`, []),
      );
    }
  }
  return issues;
};
