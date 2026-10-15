import type { Angle } from "@/units/angle";
import { YEAR_DIGIT_PLACES, YEAR_DIGIT_SLOT_COUNT, type YearDigitPlace } from "@/domain/yearDigitComplication";

/**
 * Year-digit (drum clock) kinematics (new assumption, Phase 8.12). See
 * `src/domain/yearDigitComplication.ts` for the full mechanism
 * description and its sourcing.
 */

/** The angle a single digit jump advances by: one tenth of a turn (2π / 10). */
export function yearDigitStepAngle(): Angle {
  return ((2 * Math.PI) / YEAR_DIGIT_SLOT_COUNT) as Angle;
}

/**
 * Which of the (up to four) declared digit wheels should advance on a
 * single year-wrap trigger, given each one's own PRE-advance position
 * (0-9). Ordinary decimal carry: the ones place always advances; a more
 * significant place advances in the same event only if every place
 * below it is currently sitting at 9 (about to wrap back to 0) — the
 * same rule a mechanical odometer, or a real "big date" mechanism's own
 * tens-digit jump, already follows.
 *
 * `currentPositions` need not have all four places — a design can
 * declare any subset of `YearDigitPlace`s. The carry chain walks
 * `YEAR_DIGIT_PLACES` (ones → tens → hundreds → thousands) and stops at
 * the first place that is either undeclared or not at 9: a gap in the
 * declared places (e.g. ones and hundreds declared, tens missing) is
 * not an invented bridge — it is surfaced as a validation warning
 * instead (YEARDIGIT-001), not silently patched over here.
 */
export function digitsToAdvance(currentPositions: ReadonlyMap<YearDigitPlace, number>): ReadonlySet<YearDigitPlace> {
  const advancing = new Set<YearDigitPlace>();
  for (const place of YEAR_DIGIT_PLACES) {
    const current = currentPositions.get(place);
    if (current === undefined) break;
    advancing.add(place);
    if (current !== YEAR_DIGIT_SLOT_COUNT - 1) break;
  }
  return advancing;
}
