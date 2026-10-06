import { oscillatingShaftIds } from "@/domain/escapement";
import { dateStarShaftIds } from "@/domain/dateComplication";
import { monthStarShaftIds } from "@/domain/monthComplication";
import type { EntityId } from "@/domain/ids";
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
          ? "Running at nominal time: the minutes hand is prescribed to turn once per hour. This is a kinematic input, not an energy source. Speeds do not depend on torque; mainspring energy, when entered, is a separate simplified model (SPR-002, ASM-0026)."
          : drive.kind === "BALANCE"
            ? "Governed by the balance: its free frequency (simplified dynamic model) sets the escape arbor's speed. It is not an energy source. Speeds do not depend on torque; mainspring energy, when entered, is a separate simplified model (SPR-002, ASM-0026)."
            : "The drive is a prescribed angular velocity, not an energy source. Speeds do not depend on torque; mainspring energy, when entered, is a separate simplified model (SPR-002, ASM-0026).",
        drive.kind === "BALANCE" ? ["ASM-0007", "ASM-0024"] : ["ASM-0007"]),
    );
  }

  for (const conflict of train.conflicts) {
    const via = conflict.via;
    const viaId = via.kind === "MESH" ? via.meshId : via.kind === "COUPLING" ? via.couplingId : via.keylessId;
    const name = conflict.shaftId in movement.shafts
      ? movement.shafts[conflict.shaftId as keyof typeof movement.shafts]?.name ?? conflict.shaftId
      : `${movement.keylessWorks[conflict.shaftId.split("/")[0] as keyof typeof movement.keylessWorks]?.name ?? "Keyless works"} stem`;
    if (via.kind === "KEYLESS" && via.part === "CLICK") {
      issues.push(
        issue("KEY-003", "click-blocks-train", "error", "L2_KINEMATIC", [conflict.shaftId as EntityId, viaId],
          `${name}: the running train turns the ratchet wheel, but the click holds it still. The ratchet must only be turned by winding.`,
          ["REF-ENG §11", "ASM-0019"]),
      );
      continue;
    }
    issues.push(
      issue("ASSY-001", "over-constrained", "error", "L2_KINEMATIC", [conflict.shaftId as EntityId, viaId],
        `${name}: over-constrained train, because two paths give different angular velocities.`,
        ["REF-ENG §5.3", "ASM-0001"]),
    );
  }

  if (shaftId !== null) {
    // Pallet arbor and balance staff oscillate under the escapement; they are not meant to be gear-driven (ESC-102).
    const oscillating = oscillatingShaftIds(movement.escapements);
    // Date and month star arbors advance only by a jump, not continuous propagation (ASM-0048/0049); DATE-003/MONTH-002 report their own drive state.
    const dateStars = dateStarShaftIds(movement.dateComplications);
    const monthStars = monthStarShaftIds(movement.monthComplications);
    for (const id of train.unreachableShaftIds) {
      if (oscillating.has(id) || dateStars.has(id) || monthStars.has(id)) continue;
      const shaft = movement.shafts[id];
      issues.push(
        issue("KIN-001", "unpowered", "warning", "L2_KINEMATIC", [id],
          `${shaft?.name ?? id}: not connected to the drive (unpowered).`, []),
      );
    }
  }
  return issues;
};
