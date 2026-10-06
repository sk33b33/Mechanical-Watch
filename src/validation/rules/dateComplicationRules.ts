import { isValidToothCount } from "@/math/gearMath";
import { periodSeconds } from "@/kinematics/timeDisplay";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

const SECONDS_PER_DAY = 86_400;
/** How far the drive arbor's own implied period may stray from one day before DATE-003 advises on it (±10%, a round, generous margin — not itself sourced). */
const DAY_PERIOD_TOLERANCE = 0.1;

/**
 * DATE-001 (dimensions and references), DATE-002 (the star arbor must
 * not also be a continuous gear-train member) and DATE-003 (the drive
 * arbor's implied jump period, reported against one day, ASM-0048).
 */
export const dateComplicationRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  for (const date of Object.values(movement.dateComplications)) {
    const problems: string[] = [];
    if (!(Number.isFinite(date.starTipDiameter) && date.starTipDiameter > 0)) problems.push("its star tip diameter must be a positive length");
    if (!(Number.isFinite(date.starThickness) && date.starThickness > 0)) problems.push("its star thickness must be a positive length");
    if (!Number.isFinite(date.starZCentre)) problems.push("its star mid-plane height must be finite");
    if (!isValidToothCount(date.starToothCount)) problems.push("its star tooth count must be a positive integer");
    if (!(date.driveShaftId in movement.shafts)) problems.push("its drive arbor does not exist");
    if (!(date.starShaftId in movement.shafts)) problems.push("its star arbor does not exist");
    if (date.driveShaftId === date.starShaftId && date.driveShaftId in movement.shafts) problems.push("its drive and star arbors must be different");
    for (const problem of problems) {
      issues.push(issue("DATE-001", problem, "error", "L1_GEOMETRIC", [date.id], `${date.name}: ${problem}.`, ["ASM-0048"]));
    }

    if (date.starShaftId in movement.shafts && train.shaftAngularVelocity.has(date.starShaftId)) {
      issues.push(
        issue("DATE-002", "star-also-geared", "error", "L2_KINEMATIC", [date.id, date.starShaftId],
          `${date.name}: its star arbor is also reached by the continuous gear train. A jump mechanism's star must not be meshed — it advances only by the jump.`, ["ASM-0048"]),
      );
    }

    const omega = train.shaftAngularVelocity.get(date.driveShaftId);
    if (omega === undefined || omega === 0) {
      issues.push(issue("DATE-003", "prediction", "info", "L2_KINEMATIC", [date.id], `${date.name}: not driven, so no jump period is implied.`, ["ASM-0048"]));
    } else {
      const period = periodSeconds(omega);
      const message = `${date.name}: the drive arbor implies a jump every ${(period / 3600).toFixed(2)} h, versus one day (24 h) for a standard date mechanism (SRC-0042).`;
      const dayLike = Math.abs(period - SECONDS_PER_DAY) <= SECONDS_PER_DAY * DAY_PERIOD_TOLERANCE;
      issues.push(issue("DATE-003", "prediction", dayLike ? "info" : "warning", "L2_KINEMATIC", [date.id], message, ["ASM-0048", "SRC-0042"]));
    }
  }
  return issues;
};
