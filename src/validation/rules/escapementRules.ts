import { distance } from "@/math/vec2";
import { isValidModule, isValidToothCount, pitchDiameter } from "@/math/gearMath";
import { toRpm } from "@/units/angularVelocity";
import { toDegrees } from "@/units/angle";
import { toBeatsPerHour } from "@/units/frequency";
import type { EntityId } from "@/domain/ids";
import { gearZRange, zOverlaps } from "@/assembly/assemblyGeometry";
import { balanceFrequency, beatFrequency, impulseFraction } from "@/kinematics/escapement";
import type { ValidationIssue } from "../validationIssue";
import { issue, mm, type Rule } from "./context";

const positive = (v: number): boolean => Number.isFinite(v) && v > 0;

/**
 * ESC-001 / ESC-002 (the model level and what it does not claim) and
 * ESC-101…103 (project additions) for the simplified escapement.
 */
export const escapementRules: Rule = ({ movement, placement, train }) => {
  const issues: ValidationIssue[] = [];
  const all = Object.values(movement.escapements);
  if (all.length > 1) {
    issues.push(
      issue("ESC-101", "several", "error", "L1_GEOMETRIC", all.map((e) => e.id),
        `The movement has ${String(all.length)} escapements; one is expected, and only the first is simulated.`, ["ASM-0023"]),
    );
  }

  for (const esc of all) {
    const ids: EntityId[] = [esc.id];
    const shafts = {
      escape: movement.shafts[esc.escapeArborShaftId],
      pallet: movement.shafts[esc.palletArborShaftId],
      balance: movement.shafts[esc.balanceShaftId],
    };
    const missing = (Object.entries(shafts) as [string, unknown][]).filter(([, s]) => s === undefined).map(([k]) => (k === "escape" ? "escape arbor" : k === "pallet" ? "pallet arbor" : "balance staff"));
    if (missing.length > 0) {
      issues.push(
        issue("ESC-101", "missing-arbor", "error", "L1_GEOMETRIC", ids,
          `${esc.name}: choose its ${missing.join(", ")} in the inspector.`, []),
      );
    }
    const chosen = [esc.escapeArborShaftId, esc.palletArborShaftId, esc.balanceShaftId];
    if (missing.length === 0 && new Set(chosen).size < 3) {
      issues.push(
        issue("ESC-101", "same-arbor", "error", "L1_GEOMETRIC", ids,
          `${esc.name}: the escape arbor, pallet arbor and balance staff must be three different arbors.`, []),
      );
    }
    const w = esc.escapeWheel;
    const b = esc.balance;
    const inputProblems: string[] = [
      ...(isValidToothCount(w.toothCount) ? [] : ["the escape wheel's tooth count must be a positive whole number"]),
      ...(positive(w.tipDiameter) ? [] : ["the escape wheel's tip diameter must be a positive length"]),
      ...(positive(w.thickness) && Number.isFinite(w.zCentre) ? [] : ["the escape wheel needs a positive thickness and a finite height"]),
      ...(positive(esc.leverAngle) ? [] : ["the lever angle must be a positive angle"]),
      ...(positive(b.diameter) ? [] : ["the balance diameter must be a positive length"]),
      ...(positive(b.thickness) && Number.isFinite(b.zCentre) ? [] : ["the balance needs a positive thickness and a finite height"]),
      ...(positive(b.liftAngle) ? [] : ["the lift angle must be a positive angle"]),
      ...(positive(b.amplitude) ? [] : ["the balance amplitude must be a positive angle"]),
    ];
    for (const problem of inputProblems) {
      issues.push(issue("ESC-101", problem, "error", "L1_GEOMETRIC", ids, `${esc.name}: ${problem}.`, []));
    }
    if (positive(b.liftAngle) && positive(b.amplitude) && impulseFraction(b.amplitude, b.liftAngle) === null) {
      issues.push(
        issue("ESC-101", "amplitude-below-lift", "error", "L2_KINEMATIC", ids,
          `${esc.name}: an amplitude of ${toDegrees(b.amplitude).toFixed(1)}° does not exceed half the lift angle (${(toDegrees(b.liftAngle) / 2).toFixed(1)}°), so the balance would never leave the escapement.`,
          ["ASM-0022", "ASM-0023"]),
      );
    }

    // ESC-102: oscillating arbors are not part of the gear train.
    for (const [role, shaft] of [["pallet arbor", shafts.pallet], ["balance staff", shafts.balance]] as const) {
      if (shaft === undefined) continue;
      const geared = Object.values(movement.gearMeshes).some((mesh) =>
        [movement.gears[mesh.drivingGearId], movement.gears[mesh.drivenGearId]].some((g) => g?.shaftId === shaft.id));
      if (geared || train.shaftAngularVelocity.has(shaft.id)) {
        issues.push(
          issue("ESC-102", `geared-${role}`, "error", "L2_KINEMATIC", [esc.id, shaft.id],
            `${esc.name}: the ${role} (${shaft.name}) is turned by the gear train, but it must only oscillate under the escapement.`,
            ["REF-ENG §9", "ASM-0023"]),
        );
      }
    }

    // ESC-103: clearances in plan, where the parts share height.
    const at = {
      escape: placement.shaftPositions.get(esc.escapeArborShaftId),
      pallet: placement.shaftPositions.get(esc.palletArborShaftId),
      balance: placement.shaftPositions.get(esc.balanceShaftId),
    };
    const tipR = w.tipDiameter / 2;
    const balanceR = b.diameter / 2;
    if (at.escape !== undefined && positive(tipR)) {
      if (at.pallet !== undefined && distance(at.escape, at.pallet) <= tipR) {
        issues.push(
          issue("ESC-103", "wheel-pallet-arbor", "error", "L1_GEOMETRIC", [esc.id, esc.palletArborShaftId],
            `${esc.name}: the pallet arbor lies inside the escape wheel's tip circle (${mm(distance(at.escape, at.pallet))} from its axis, tip radius ${mm(tipR)}).`,
            ["REF-ENG §9"]),
        );
      }
      const wheelRange = { lo: w.zCentre - w.thickness / 2, hi: w.zCentre + w.thickness / 2 };
      if (at.balance !== undefined && positive(balanceR) && Number.isFinite(b.zCentre) && positive(b.thickness)) {
        const balanceRange = { lo: b.zCentre - b.thickness / 2, hi: b.zCentre + b.thickness / 2 };
        if (zOverlaps(wheelRange, balanceRange) && distance(at.escape, at.balance) < tipR + balanceR) {
          issues.push(
            issue("ESC-103", "wheel-balance", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: the escape wheel and the balance overlap at the same height.`, ["REF-ENG §9"]),
          );
        }
      }
      for (const gear of Object.values(movement.gears)) {
        if (gear.shaftId === esc.escapeArborShaftId || !isValidToothCount(gear.toothCount) || !isValidModule(gear.module)) continue;
        const g = placement.shaftPositions.get(gear.shaftId);
        if (g === undefined || !Number.isFinite(gear.zCentre) || !positive(gear.thickness)) continue;
        if (zOverlaps(wheelRange, gearZRange(gear)) && distance(at.escape, g) < tipR + pitchDiameter(gear.module, gear.toothCount) / 2) {
          issues.push(
            issue("ESC-103", "wheel-gear", "error", "L1_GEOMETRIC", [esc.id, gear.id],
              `${esc.name}: the escape wheel overlaps ${gear.name} at the same height.`, ["REF-ENG §9"]),
          );
        }
      }
    }
    if (at.balance !== undefined && at.pallet !== undefined && positive(balanceR) && distance(at.balance, at.pallet) <= balanceR) {
      issues.push(
        issue("ESC-103", "balance-pallet-arbor", "error", "L1_GEOMETRIC", [esc.id, esc.palletArborShaftId],
          `${esc.name}: the balance rim would cross the pallet arbor (${mm(distance(at.balance, at.pallet))} apart, balance radius ${mm(balanceR)}).`,
          ["REF-ENG §9"]),
      );
    }

    // ESC-001 / ESC-002: the declared model and what it does not claim.
    const omega = train.shaftAngularVelocity.get(esc.escapeArborShaftId);
    const rate = omega !== undefined && omega !== 0 && isValidToothCount(w.toothCount)
      ? (() => {
          const beats = beatFrequency(omega, w.toothCount);
          return ` At the current drive the escape arbor turns at ${Math.abs(toRpm(omega)).toFixed(3)} rev/min, so the model gives ${toBeatsPerHour(beats).toFixed(0)} beats per hour and requires a balance frequency of ${balanceFrequency(beats).toFixed(3)} Hz.`;
        })()
      : " The escape arbor is not turned by the running train, so no beat rate is derived.";
    issues.push(
      issue("ESC-001", "declared", "info", "L2_KINEMATIC", [esc.id],
        `${esc.name}: SIMPLIFIED ESCAPEMENT MODEL (Swiss lever, kinematic).${rate}`,
        ["REF-ENG §9", "ASM-0021", "ASM-0022"]),
      issue("ESC-002", "no-contact-claim", "info", "L2_KINEMATIC", [esc.id],
        `${esc.name}: locking, draw, drop, impact, sliding contact, banking geometry and the balance's dynamics are not modeled. The balance is shown at a declared amplitude; nothing here predicts rate accuracy. Requires physical validation.`,
        ["REF-ENG §9", "REF-ENG §10", "ASM-0023"]),
    );
  }
  return issues;
};
