import type { Angle } from "@/units/angle";
import { SEASON_SLOT_COUNT } from "@/domain/seasonComplication";

/**
 * Quarter-boundary kinematics (ASM-0057). See
 * `src/domain/seasonComplication.ts` for the full mechanism description.
 */

/** The angle a single quarter jump advances by: one quarter turn (2π / 4). */
export function seasonJumpStepAngle(): Angle {
  return ((2 * Math.PI) / SEASON_SLOT_COUNT) as Angle;
}

/**
 * Whether the month star's own jump this event crosses a
 * calendar-quarter boundary, read from its PRE-advance position
 * (0-indexed, January = 0) — the same `monthPosition` reading
 * `stepSimulation`'s own leap-year wrap check already uses. True for
 * March, June, September or December (the last month of each quarter):
 * the jump landing on the next month (April, July, October or January
 * respectively) is the one that advances the season wheel. Fixed at the
 * Gregorian calendar-quarter convention — January/April/July/October —
 * the user's own explicit choice between that and the
 * March/June/September/December alternative offered.
 */
export function isQuarterBoundary(preAdvanceMonthPosition: number): boolean {
  return preAdvanceMonthPosition % 3 === 2;
}
