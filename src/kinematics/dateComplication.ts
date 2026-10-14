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
 */
export function crossesRevolution(
  previousAngle: Angle,
  angularVelocity: AngularVelocity,
  dtSeconds: number,
  forwardSign: 1 | -1 = 1,
): boolean {
  const forwardOmega = angularVelocity * forwardSign;
  if (forwardOmega <= 0) return false;
  const forwardAngle = forwardSign === 1 ? previousAngle : (2 * Math.PI - previousAngle) as Angle;
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
