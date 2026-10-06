import type { Angle } from "@/units/angle";

/**
 * Month-end correction kinematics (ASM-0049). See
 * `src/domain/monthComplication.ts` for the full mechanism description
 * and its sourcing (SRC-0043).
 */

/** Months in a year — a structural fact about the Gregorian calendar, not a declared per-movement value. */
export const MONTHS_PER_YEAR = 12;

/**
 * Non-leap-year Gregorian month lengths, January first. February is
 * fixed at 28 days: leap-year awareness is Phase 8.4, not yet
 * implemented. A real calendar fact, named here rather than invented or
 * declared per movement (CLAUDE.md: "engineering constants belong in
 * named configuration objects").
 */
export const GREGORIAN_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Days in the given month (0-indexed, January = 0), wrapping into range. */
export function daysInMonth(monthIndex: number): number {
  const wrapped = ((monthIndex % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR;
  // wrapped is always in [0, MONTHS_PER_YEAR): the fallback is unreachable, only to satisfy noUncheckedIndexedAccess.
  return GREGORIAN_MONTH_LENGTHS[wrapped] ?? 31;
}

export interface MonthEndCorrection {
  /** How many date-star steps this jump advances by (1 on an ordinary day). */
  dateSteps: number;
  /** Whether the month star also advances this jump. */
  monthAdvances: boolean;
}

/**
 * Whether tonight's date jump is an ordinary single step, or the
 * month-end correction that also advances the month star. `dayPosition`
 * and `monthIndex` are both 0-indexed (`starPosition`,
 * `src/kinematics/dateComplication.ts`). SRC-0043: the date disc's own
 * second toothing gives "an additional step at the end of the months of
 * less than thirty one days" so it always lands on day 1 of the next
 * month, and the month star is "actuated at the end of each month" —
 * including after a 31-day month, where the correction below reduces to
 * an ordinary single step.
 */
export function monthEndCorrection(dayPosition: number, monthIndex: number, dateStarToothCount: number): MonthEndCorrection {
  const lastDay = daysInMonth(monthIndex);
  if (dayPosition + 1 === lastDay) {
    return { dateSteps: dateStarToothCount - lastDay + 1, monthAdvances: true };
  }
  return { dateSteps: 1, monthAdvances: false };
}

/** The angle a single month-star jump advances by: one month (2π / 12). */
export function monthJumpStepAngle(): Angle {
  return ((2 * Math.PI) / MONTHS_PER_YEAR) as Angle;
}
