import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * SEASON-001 (dimensions, references and the wheel arbor must not also
 * be a continuous gear-train member) and SEASON-002 (the drive model,
 * and an explicit distinction from the out-of-scope real equation-of-
 * time season complication, ASM-0057).
 */
export const seasonComplicationRules: Rule = ({ movement, train }) => {
  const issues: ValidationIssue[] = [];
  // Only one season complication can actually be wired into the live jump chain per month
  // complication (`dateJumpTracks` in src/simulation/simulationState.ts picks the first found);
  // a second one referencing the same month complication would pass every other check silently
  // and simply never advance.
  const seasonsByMonth = new Map<string, number>();
  for (const season of Object.values(movement.seasonComplications)) {
    if (season.monthComplicationId in movement.monthComplications) {
      seasonsByMonth.set(season.monthComplicationId, (seasonsByMonth.get(season.monthComplicationId) ?? 0) + 1);
    }
  }
  for (const season of Object.values(movement.seasonComplications)) {
    const month = movement.monthComplications[season.monthComplicationId];
    const problems: string[] = [];
    if (!(Number.isFinite(season.wheelTipDiameter) && season.wheelTipDiameter > 0)) problems.push("its wheel tip diameter must be a positive length");
    if (!(Number.isFinite(season.wheelThickness) && season.wheelThickness > 0)) problems.push("its wheel thickness must be a positive length");
    if (!Number.isFinite(season.wheelZCentre)) problems.push("its wheel mid-plane height must be finite");
    if (!(season.wheelShaftId in movement.shafts)) problems.push("its wheel arbor does not exist");
    if (month === undefined) problems.push("it does not reference an existing month complication");
    if (month?.starShaftId === season.wheelShaftId) problems.push("its wheel arbor must be different from the month complication's own star arbor");
    if (month !== undefined && (seasonsByMonth.get(season.monthComplicationId) ?? 0) > 1) {
      problems.push("another season complication already references this same month complication — only one can be driven by its jumps, so one of them never advances");
    }
    for (const problem of problems) {
      issues.push(issue("SEASON-001", problem, "error", "L1_GEOMETRIC", [season.id], `${season.name}: ${problem}.`, ["ASM-0057"]));
    }

    if (season.wheelShaftId in movement.shafts && train.shaftAngularVelocity.has(season.wheelShaftId)) {
      issues.push(
        issue("SEASON-001", "wheel-also-geared", "error", "L2_KINEMATIC", [season.id, season.wheelShaftId],
          `${season.name}: its wheel arbor is also reached by the continuous gear train. A jump mechanism's wheel must not be meshed — it advances only by the jump.`, ["ASM-0057"]),
      );
    }

    issues.push(
      issue("SEASON-002", "model", "info", "L2_KINEMATIC", [season.id],
        `${season.name}: driven entirely by the month complication's own jump into January, April, July or October, not a continuous arbor of its own. ` +
        `This is a quarter indicator, not the real equation-of-time "season" complication (a bean-shaped cam encoding analemma/orbital-mechanics data) ` +
        `that this project has deliberately left unscoped for lack of a source. Position labels use the Southern Hemisphere's own astronomical seasons ` +
        `(Summer/Autumn/Winter/Spring for Q1–Q4), a declared choice since season names are hemisphere-dependent — the Northern Hemisphere reading of the ` +
        `same quarters would be Winter/Spring/Summer/Autumn. The jump stays instantaneous: unlike the leap-year wheel, no sourced real mechanism exists for ` +
        `a quarter-indicator built this way to simulate a real stroke shape from.`,
        ["ASM-0057"]),
    );
  }
  return issues;
};
