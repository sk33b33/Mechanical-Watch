import { GREGORIAN_MONTH_LENGTHS } from "@/kinematics/monthComplication";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * MONTH-001 (dimensions, references and the star arbor must not also be
 * a continuous gear-train member) and MONTH-002 (the correction
 * schedule this mechanism applies, ASM-0049).
 */
export const monthComplicationRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  for (const month of Object.values(movement.monthComplications)) {
    const date = movement.dateComplications[month.dateComplicationId];
    const problems: string[] = [];
    if (!(Number.isFinite(month.starTipDiameter) && month.starTipDiameter > 0)) problems.push("its star tip diameter must be a positive length");
    if (!(Number.isFinite(month.starThickness) && month.starThickness > 0)) problems.push("its star thickness must be a positive length");
    if (!Number.isFinite(month.starZCentre)) problems.push("its star mid-plane height must be finite");
    if (!(month.starShaftId in movement.shafts)) problems.push("its star arbor does not exist");
    if (date === undefined) problems.push("it does not reference an existing date complication");
    if (date?.starShaftId === month.starShaftId) problems.push("its star arbor must be different from the date complication's own star arbor");
    for (const problem of problems) {
      issues.push(issue("MONTH-001", problem, "error", "L1_GEOMETRIC", [month.id], `${month.name}: ${problem}.`, ["ASM-0049"]));
    }

    if (month.starShaftId in movement.shafts && train.shaftAngularVelocity.has(month.starShaftId)) {
      issues.push(
        issue("MONTH-001", "star-also-geared", "error", "L2_KINEMATIC", [month.id, month.starShaftId],
          `${month.name}: its star arbor is also reached by the continuous gear train. A jump mechanism's star must not be meshed — it advances only by the jump.`, ["ASM-0049"]),
      );
    }

    const shortMonths = GREGORIAN_MONTH_LENGTHS
      .map((days, i) => ({ name: MONTH_NAMES[i] ?? String(i), days }))
      .filter((m) => m.days < 31);
    const summary = shortMonths.map((m) => `${m.name} (${String(m.days)} days, +${String(31 - m.days)})`).join(", ");
    issues.push(
      issue("MONTH-002", "schedule", "info", "L2_KINEMATIC", [month.id],
        `${month.name}: the date complication gets an extra step at the end of ${summary} — every other month needs none. February is fixed at 28 days; leap years are not modeled (Phase 8.4), so a real annual calendar in this same sense still needs one manual correction a year after February.`,
        ["ASM-0049"]),
    );
  }
  return issues;
};
