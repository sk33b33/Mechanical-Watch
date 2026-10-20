import type { Angle } from "@/units/angle";
import { radians, normalizeAngle } from "@/units/angle";
import type { Movement } from "@/domain/movement";
import type { ShaftId } from "@/domain/shaft";
import { LEAP_YEAR_SLOT_COUNT } from "@/domain/leapYearComplication";
import { SEASON_SLOT_COUNT } from "@/domain/seasonComplication";
import { YEAR_DIGIT_PLACES } from "@/domain/yearDigitComplication";
import { dateJumpStepAngle } from "@/kinematics/dateComplication";
import { monthJumpStepAngle } from "@/kinematics/monthComplication";
import { genevaWheelAdvanceAngle } from "@/kinematics/genevaDrive";
import { seasonJumpStepAngle } from "@/kinematics/seasonComplication";
import { yearDigitStepAngle } from "@/kinematics/yearDigitComplication";
import type { SimulationState } from "./simulationState";

/**
 * A Gregorian calendar date, read from the browser's own clock
 * (`monthIndex` 0 = January, `day` 1-31). Deliberately a plain value, not a
 * `Date`, so the mapping below stays a pure, timezone-free function.
 */
export interface CalendarDate {
  readonly year: number;
  readonly monthIndex: number;
  readonly day: number;
}

export function calendarDateOf(date: Date): CalendarDate {
  return { year: date.getFullYear(), monthIndex: date.getMonth(), day: date.getDate() };
}

/**
 * The leap-year wheel position (0-3) that reads a given year (ASM-0070).
 * The wheel's last position is the declared "Year 4 (leap)" and it advances
 * once each December-to-January wrap (ASM-0050), so a Gregorian year divisible
 * by 4 sits at position 3, the following year at 0 ("Year 1"), and so on.
 * Simplified: the 4-position wheel has no way to express the century
 * exceptions (1900, 2100), so those years read as leap years here too.
 */
export function leapYearWheelPosition(year: number): number {
  return (((year + LEAP_YEAR_SLOT_COUNT - 1) % LEAP_YEAR_SLOT_COUNT) + LEAP_YEAR_SLOT_COUNT) % LEAP_YEAR_SLOT_COUNT;
}

/**
 * The season wheel position (0-3) for a month (ASM-0070): it advances once per
 * calendar quarter on the month-advance landing on January, April, July or
 * October (ASM-0057, `isQuarterBoundary`), so January-March is position 0, and
 * so on. The wheel's own labels' hemisphere or climate meaning is not asserted.
 */
export function seasonWheelPosition(monthIndex: number): number {
  return Math.floor(monthIndex / 3) % SEASON_SLOT_COUNT;
}

/**
 * Returns `state` with every calendar complication's own position set to
 * `date`: the date star to its day, the month star to its month, the
 * leap-year and season wheels and the declared year-digit segments to the
 * matching positions (ASM-0070).
 *
 * Needed because every calendar wheel otherwise starts at its own arbitrary
 * reference (day 1, January, position 0, the declared start digits), and the
 * jump mechanism (ASM-0048) only ever advances them from there; no amount of
 * simulated clock time reaches today's real date. Setting positions directly
 * is the same kind of declared, one-off "set by hand" action the year digits'
 * own `startDigit` already is: it is not a claim a real watch could do this
 * without the user setting its calendar. A complication not present in the
 * movement is skipped; the clock itself (hands, shaft angles of the going
 * train) is untouched. Any in-flight leap-year Geneva stroke is cancelled so
 * it cannot overwrite the set position.
 */
export function withCalendarDate(state: SimulationState, movement: Movement, date: CalendarDate): SimulationState {
  const shaftAngle: Record<ShaftId, Angle> = { ...state.shaftAngle };
  const yearDigitAngle = { ...state.yearDigitAngle };
  const genevaStrokes = { ...state.genevaStrokes };
  const at = (position: number, step: Angle): Angle => normalizeAngle(radians(position * step));

  for (const d of Object.values(movement.dateComplications)) {
    if (!(Number.isInteger(d.starToothCount) && d.starToothCount > 0)) continue;
    // A real day beyond a star with fewer teeth than days is not representable: leave it unset.
    if (date.day - 1 >= d.starToothCount) continue;
    shaftAngle[d.starShaftId] = at(date.day - 1, dateJumpStepAngle(d.starToothCount));
  }
  for (const month of Object.values(movement.monthComplications)) {
    shaftAngle[month.starShaftId] = at(date.monthIndex, monthJumpStepAngle());
  }
  for (const leap of Object.values(movement.leapYearComplications)) {
    shaftAngle[leap.wheelShaftId] = at(leapYearWheelPosition(date.year), genevaWheelAdvanceAngle(LEAP_YEAR_SLOT_COUNT));
    Reflect.deleteProperty(genevaStrokes, leap.wheelShaftId);
  }
  for (const season of Object.values(movement.seasonComplications)) {
    shaftAngle[season.wheelShaftId] = at(seasonWheelPosition(date.monthIndex), seasonJumpStepAngle());
  }
  for (const digit of Object.values(movement.yearDigitComplications)) {
    const exponent = YEAR_DIGIT_PLACES.indexOf(digit.digitPlace);
    const value = Math.floor(date.year / 10 ** exponent) % 10;
    yearDigitAngle[digit.id] = at(value, yearDigitStepAngle());
  }
  return { ...state, shaftAngle, yearDigitAngle, genevaStrokes };
}
