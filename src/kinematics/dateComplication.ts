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
 * this step. Forward only (ratchet): a reversed or stationary drive
 * (`angularVelocity` ≤ 0) never fires, so backing the hands up through
 * the trigger point does not un-advance the star (ASM-0048) — a real
 * jump mechanism has no quick-correction path through this action alone.
 */
export function crossesRevolution(previousAngle: Angle, angularVelocity: AngularVelocity, dtSeconds: number): boolean {
  if (angularVelocity <= 0) return false;
  return previousAngle + angularVelocity * dtSeconds >= 2 * Math.PI;
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
