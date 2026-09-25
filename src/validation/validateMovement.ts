import { toMetres } from "@/units/length";
import { toDegrees } from "@/units/angle";
import type { Movement } from "@/domain/movement";
import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import type { Shaft } from "@/domain/shaft";
import type { EntityId } from "@/domain/ids";
import { isValidToothCount, isValidModule } from "@/math/gearMath";
import { computeGearMeshGeometry } from "@/kinematics/gearMeshGeometry";
import { solveGearTrain } from "@/kinematics/solveGearTrain";
import { visualTipRadius } from "@/geometry/gearOutline";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { RuleId } from "@/reference/ruleIds";
import type {
  ReferenceId,
  ValidationIssue,
  ValidationLevel,
  ValidationSeverity,
} from "./validationIssue";

function issue(
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

function hasValidGearParameters(gear: Gear): boolean {
  return isValidToothCount(gear.toothCount) && isValidModule(gear.module);
}

function hasValidAxis(shaft: Shaft): boolean {
  return Number.isFinite(shaft.position.x) && Number.isFinite(shaft.position.y);
}

function axisDistance(a: Shaft, b: Shaft): number {
  return Math.hypot(
    toMetres(a.position.x) - toMetres(b.position.x),
    toMetres(a.position.y) - toMetres(b.position.y),
  );
}

function formatPressureAngle(gear: Gear): string {
  return gear.pressureAngle === null ? "not modeled" : `${toDegrees(gear.pressureAngle).toFixed(1)}°`;
}

/**
 * Runs every implemented rule (reference/validation/VALIDATION_RULES.md)
 * against a movement. Output order and issue IDs are deterministic.
 * Warnings and info never block a declared level; errors and blockers do.
 */
export function validateMovement(movement: Movement): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const shaft of Object.values(movement.shafts)) {
    if (!hasValidAxis(shaft)) {
      issues.push(
        issue("SHAFT-001", "axis", "error", "L1_GEOMETRIC", [shaft.id],
          `${shaft.name}: axis position is not a finite coordinate.`, ["ASM-0006"]),
      );
    }
  }

  for (const gear of Object.values(movement.gears)) {
    if (!isValidToothCount(gear.toothCount)) {
      issues.push(
        issue("GEAR-001", "tooth-count", "error", "L1_GEOMETRIC", [gear.id],
          `${gear.name}: tooth count must be a positive integer (got ${String(gear.toothCount)}).`,
          ["REF-ENG §5.6"]),
      );
    }
    if (!isValidModule(gear.module)) {
      issues.push(
        issue("GEAR-002", "module", "error", "L1_GEOMETRIC", [gear.id],
          `${gear.name}: module must be a positive length.`, ["REF-ENG §5.6"]),
      );
    }
    if (movement.shafts[gear.shaftId] === undefined) {
      issues.push(
        issue("ASSY-001", "gear-shaft", "error", "L1_GEOMETRIC", [gear.id],
          `${gear.name}: mounted on a shaft that does not exist.`, []),
      );
    }
  }

  for (const mesh of Object.values(movement.gearMeshes)) {
    const drivingGear = movement.gears[mesh.drivingGearId];
    const drivenGear = movement.gears[mesh.drivenGearId];
    if (drivingGear === undefined || drivenGear === undefined) {
      issues.push(
        issue("ASSY-001", "mesh-gears", "error", "L1_GEOMETRIC", [mesh.id],
          "Gear mesh references a gear that does not exist.", []),
      );
      continue;
    }
    const pair: EntityId[] = [mesh.id, drivingGear.id, drivenGear.id];
    const pairName = `${drivingGear.name}/${drivenGear.name}`;

    if (drivingGear.profileModel !== drivenGear.profileModel) {
      issues.push(
        issue("GEAR-003", "profile-model", "error", "L1_GEOMETRIC", pair,
          `${pairName}: different tooth-profile models (${drivingGear.profileModel} vs ${drivenGear.profileModel}).`,
          ["REF-ENG §6"]),
      );
    }
    const angleA = drivingGear.pressureAngle;
    const angleB = drivenGear.pressureAngle;
    if ((angleA === null) !== (angleB === null) || (angleA !== null && angleB !== null && angleA !== angleB)) {
      issues.push(
        issue("GEAR-003", "pressure-angle", "error", "L1_GEOMETRIC", pair,
          `${pairName}: incompatible pressure-angle assumptions (${formatPressureAngle(drivingGear)} vs ${formatPressureAngle(drivenGear)}).`,
          ["REF-ENG §5.6"]),
      );
    }

    if (!hasValidGearParameters(drivingGear) || !hasValidGearParameters(drivenGear)) {
      continue;
    }
    if (drivingGear.module !== drivenGear.module) {
      issues.push(
        issue("GEAR-003", "module", "error", "L1_GEOMETRIC", pair,
          `${pairName}: different modules cannot mesh.`, ["REF-ENG §5.6"]),
      );
      continue;
    }

    const shaftA = movement.shafts[drivingGear.shaftId];
    const shaftB = movement.shafts[drivenGear.shaftId];
    if (shaftA === undefined || shaftB === undefined || !hasValidAxis(shaftA) || !hasValidAxis(shaftB)) {
      continue;
    }
    const geometry = computeGearMeshGeometry(movement, mesh);
    if (!geometry.isAchievable) {
      issues.push(
        issue("GEAR-004", "centre-distance", "error", "L1_GEOMETRIC", pair,
          `${pairName}: shaft spacing ${(toMetres(geometry.actualCentreDistance) * 1000).toFixed(4)} mm does not match the ideal centre distance ${(toMetres(geometry.idealCentreDistance) * 1000).toFixed(4)} mm.`,
          ["REF-ENG §5.2", "ASM-0008"]),
      );
    }
  }

  const meshedPairs = new Set(
    Object.values(movement.gearMeshes).map((mesh) =>
      [mesh.drivingGearId, mesh.drivenGearId].sort().join("::"),
    ),
  );
  const gears = Object.values(movement.gears);
  for (let i = 0; i < gears.length; i += 1) {
    for (let j = i + 1; j < gears.length; j += 1) {
      const gearA = gears[i];
      const gearB = gears[j];
      if (gearA === undefined || gearB === undefined) continue;
      if (meshedPairs.has([gearA.id, gearB.id].sort().join("::"))) continue;
      if (!hasValidGearParameters(gearA) || !hasValidGearParameters(gearB)) continue;
      const shaftA = movement.shafts[gearA.shaftId];
      const shaftB = movement.shafts[gearB.shaftId];
      if (shaftA === undefined || shaftB === undefined || shaftA.id === shaftB.id) continue;
      if (!hasValidAxis(shaftA) || !hasValidAxis(shaftB)) continue;

      const distance = axisDistance(shaftA, shaftB);
      const pitchReach = (toMetres(gearPitchDiameter(gearA)) + toMetres(gearPitchDiameter(gearB))) / 2;
      const pair: EntityId[] = [gearA.id, gearB.id];
      if (distance < pitchReach - NUMERICAL_PARAMETERS.centreDistanceToleranceMetres) {
        issues.push(
          issue("ASSY-002", "pitch-overlap", "error", "L1_GEOMETRIC", pair,
            `${gearA.name} and ${gearB.name} are not meshed but their pitch circles overlap.`,
            ["REF-ENG §5.6"]),
        );
      } else if (distance < visualTipRadius(gearA) + visualTipRadius(gearB)) {
        issues.push(
          issue("ASSY-002", "visual-tip-overlap", "warning", "L0_VISUAL", pair,
            `${gearA.name} and ${gearB.name}: visualized tooth tips overlap. Tip geometry is a visual approximation, so real clearance is unknown.`,
            ["ASM-0005"]),
        );
      }
    }
  }

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

  const solution = solveGearTrain(movement);
  for (const conflict of solution.conflicts) {
    const shaft = movement.shafts[conflict.shaftId];
    issues.push(
      issue("ASSY-001", "over-constrained", "error", "L2_KINEMATIC", [conflict.shaftId, conflict.computedFromMeshId],
        `${shaft?.name ?? conflict.shaftId}: over-constrained gear train, because two paths give different angular velocities.`,
        ["REF-ENG §5.3", "ASM-0001"]),
    );
  }
  if (movement.drivingShaftId !== null) {
    for (const shaftId of solution.unreachableShaftIds) {
      const shaft = movement.shafts[shaftId];
      issues.push(
        issue("KIN-001", "unpowered", "warning", "L2_KINEMATIC", [shaftId],
          `${shaft?.name ?? shaftId}: not connected to the driving shaft (unpowered).`, []),
      );
    }
  }

  return issues;
}
