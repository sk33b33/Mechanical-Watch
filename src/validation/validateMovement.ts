import { toMetres } from "@/units/length";
import { toDegrees } from "@/units/angle";
import type { Movement } from "@/domain/movement";
import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { isValidToothCount, isValidModule, MIN_TOOTH_COUNT } from "@/math/gearMath";
import { computeGearMeshGeometry } from "@/kinematics/gearMeshGeometry";
import { solveGearTrain } from "@/kinematics/solveGearTrain";
import type { ValidationIssue } from "./validationIssue";

let issueSequence = 0;
function nextIssueId(): string {
  issueSequence += 1;
  return `issue_${String(issueSequence)}`;
}

function gearAddendumRadius(gear: Gear): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius + toMetres(gear.module);
}

/**
 * Runs every Milestone-1 validation rule against a movement and returns
 * a flat, ordered list of issues. Warnings never block a design from
 * being treated as valid at its current validation level; errors do.
 * See docs/ENGINEERING_RULES.md "Validation".
 */
export function validateMovement(movement: Movement): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const gear of Object.values(movement.gears)) {
    if (!isValidToothCount(gear.toothCount)) {
      issues.push({
        id: nextIssueId(),
        severity: "error",
        category: "gear-parameters",
        entityIds: [gear.id],
        message: `${gear.name}: tooth count must be an integer >= ${String(MIN_TOOTH_COUNT)}.`,
        rule: "valid-tooth-count",
        validationLevel: "GEOMETRIC",
      });
    }
    if (!isValidModule(gear.module)) {
      issues.push({
        id: nextIssueId(),
        severity: "error",
        category: "gear-parameters",
        entityIds: [gear.id],
        message: `${gear.name}: module must be a positive length.`,
        rule: "valid-module",
        validationLevel: "GEOMETRIC",
      });
    }
  }

  for (const mesh of Object.values(movement.gearMeshes)) {
    const drivingGear = movement.gears[mesh.drivingGearId];
    const drivenGear = movement.gears[mesh.drivenGearId];
    if (drivingGear === undefined || drivenGear === undefined) {
      issues.push({
        id: nextIssueId(),
        severity: "error",
        category: "mesh-compatibility",
        entityIds: [mesh.id],
        message: "Gear mesh references a gear that no longer exists.",
        rule: "mesh-references-existing-gears",
        validationLevel: "GEOMETRIC",
      });
      continue;
    }

    if (!isValidModule(drivingGear.module) || !isValidModule(drivenGear.module)) {
      continue;
    }

    if (Math.abs(drivingGear.module - drivenGear.module) > 1e-9) {
      issues.push({
        id: nextIssueId(),
        severity: "error",
        category: "mesh-compatibility",
        entityIds: [mesh.id, drivingGear.id, drivenGear.id],
        message: `${drivingGear.name} and ${drivenGear.name} have incompatible modules and cannot mesh.`,
        rule: "compatible-module",
        validationLevel: "GEOMETRIC",
      });
    }

    if (Math.abs(drivingGear.pressureAngle - drivenGear.pressureAngle) > 1e-9) {
      issues.push({
        id: nextIssueId(),
        severity: "error",
        category: "mesh-compatibility",
        entityIds: [mesh.id, drivingGear.id, drivenGear.id],
        message: `${drivingGear.name} (${toDegrees(drivingGear.pressureAngle).toFixed(1)}°) and ${drivenGear.name} (${toDegrees(drivenGear.pressureAngle).toFixed(1)}°) assume different pressure angles.`,
        rule: "compatible-pressure-angle",
        validationLevel: "GEOMETRIC",
      });
    }

    if (isValidToothCount(drivingGear.toothCount) && isValidToothCount(drivenGear.toothCount)) {
      const geometry = computeGearMeshGeometry(movement, mesh);
      if (!geometry.isAchievable) {
        issues.push({
          id: nextIssueId(),
          severity: "error",
          category: "mesh-compatibility",
          entityIds: [mesh.id, drivingGear.id, drivenGear.id],
          message: `${drivingGear.name}/${drivenGear.name}: shaft placement does not match the centre distance implied by module and tooth counts.`,
          rule: "achievable-centre-distance",
          validationLevel: "GEOMETRIC",
        });
      }
    }
  }

  const gears = Object.values(movement.gears);
  const meshedPairs = new Set(
    Object.values(movement.gearMeshes).map((mesh) => [mesh.drivingGearId, mesh.drivenGearId].sort().join("::")),
  );
  for (let i = 0; i < gears.length; i += 1) {
    for (let j = i + 1; j < gears.length; j += 1) {
      const gearA = gears[i];
      const gearB = gears[j];
      if (gearA === undefined || gearB === undefined) {
        continue;
      }
      if (meshedPairs.has([gearA.id, gearB.id].sort().join("::"))) {
        continue;
      }
      const shaftA = movement.shafts[gearA.shaftId];
      const shaftB = movement.shafts[gearB.shaftId];
      if (shaftA === undefined || shaftB === undefined || shaftA.id === shaftB.id) {
        continue;
      }
      if (
        !isValidToothCount(gearA.toothCount) ||
        !isValidToothCount(gearB.toothCount) ||
        !isValidModule(gearA.module) ||
        !isValidModule(gearB.module)
      ) {
        // Already reported by the gear-parameters rule above; the
        // interference geometry itself is undefined for invalid params.
        continue;
      }
      const distance = Math.hypot(
        toMetres(shaftA.position.x) - toMetres(shaftB.position.x),
        toMetres(shaftA.position.y) - toMetres(shaftB.position.y),
      );
      const clearance = gearAddendumRadius(gearA) + gearAddendumRadius(gearB);
      if (distance < clearance) {
        issues.push({
          id: nextIssueId(),
          severity: "error",
          category: "interference",
          entityIds: [gearA.id, gearB.id],
          message: `${gearA.name} and ${gearB.name} are not meshed but their addendum circles overlap (interference).`,
          rule: "no-unintended-interference",
          validationLevel: "GEOMETRIC",
        });
      }
    }
  }

  const solution = solveGearTrain(movement);
  for (const conflict of solution.conflicts) {
    const shaft = movement.shafts[conflict.shaftId];
    issues.push({
      id: nextIssueId(),
      severity: "error",
      category: "gear-train-consistency",
      entityIds: [conflict.shaftId],
      message: `${shaft?.name ?? conflict.shaftId}: gear train is over-constrained — two paths disagree on angular velocity.`,
      rule: "consistent-gear-train",
      validationLevel: "KINEMATIC",
    });
  }
  if (movement.drivingShaftId !== null) {
    for (const shaftId of solution.unreachableShaftIds) {
      const shaft = movement.shafts[shaftId];
      issues.push({
        id: nextIssueId(),
        severity: "warning",
        category: "connectivity",
        entityIds: [shaftId],
        message: `${shaft?.name ?? shaftId}: not connected to the driving shaft (unpowered).`,
        rule: "connected-to-drive",
        validationLevel: "KINEMATIC",
      });
    }
  }

  return issues;
}
