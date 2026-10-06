import { radians, toDegrees } from "@/units/angle";
import { radiansPerSecond } from "@/units/angularVelocity";
import { LEAP_YEAR_SLOT_COUNT } from "@/domain/leapYearComplication";
import {
  genevaDriverMotionAngle,
  genevaLambda,
  genevaWheelAdvanceAngle,
  genevaWheelAngularVelocity,
} from "@/kinematics/genevaDrive";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * YEAR-001 (dimensions, references and the wheel arbor must not also be
 * a continuous gear-train member) and YEAR-002 (the drive model and
 * reference Geneva-mechanism figures this mechanism's real four-slot
 * indexing stroke would have, ASM-0050, SRC-0047).
 */
export const leapYearComplicationRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  for (const year of Object.values(movement.leapYearComplications)) {
    const month = movement.monthComplications[year.monthComplicationId];
    const problems: string[] = [];
    if (!(Number.isFinite(year.wheelTipDiameter) && year.wheelTipDiameter > 0)) problems.push("its wheel tip diameter must be a positive length");
    if (!(Number.isFinite(year.wheelThickness) && year.wheelThickness > 0)) problems.push("its wheel thickness must be a positive length");
    if (!Number.isFinite(year.wheelZCentre)) problems.push("its wheel mid-plane height must be finite");
    if (!(year.wheelShaftId in movement.shafts)) problems.push("its wheel arbor does not exist");
    if (month === undefined) problems.push("it does not reference an existing month complication");
    if (month?.starShaftId === year.wheelShaftId) problems.push("its wheel arbor must be different from the month complication's own star arbor");
    for (const problem of problems) {
      issues.push(issue("YEAR-001", problem, "error", "L1_GEOMETRIC", [year.id], `${year.name}: ${problem}.`, ["ASM-0050"]));
    }

    if (year.wheelShaftId in movement.shafts && train.shaftAngularVelocity.has(year.wheelShaftId)) {
      issues.push(
        issue("YEAR-001", "wheel-also-geared", "error", "L2_KINEMATIC", [year.id, year.wheelShaftId],
          `${year.name}: its wheel arbor is also reached by the continuous gear train. A jump mechanism's wheel must not be meshed — it advances only by the jump.`, ["ASM-0050"]),
      );
    }

    const n = LEAP_YEAR_SLOT_COUNT;
    const indexAngle = toDegrees(genevaWheelAdvanceAngle(n));
    const motionAngle = toDegrees(genevaDriverMotionAngle(n));
    const dwellAngle = 360 - motionAngle;
    const lambda = genevaLambda(n);
    const peakRatio = genevaWheelAngularVelocity(radiansPerSecond(1), radians(0), n);
    issues.push(
      issue("YEAR-002", "model", "info", "L2_KINEMATIC", [year.id],
        `${year.name}: driven entirely by the month complication's own December-to-January wrap, once a calendar year, not a continuous arbor of its own. ` +
        `A real single-pin ${String(n)}-slot Geneva drive (SRC-0047) would index ${indexAngle.toFixed(0)}° per trigger over a ${motionAngle.toFixed(0)}° driver motion sweep ` +
        `(${dwellAngle.toFixed(0)}° dwell the rest of the time), a no-shock pin-radius/centre-distance ratio of ${lambda.toFixed(4)}, and a peak wheel/driver speed ratio of ${peakRatio.toFixed(3)} at mid-stroke ` +
        `— reference figures only; this project simulates the net ${indexAngle.toFixed(0)}° step, not the continuous indexing motion. ` +
        `Does not model leap-year exceptions (e.g. century years): a fixed four-year cycle, same as SRC-0044's own real mechanism.`,
        ["ASM-0050", "SRC-0047"]),
    );
  }
  return issues;
};
