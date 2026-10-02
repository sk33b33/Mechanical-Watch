import { toDegrees } from "@/units/angle";
import type { Gear } from "@/domain/gear";
import type { EntityId } from "@/domain/ids";
import { isValidModule, isValidToothCount } from "@/math/gearMath";
import { minimumToothCountForNoUndercut } from "@/math/involute";
import { CYCLOID_TOOTH_PROPORTIONS } from "@/math/cycloidTooth";
import { effectiveLeafCount } from "@/geometry/watchSpecificGearOutline";
import { computeGearMeshGeometry } from "@/kinematics/gearMeshGeometry";
import { gearZRange, zOverlaps } from "@/assembly/assemblyGeometry";
import type { ValidationIssue } from "../validationIssue";
import { hasValidGearParameters, issue, mm, type Rule } from "./context";

function formatPressureAngle(gear: Gear): string {
  return gear.pressureAngle === null ? "not modeled" : `${toDegrees(gear.pressureAngle).toFixed(1)}°`;
}

function formatToothCount(value: number): string {
  return Number.isNaN(value) ? "no value" : String(value);
}

/** GEAR-001, GEAR-002 and dangling gear → shaft references (ASSY-001). */
export const gearParameterRules: Rule = ({ movement }) => {
  const issues: ValidationIssue[] = [];
  for (const gear of Object.values(movement.gears)) {
    if (!isValidToothCount(gear.toothCount)) {
      issues.push(
        issue("GEAR-001", "tooth-count", "error", "L1_GEOMETRIC", [gear.id],
          `${gear.name}: tooth count must be a positive integer (got ${formatToothCount(gear.toothCount)}).`,
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
    if (gear.profileModel === "INVOLUTE_PROFILE") {
      if (gear.pressureAngle === null) {
        issues.push(
          issue("GEAR-103", "pressure-angle-required", "error", "L1_GEOMETRIC", [gear.id],
            `${gear.name}: an involute profile needs a pressure angle.`, ["REF-ENG §6", "ASM-0030"]),
        );
      } else if (isValidToothCount(gear.toothCount) && gear.toothCount < minimumToothCountForNoUndercut(gear.pressureAngle)) {
        issues.push(
          issue("GEAR-103", "undercut", "warning", "L1_GEOMETRIC", [gear.id],
            `${gear.name}: ${String(gear.toothCount)} teeth is below the standard no-undercut threshold `
            + `(${String(minimumToothCountForNoUndercut(gear.pressureAngle))} at ${formatPressureAngle(gear)}); `
            + `the drawn dedendum is a circular-arc approximation, not the true trochoidal undercut form.`,
            ["REF-ENG §6", "ASM-0031"]),
        );
      }
    }
    if (gear.profileModel === "WATCH_SPECIFIC_PROFILE" && isValidToothCount(gear.toothCount)) {
      const leafCount = effectiveLeafCount(gear, movement);
      if (leafCount < CYCLOID_TOOTH_PROPORTIONS.minimumToothCount) {
        const because = leafCount === gear.toothCount ? "" : ` (its mesh pinion partner's ${String(leafCount)} leaves govern, not its own ${String(gear.toothCount)})`;
        issues.push(
          issue("GEAR-104", "below-table-range", "error", "L1_GEOMETRIC", [gear.id],
            `${gear.name}: an effective leaf count of ${String(leafCount)}${because} is below the cycloidal `
            + `tooth-form table's range (${String(CYCLOID_TOOTH_PROPORTIONS.minimumToothCount)} leaves minimum, SRC-0026).`,
            ["REF-ENG §6", "ASM-0032", "ASM-0033"]),
        );
      }
    }
  }
  return issues;
};

/** GEAR-003 compatibility and GEAR-004 centre distance for every mesh. */
export const meshRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
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

    if (drivingGear.shaftId === drivenGear.shaftId) {
      issues.push(
        issue("ASSY-001", "mesh-same-shaft", "error", "L1_GEOMETRIC", pair,
          `${pairName}: both gears are on the same shaft and cannot mesh.`, []),
      );
      continue;
    }
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

    const axialOk = [drivingGear, drivenGear].every(
      (g) => Number.isFinite(g.zCentre) && Number.isFinite(g.thickness) && g.thickness > 0,
    );
    if (axialOk && !zOverlaps(gearZRange(drivingGear), gearZRange(drivenGear))) {
      issues.push(
        issue("GEAR-101", "axial-engagement", "error", "L1_GEOMETRIC", pair,
          `${pairName}: the gears do not overlap axially, so they cannot engage.`, []),
      );
    }

    const geometry = computeGearMeshGeometry(movement, mesh, placement);
    if (geometry !== null && !geometry.isAchievable) {
      issues.push(
        issue("GEAR-004", "centre-distance", "error", "L1_GEOMETRIC", pair,
          `${pairName}: shaft spacing ${mm(geometry.actualCentreDistance)} does not match the ideal centre distance ${mm(geometry.idealCentreDistance)}.`,
          ["REF-ENG §5.2", "ASM-0008"]),
      );
    }
  }
  return issues;
};
