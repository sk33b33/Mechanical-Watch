import { YEAR_DIGIT_PLACES } from "@/domain/yearDigitComplication";
import type { ValidationIssue } from "../validationIssue";
import { issue, type Rule } from "./context";

/**
 * YEARDIGIT-001 (dimensions, a declared starting digit, the axle's own
 * placement fields, no two segments sharing the same digit place on the
 * same month complication, and a warning for a gap in the declared
 * digit places) and YEARDIGIT-002 (the drive model, and an explicit
 * note that no sourced real wristwatch mechanism exists for a year
 * display built this way, Phase 8.15).
 */
export const yearDigitComplicationRules: Rule = ({ movement }) => {
  const issues: ValidationIssue[] = [];
  // Only one segment per (monthComplicationId, digitPlace) pair can actually be wired into the
  // live jump chain (`dateJumpTracks` in src/simulation/simulationState.ts keeps every match, but
  // digitsToAdvance only ever sees one position per place — a second segment at the same place
  // would pass every other check silently and simply drift out of sync with the first).
  const digitsByMonthAndPlace = new Map<string, number>();
  for (const digit of Object.values(movement.yearDigitComplications)) {
    if (digit.monthComplicationId in movement.monthComplications) {
      const key = `${digit.monthComplicationId}:${digit.digitPlace}`;
      digitsByMonthAndPlace.set(key, (digitsByMonthAndPlace.get(key) ?? 0) + 1);
    }
  }
  // A gap in the declared places breaks decimal carry past it (digitsToAdvance,
  // src/kinematics/yearDigitComplication.ts) — surfaced here as a warning rather than silently
  // leaving a more significant segment stuck, since YEAR_DIGIT_PLACES' own carry order is
  // least-to-most significant.
  const placesByMonth = new Map<string, Set<string>>();
  for (const digit of Object.values(movement.yearDigitComplications)) {
    if (!(digit.monthComplicationId in movement.monthComplications)) continue;
    const places = placesByMonth.get(digit.monthComplicationId) ?? new Set<string>();
    places.add(digit.digitPlace);
    placesByMonth.set(digit.monthComplicationId, places);
  }

  for (const digit of Object.values(movement.yearDigitComplications)) {
    const month = movement.monthComplications[digit.monthComplicationId];
    const problems: string[] = [];
    if (!(Number.isFinite(digit.axleOrigin.x) && Number.isFinite(digit.axleOrigin.y))) problems.push("its axle origin must be a finite point");
    if (!Number.isFinite(digit.axleDirection)) problems.push("its axle direction must be finite");
    if (!Number.isFinite(digit.axleHeight)) problems.push("its axle height must be finite");
    if (!(Number.isFinite(digit.barrelDiameter) && digit.barrelDiameter > 0)) problems.push("its barrel diameter must be a positive length");
    if (!(Number.isFinite(digit.segmentLength) && digit.segmentLength > 0)) problems.push("its segment length must be a positive length");
    if (!(Number.isInteger(digit.startDigit) && digit.startDigit >= 0 && digit.startDigit <= 9)) problems.push("its starting digit must be a whole number from 0 to 9");
    if (month === undefined) problems.push("it does not reference an existing month complication");
    if (month !== undefined && (digitsByMonthAndPlace.get(`${digit.monthComplicationId}:${digit.digitPlace}`) ?? 0) > 1) {
      problems.push("another year-digit complication already uses this same digit place on this same month complication — only one can be driven by its jumps, so one of them never advances");
    }
    for (const problem of problems) {
      issues.push(issue("YEARDIGIT-001", problem, "error", "L1_GEOMETRIC", [digit.id], `${digit.name}: ${problem}.`, ["ASM-0063"]));
    }

    if (month !== undefined) {
      const declaredPlaces = placesByMonth.get(digit.monthComplicationId) ?? new Set<string>();
      const ownIndex = YEAR_DIGIT_PLACES.indexOf(digit.digitPlace);
      const missingBelow = YEAR_DIGIT_PLACES.slice(0, ownIndex).filter((place) => !declaredPlaces.has(place));
      if (missingBelow.length > 0) {
        issues.push(
          issue("YEARDIGIT-001", "carry-gap", "warning", "L2_KINEMATIC", [digit.id],
            `${digit.name}: its own digit place (${digit.digitPlace.toLowerCase()}) has no segment declared for ${missingBelow.map((p) => p.toLowerCase()).join("/")} on the same month complication. Decimal carry stops at the first undeclared place below it, so this segment will never advance from a carry (digitsToAdvance).`, ["ASM-0063"]),
        );
      }
    }

    issues.push(
      issue("YEARDIGIT-002", "model", "info", "L2_KINEMATIC", [digit.id],
        `${digit.name}: a "drum clock" digit segment (${digit.digitPlace.toLowerCase()} place) on a horizontal-axis barrel (ASM-0019-style exception to ASM-0006, Phase 8.15), driven entirely by the month complication's own December-to-January wrap, not a continuous arbor of its own and not a Shaft at all. ` +
        `Together with any other declared digit segments on the same month complication, decimal carry propagates between them on each wrap. No sourced real wristwatch mechanism exists for a year ` +
        `display built this way, so the jump stays instantaneous, the same declared (not invented) treatment the season wheel already has. There is no sourced way for a watch to know the real ` +
        `calendar year on its own: this segment's own starting digit is independently declared, like setting a real digit wheel by hand.`,
        ["ASM-0063"]),
    );
  }
  return issues;
};
