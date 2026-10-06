import { distance } from "@/math/vec2";
import { isValidModule, isValidToothCount, pitchDiameter } from "@/math/gearMath";
import { toRpm } from "@/units/angularVelocity";
import { radians, toDegrees } from "@/units/angle";
import { toBeatsPerHour } from "@/units/frequency";
import type { EntityId } from "@/domain/ids";
import { gearZRange, zOverlaps } from "@/assembly/assemblyGeometry";
import { balanceFrequency, beatFrequency, impulseFraction } from "@/kinematics/escapement";
import { dropClearance, forkActingLength, forkRatio, guardPointClearance, impulseAngle, isHalfToothSpan, spanAngle, suggestedRubyPinWidth, tangentialCentreDistance, toothDrawAngle, toothWidthAngle, wheelAngleBudgetPerBeat } from "@/kinematics/palletGeometry";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { Length } from "@/units/length";
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

    // ESC-104 / ESC-105: simplified pallet geometry (ASM-0025), when given.
    const pg = esc.pallets;
    let dropDeclared = false;
    if (pg !== null) {
      const tipRadius = w.tipDiameter / 2;
      if (!isHalfToothSpan(pg.spanTeeth)) {
        issues.push(
          issue("ESC-104", "span", "error", "L1_GEOMETRIC", [esc.id],
            `${esc.name}: the pallets span ${String(pg.spanTeeth)} teeth; two beats per tooth needs a whole number of pitches plus a half (e.g. 2½, 3½).`,
            ["ASM-0021", "ASM-0025"]),
        );
      } else if (isValidToothCount(w.toothCount) && positive(tipRadius)) {
        const span = spanAngle(w.toothCount, pg.spanTeeth);
        const needed = tangentialCentreDistance(tipRadius as Length, span);
        if (needed === null) {
          issues.push(
            issue("ESC-104", "span-too-wide", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: the pallets' span (${toDegrees(span).toFixed(1)}°) must be under 180° for tangential locking.`, ["ASM-0025"]),
          );
        } else if (at.escape !== undefined && at.pallet !== undefined) {
          const actual = distance(at.escape, at.pallet);
          if (Math.abs(actual - needed) > NUMERICAL_PARAMETERS.centreDistanceToleranceMetres) {
            issues.push(
              issue("ESC-104", "centre-distance", "error", "L1_GEOMETRIC", [esc.id, esc.palletArborShaftId],
                `${esc.name}: the pallet arbor is ${mm(actual)} from the escape axis; tangential locking over ${String(pg.spanTeeth)} teeth needs ${mm(needed)}, so the pallets do not meet the locking points.`,
                ["ASM-0025"]),
            );
          }
        }
      }
      const impulse = impulseAngle(esc.leverAngle, pg.lockAngle, pg.runAngle);
      const angleProblems = [
        ...(positive(pg.lockAngle) ? [] : ["the lock angle must be positive"]),
        ...(Number.isFinite(pg.runAngle) && pg.runAngle >= 0 ? [] : ["the run angle must not be negative"]),
        ...(positive(esc.leverAngle) && positive(pg.lockAngle) && Number.isFinite(pg.runAngle) && !(impulse > 0)
          ? [`lock and run (${toDegrees(pg.lockAngle).toFixed(2)}° + ${toDegrees(pg.runAngle).toFixed(2)}°) leave no impulse within the lever angle (${toDegrees(esc.leverAngle).toFixed(2)}°)`]
          : []),
      ];
      for (const problem of angleProblems) {
        issues.push(issue("ESC-105", problem, "error", "L1_GEOMETRIC", [esc.id], `${esc.name}: ${problem}.`, ["ASM-0025"]));
      }
      if (!positive(pg.drawAngle)) {
        issues.push(
          issue("ESC-105", "no-draw", "warning", "L1_GEOMETRIC", [esc.id],
            `${esc.name}: without a positive draw angle nothing pulls the lever onto its banking. Whether a given draw overcomes friction is not checked.`,
            ["ASM-0025"]),
        );
      } else {
        // ESC-108: the escape tooth's own locking face, derived as conventionally double the pallet's draw (ASM-0039, SRC-0036).
        const toothDraw = toothDrawAngle(pg.drawAngle);
        issues.push(
          issue("ESC-108", "tooth-draw", "info", "L1_GEOMETRIC", [esc.id],
            `${esc.name}: escape-tooth locking face is ${toDegrees(toothDraw).toFixed(2)}° from the radial (conventionally double the pallet's own ${toDegrees(pg.drawAngle).toFixed(2)}° draw, for point contact, ASM-0039).`,
            ["ASM-0039"]),
        );
        if (toDegrees(toothDraw) < 20 || toDegrees(toothDraw) > 28) {
          issues.push(
            issue("ESC-108", "tooth-draw-advisory", "info", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: the derived escape-tooth locking face (${toDegrees(toothDraw).toFixed(2)}°) is outside the practical range Playtner cites for this convention (20°-28°, ASM-0039, SRC-0036) — too little surface in contact with the jewel below it, too much wear on the tooth's locking edge above it.`,
              ["ASM-0039"]),
          );
        }
      }

      // ESC-110: ruby-pin entry freedom and slot shake (optional), and the derived suggested width (ASM-0042, SRC-0036 "The Fork and Roller Action").
      const totalLock = positive(pg.lockAngle) && Number.isFinite(pg.runAngle) && pg.runAngle >= 0 ? radians(pg.lockAngle + pg.runAngle) : null;
      if (pg.rubyPinEntryFreedom !== null) {
        if (!positive(pg.rubyPinEntryFreedom)) {
          issues.push(
            issue("ESC-110", "entry-freedom", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: the ruby-pin entry freedom must be positive, or left empty (unknown).`, ["ASM-0042"]),
          );
        } else if (totalLock !== null && !(pg.rubyPinEntryFreedom < totalLock)) {
          issues.push(
            issue("ESC-110", "entry-freedom-lock", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: ruby-pin entry freedom (${toDegrees(pg.rubyPinEntryFreedom).toFixed(2)}°) must be less than the total lock (lock + run = ${toDegrees(totalLock).toFixed(2)}°) — otherwise a premature strike against the fork could fully unlock the pallets instead of leaving them locked (ASM-0042, SRC-0036).`,
              ["ASM-0042"]),
          );
        } else if (toDegrees(pg.rubyPinEntryFreedom) < 1 || toDegrees(pg.rubyPinEntryFreedom) > 1.25) {
          issues.push(
            issue("ESC-110", "entry-freedom-advisory", "info", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: ruby-pin entry freedom (${toDegrees(pg.rubyPinEntryFreedom).toFixed(2)}°) is outside the figure Playtner cites (1°-1¼°, ASM-0042, SRC-0036). An informal reference figure, not a validated limit.`,
              ["ASM-0042"]),
          );
        }
      }
      if (pg.rubyPinSlotShake !== null) {
        if (!positive(pg.rubyPinSlotShake)) {
          issues.push(
            issue("ESC-110", "slot-shake", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: the ruby-pin slot shake must be positive, or left empty (unknown).`, ["ASM-0042"]),
          );
        } else if (toDegrees(pg.rubyPinSlotShake) < 0.25 || toDegrees(pg.rubyPinSlotShake) > 0.5) {
          issues.push(
            issue("ESC-110", "slot-shake-advisory", "info", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: ruby-pin slot shake (${toDegrees(pg.rubyPinSlotShake).toFixed(2)}°) is outside the figure Playtner cites (¼°-½°, ASM-0042, SRC-0036). An informal reference figure, not a validated limit.`,
              ["ASM-0042"]),
          );
        }
      }
      if (positive(esc.leverAngle)) {
        const suggested = suggestedRubyPinWidth(esc.leverAngle);
        issues.push(
          issue("ESC-110", "suggested-width", "info", "L1_GEOMETRIC", [esc.id],
            `${esc.name}: a ruby pin width of ${toDegrees(suggested).toFixed(2)}° (half the fork's total angular motion) is Playtner's own cited choice, not a strict rule (ASM-0042, SRC-0036).`,
            ["ASM-0042"]),
        );
      }

      // ESC-111: guard-point freedom and radius (optional), and the derived clearance (ASM-0043, SRC-0036 "The Safety Action").
      if (pg.guardPointFreedom !== null) {
        if (!positive(pg.guardPointFreedom)) {
          issues.push(
            issue("ESC-111", "guard-freedom", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: the guard-point freedom must be positive, or left empty (unknown).`, ["ASM-0043"]),
          );
        } else if (totalLock !== null && !(pg.guardPointFreedom < totalLock)) {
          issues.push(
            issue("ESC-111", "guard-freedom-lock", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: guard-point freedom (${toDegrees(pg.guardPointFreedom).toFixed(2)}°) must be less than the total lock (lock + run = ${toDegrees(totalLock).toFixed(2)}°) — the escape tooth must still rest on the pallet's locking face when the guard point is pressed against the roller (ASM-0043, SRC-0036).`,
              ["ASM-0043"]),
          );
        } else if (pg.guardPointRadius !== null) {
          if (!positive(pg.guardPointRadius)) {
            issues.push(
              issue("ESC-111", "guard-radius", "error", "L1_GEOMETRIC", [esc.id],
                `${esc.name}: the guard-point radius must be positive, or left empty (unknown).`, ["ASM-0043"]),
            );
          } else {
            const clearance = guardPointClearance(pg.guardPointRadius, pg.guardPointFreedom);
            if (clearance !== null) {
              issues.push(
                issue("ESC-111", "guard-clearance", "info", "L1_GEOMETRIC", [esc.id],
                  `${esc.name}: guard-point freedom gives ${mm(clearance)} of clearance at the bank (arc length = radius × angle, ASM-0043).`,
                  ["ASM-0043"]),
              );
            }
          }
        }
      }

      // ESC-106 / ESC-107: drop (ASM-0036, SRC-0036) and the tooth/pallet partition (ASM-0037, ASM-0038), when a tooth count is known.
      if (isValidToothCount(w.toothCount)) {
        const budget = wheelAngleBudgetPerBeat(w.toothCount);
        const dropInBudget = positive(pg.dropAngle) && pg.dropAngle < budget;
        const widthPositive = positive(pg.widthAngle);
        const tooth = toothWidthAngle(w.toothCount, pg.widthAngle, pg.dropAngle);
        // CLUB has its own impulse face (tooth width must be positive); RATCHET is a bare point —
        // "the entire lifting angle is on the pallets" (SRC-0036) — so exactly zero is valid (within
        // floating-point noise from the angle arithmetic, NUMERICAL_PARAMETERS.angleZeroToleranceRadians).
        const toothValid = w.toothKind === "RATCHET" ? tooth >= -NUMERICAL_PARAMETERS.angleZeroToleranceRadians : tooth > 0;
        const partitionValid = dropInBudget && widthPositive && toothValid;
        dropDeclared = partitionValid;
        if (!dropInBudget) {
          issues.push(
            issue("ESC-106", "drop-budget", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: drop (${toDegrees(pg.dropAngle).toFixed(2)}°) must be positive and less than the wheel-angle budget for one beat (${toDegrees(budget).toFixed(2)}° = half the tooth pitch, ASM-0021) — the tooth and pallet still need some of that budget for their own width.`,
              ["ASM-0021", "ASM-0036"]),
          );
        }
        if (!widthPositive) {
          issues.push(
            issue("ESC-106", "pallet-width", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: pallet width (${toDegrees(pg.widthAngle).toFixed(2)}°) must be positive (ASM-0037).`,
              ["ASM-0037"]),
          );
        } else if (dropInBudget && !toothValid) {
          issues.push(
            issue("ESC-106", "tooth-width-budget", "error", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: pallet width (${toDegrees(pg.widthAngle).toFixed(2)}°) plus drop (${toDegrees(pg.dropAngle).toFixed(2)}°) leaves no room for the tooth's own width within the ${toDegrees(budget).toFixed(2)}° per-beat budget (ASM-0021, ASM-0037) — a ${w.toothKind === "RATCHET" ? "ratchet" : "club"} tooth needs it to be ${w.toothKind === "RATCHET" ? "non-negative" : "positive"}.`,
              ["ASM-0021", "ASM-0037", "ASM-0038"]),
          );
        }
        if (partitionValid) {
          const typicalDrop = w.toothKind === "RATCHET" ? 2 : 1.5;
          if (toDegrees(pg.dropAngle) < 1 || toDegrees(pg.dropAngle) > 2) {
            issues.push(
              issue("ESC-107", "drop-advisory", "info", "L1_GEOMETRIC", [esc.id],
                `${esc.name}: drop (${toDegrees(pg.dropAngle).toFixed(2)}°) is outside the figure typically cited for a ${w.toothKind === "RATCHET" ? "ratchet" : "club"}-tooth escapement (${String(typicalDrop)}°, ASM-0036, ASM-0038, SRC-0036). An informal reference figure, not a validated limit.`,
                ["ASM-0036", "ASM-0038"]),
            );
          }
          const clearance = positive(tipRadius) ? dropClearance(tipRadius as Length, pg.dropAngle) : null;
          if (clearance !== null) {
            issues.push(
              issue("ESC-107", "drop-clearance", "info", "L1_GEOMETRIC", [esc.id],
                `${esc.name}: drop gives ${mm(clearance)} of clearance at the tip circle (arc length = radius × angle, ASM-0036).`,
                ["ASM-0036"]),
            );
          }
          issues.push(
            issue("ESC-107", "tooth-width", "info", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: escape-tooth width is ${toDegrees(tooth).toFixed(2)}° (the per-beat budget less the pallet's own width and drop, ASM-0037).`,
              ["ASM-0037"]),
          );
        }
      }
    }

    // ESC-109: impulse radius (optional) and the derived fork acting length (ASM-0041, SRC-0036 "The Fork and Roller Action").
    if (b.impulseRadius !== null) {
      if (!(Number.isFinite(b.impulseRadius) && b.impulseRadius > 0)) {
        issues.push(
          issue("ESC-109", "impulse-radius", "error", "L1_GEOMETRIC", [esc.id],
            `${esc.name}: the impulse radius must be positive, or left empty (unknown).`, ["ASM-0041"]),
        );
      } else {
        const length = forkActingLength(b.impulseRadius, forkRatio(b.liftAngle, esc.leverAngle));
        if (length !== null) {
          issues.push(
            issue("ESC-109", "fork-acting-length", "info", "L1_GEOMETRIC", [esc.id],
              `${esc.name}: fork acting length (pallet centre to ruby-pin contact) is ${mm(length)}, derived from the impulse radius and the balance-lift/lever-angle ratio (ASM-0041, SRC-0036: "the angles are in the inverse ratio to the radii").`,
              ["ASM-0041"]),
          );
        }
      }
    }

    // ESC-111: single-roller fork-ratio floor (ASM-0043, SRC-0036 "The Safety Action").
    if (b.rollerKind === "SINGLE") {
      const ratio = forkRatio(b.liftAngle, esc.leverAngle);
      if (ratio !== null && ratio < 3) {
        issues.push(
          issue("ESC-111", "single-roller-ratio", "info", "L1_GEOMETRIC", [esc.id],
            `${esc.name}: fork ratio (${ratio.toFixed(2)}) is below the figure Playtner cites as the lowest for a single roller ("a proportion between the fork and impulse angles in 10° pallets of 3 or 3½ to 1, depending upon the size of the escapement, is the lowest which should be made in single roller") — in a single roller, the safety action and the impulse compete for the same roller size. A double roller decouples them (ASM-0043, SRC-0036).`,
            ["ASM-0043"]),
        );
      }
    }

    // ESC-001 / ESC-002: the declared model and what it does not claim.
    const omega = train.shaftAngularVelocity.get(esc.escapeArborShaftId);
    const rate = omega !== undefined && omega !== 0 && isValidToothCount(w.toothCount)
      ? (() => {
          const beats = beatFrequency(omega, w.toothCount);
          return ` At the current drive the escape arbor turns at ${Math.abs(toRpm(omega)).toFixed(3)} rev/min, so the model gives ${toBeatsPerHour(beats).toFixed(0)} beats per hour, which corresponds to a balance frequency of ${balanceFrequency(beats).toFixed(4)} Hz.`;
        })()
      : " The escape arbor is not turned by the running train, so no beat rate is derived.";
    issues.push(
      issue("ESC-001", "declared", "info", "L2_KINEMATIC", [esc.id],
        `${esc.name}: SIMPLIFIED ESCAPEMENT MODEL (Swiss lever, kinematic).${rate}`,
        ["REF-ENG §9", "ASM-0021", "ASM-0022"]),
      issue("ESC-002", "no-contact-claim", "info", "L2_KINEMATIC", [esc.id],
        `${esc.name}: ${dropDeclared ? "drop is declared as a wheel-side angle (ASM-0036), but " : "drop, "}impact, sliding contact and the tooth and pallet faces are not modeled. Locking geometry (ASM-0025), balance dynamics (ASM-0024) and the energy chain (ASM-0026) are simplified models used only when their inputs are entered; nothing here predicts rate accuracy. Requires physical validation.`,
        dropDeclared ? ["REF-ENG §9", "REF-ENG §10", "ASM-0023", "ASM-0025", "ASM-0026", "ASM-0036"] : ["REF-ENG §9", "REF-ENG §10", "ASM-0023", "ASM-0025", "ASM-0026"]),
    );
  }
  return issues;
};
