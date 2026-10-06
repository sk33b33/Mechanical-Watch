import { windowsPerRevolution } from "@/domain/moonPhase";
import { impliedLunationDays, lunationDriftMinutes, SYNODIC_MONTH_DAYS } from "@/kinematics/moonPhase";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * MOON-001 (dimensions and reference arbor) and MOON-002 (the implied
 * lunation period from the disc arbor's own solved angular velocity,
 * reported against the real synodic month, ASM-0047/SRC-0046).
 */
export const moonPhaseRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  for (const moon of Object.values(movement.moonPhases)) {
    const problems: string[] = [];
    if (!(Number.isFinite(moon.diameter) && moon.diameter > 0)) problems.push("its diameter must be a positive length");
    if (!(Number.isFinite(moon.thickness) && moon.thickness > 0)) problems.push("its thickness must be a positive length");
    if (!Number.isFinite(moon.faceHeight)) problems.push("its face height must be finite");
    if (!(moon.shaftId in movement.shafts)) problems.push("it is mounted on an arbor that does not exist");
    for (const problem of problems) {
      issues.push(issue("MOON-001", problem, "error", "L1_GEOMETRIC", [moon.id], `${moon.name}: ${problem}.`, ["ASM-0047"]));
    }

    const omega = train.shaftAngularVelocity.get(moon.shaftId);
    const windows = windowsPerRevolution(moon.windowCount);
    const impliedDays = omega === undefined ? null : impliedLunationDays(omega, windows);
    const message =
      impliedDays === null
        ? `${moon.name}: not driven, so no lunation period is implied.`
        : (() => {
            const drift = lunationDriftMinutes(impliedDays);
            return `${moon.name}: the gear train implies a lunation of ${impliedDays.toFixed(3)} days, versus the real synodic month of ${SYNODIC_MONTH_DAYS.toFixed(3)} days (SRC-0046) — a drift of ${drift >= 0 ? "+" : ""}${drift.toFixed(1)} min per lunation.`;
          })();
    issues.push(issue("MOON-002", "prediction", "info", "L2_KINEMATIC", [moon.id], message, ["ASM-0047", "SRC-0046"]));
  }
  return issues;
};
