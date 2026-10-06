import type { Angle } from "@/units/angle";
import type { AngularVelocity } from "@/units/angularVelocity";

/**
 * Generic external single-pin Geneva (Maltese-cross) drive kinematics
 * (ASM-0050). Not watch-specific: a reusable mechanism-design module, the
 * same role `math/gearMath.ts` plays for gears. SRC-0047 (Nikolić &
 * Bulatović 2011, a peer-reviewed mechanism-design paper): closed-form
 * position/velocity equations for the driven wheel, and the no-shock
 * (impact-free) pin-entry condition that fixes the drive geometry.
 *
 * Geometry: driver centre O1, driven-wheel centre O2, centre distance a,
 * a pin at radius l from O1. α is the driver's own rotation angle,
 * measured from the symmetric midpoint of the indexing stroke — the
 * instant the pin lies on the O1-O2 line — where β is zero by
 * convention; β is the driven wheel's own rotation from that same
 * reference. λ = l / a. Both α and β range over the stroke symmetrically:
 * α ∈ [−driverMotionAngle(n)/2, +driverMotionAngle(n)/2], β ∈
 * [−wheelAdvanceAngle(n)/2, +wheelAdvanceAngle(n)/2] — entry and exit
 * (α = ∓driverMotionAngle(n)/2) are the no-shock points (O1-P ⟂ O2-P).
 * Derived directly from the driver-pin/wheel-centre coordinate geometry
 * and cross-checked numerically against SRC-0047's closed-form result
 * (the functional form matches theirs exactly; this module's own α
 * reference point — the stroke's symmetric midpoint rather than its
 * entry — was chosen and verified independently, since the midpoint
 * reference makes β an odd function of α, the cleanest public form).
 */

/** The minimum slot count for a practical external Geneva drive (Wikipedia, "Geneva drive", citing Bickford 1972). */
export const GENEVA_MIN_SLOT_COUNT = 3;

/**
 * No-shock pin-radius/centre-distance ratio λ = sin(π/n) (SRC-0047 eq. 4):
 * the entry/exit condition O1-P ⟂ O2-P, so the pin's transverse velocity
 * relative to the slot is zero at engagement — required for impact-free
 * operation, not an empirical fudge.
 */
export function genevaLambda(slotCount: number): number {
  return Math.sin(Math.PI / slotCount);
}

/**
 * The locking-disc/crescent radius as a fraction of the centre distance,
 * O2P / a = cos(π/n) — the right triangle O1-O2-P is right-angled at P at
 * the no-shock instant (SRC-0047), so this falls out of λ² + ratio² = 1.
 */
export function genevaLockingDiscRadiusRatio(slotCount: number): number {
  return Math.cos(Math.PI / slotCount);
}

/** The driven wheel's own net advance per index, 2π / n (SRC-0047). */
export function genevaWheelAdvanceAngle(slotCount: number): Angle {
  return ((2 * Math.PI) / slotCount) as Angle;
}

/** The driver's own motion sweep (vs. dwell) per revolution, π(n − 2) / n (SRC-0047). */
export function genevaDriverMotionAngle(slotCount: number): Angle {
  return ((Math.PI * (slotCount - 2)) / slotCount) as Angle;
}

/**
 * The driven wheel's own rotation β, as a function of the driver's own
 * rotation α from the stroke's symmetric midpoint: β = arctan(λ sin α /
 * (1 − λ cos α)) (the same functional form as SRC-0047 eq. 1–2, with a
 * cancelled out of the tan ratio; this module's own α reference point —
 * see the module doc comment — was independently re-derived from the
 * driver-pin/wheel-centre coordinate geometry and verified numerically
 * against it). Valid for α in [−driverMotionAngle(n)/2,
 * +driverMotionAngle(n)/2], an odd function reaching
 * ±wheelAdvanceAngle(n)/2 at the two ends.
 */
export function genevaWheelAngle(driverAngleFromMidpoint: Angle, slotCount: number): Angle {
  const lambda = genevaLambda(slotCount);
  return Math.atan2(lambda * Math.sin(driverAngleFromMidpoint), 1 - lambda * Math.cos(driverAngleFromMidpoint)) as Angle;
}

/**
 * The driven wheel's own angular velocity, given the driver's angle from
 * the stroke's symmetric midpoint and its own angular velocity (the
 * derivative of `genevaWheelAngle` w.r.t. α, same functional form as
 * SRC-0047 eq. 3): ω2 = λ·ω1·(cos α − λ) / (1 + λ² − 2λ cos α). Zero at
 * both ends of the stroke (no-shock entry/exit) and at its peak
 * (magnitude λ/(1−λ) × ω1) at the midpoint, α = 0.
 */
export function genevaWheelAngularVelocity(driverAngularVelocity: AngularVelocity, driverAngleFromMidpoint: Angle, slotCount: number): AngularVelocity {
  const lambda = genevaLambda(slotCount);
  const cosAlpha = Math.cos(driverAngleFromMidpoint);
  return ((lambda * driverAngularVelocity * (cosAlpha - lambda)) / (1 + lambda * lambda - 2 * lambda * cosAlpha)) as AngularVelocity;
}
