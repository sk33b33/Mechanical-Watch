import type { Angle } from "@/units/angle";
import { normalizeAngle } from "@/units/angle";
import type { AngularVelocity } from "@/units/angularVelocity";

/**
 * Simple instantaneous date mechanism kinematics (ASM-0048). The star
 * wheel is not a continuous gear-train member: it advances only when the
 * drive shaft completes a revolution, by exactly one step. See
 * `src/domain/dateComplication.ts` for the full mechanism description
 * and its sourcing (SRC-0042).
 */

/**
 * Whether the drive shaft's own revolution-counter crosses its zero
 * reference during this simulation step — i.e. whether the jump fires.
 * `previousAngle` is the shaft's already-wrapped angle ([0, 2π)) before
 * this step. Forward only (ratchet): a reversed or stationary drive never
 * fires, so backing the hands up through the trigger point does not
 * un-advance the star (ASM-0048) — a real jump mechanism has no
 * quick-correction path through this action alone.
 *
 * "Forward" is relative to `forwardSign` (default 1), not the raw sign of
 * `angularVelocity`: a drive shaft's own solved angular velocity is, in
 * general, mesh-parity bookkeeping (each additional gear mesh between it
 * and any reference flips the computed sign) — not itself a statement
 * about whether the design's normal running direction turns this
 * particular shaft "positive" or "negative". `forwardSign` is the sign
 * `angularVelocity` has under the design's own normal (forward) running
 * solve, captured once per `DateJumpTrack` (`dateJumpTracks` in
 * `src/simulation/simulationState.ts`), so a drive shaft that is one mesh
 * away from its neighbours (and therefore negative while still turning
 * the real, intended "forward" way) still fires correctly.
 *
 * `forwardAngle` mirrors the raw angle for a `forwardSign = -1` shaft
 * (`2π − previousAngle`) so the SAME "crosses 2π" check below works for
 * either sign — a decreasing raw angle's own forward lap (0 → wraps to
 * just under 2π → continues down to 0) becomes an increasing mirrored
 * one. Real bug, found live (a date complication whose own drive shaft
 * happens to solve with negative angular velocity — ordinary mesh-parity
 * bookkeeping, not a design error — jumped once, spuriously, in the very
 * first simulated instant after every fresh load): at the fresh-
 * simulation starting angle `previousAngle = 0` exactly, the un-wrapped
 * mirror formula gives `2π − 0 = 2π` rather than the `0` a shaft that
 * has not yet moved should read (0 and 2π are the same physical point,
 * but the check below is a literal `>= 2π` on this un-reduced value) —
 * so the crossing check was already satisfied before any time at all
 * had elapsed. `% (2π)` reduces that one boundary case (the only one:
 * for any `previousAngle > 0`, `2π − previousAngle` already falls
 * strictly inside `(0, 2π)`, needing no reduction) back to the correct
 * `0`, matching `forwardSign = 1`'s own behaviour at the same starting
 * angle.
 */
export function crossesRevolution(
  previousAngle: Angle,
  angularVelocity: AngularVelocity,
  dtSeconds: number,
  forwardSign: 1 | -1 = 1,
): boolean {
  const forwardOmega = angularVelocity * forwardSign;
  if (forwardOmega <= 0) return false;
  const forwardAngle = forwardSign === 1 ? previousAngle : ((2 * Math.PI - previousAngle) % (2 * Math.PI)) as Angle;
  return forwardAngle + forwardOmega * dtSeconds >= 2 * Math.PI;
}

/** The angle a single jump advances the star: one star tooth (2π / starToothCount). */
export function dateJumpStepAngle(starToothCount: number): Angle {
  return ((2 * Math.PI) / starToothCount) as Angle;
}

/**
 * The star's current discrete position (0-indexed), read from its own
 * angle. Rounds to the nearest step rather than flooring, so small
 * floating-point drift from many accumulated jumps never reads one step
 * short.
 */
export function starPosition(starAngle: Angle, starToothCount: number): number {
  const turns = normalizeAngle(starAngle) / (2 * Math.PI);
  return Math.round(turns * starToothCount) % starToothCount;
}

/**
 * The seven positions of a day-of-week display (ASM-0081, SRC-0048/0049): one step of the star per
 * day, seven days to the week. Position 0 is Monday (the ISO 8601 week), so the display reads
 * MON, TUE, ... SUN; the names are the usual three-letter abbreviations a dial prints (SRC-0049).
 */
export const DAYS_PER_WEEK = 7;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_ABBREVIATIONS = WEEKDAY_NAMES.map((name) => name.slice(0, 3).toUpperCase());

/**
 * The day-of-week star position (0 = Monday) for a JavaScript `Date.getDay()` value (0 = Sunday,
 * 1 = Monday ... 6 = Saturday). Pure arithmetic, no `Date`.
 */
export function weekdayPosition(jsDay: number): number {
  return (((jsDay + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

