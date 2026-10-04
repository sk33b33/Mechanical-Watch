import type { Angle } from "@/units/angle";
import { radians } from "@/units/angle";
import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import { assertValidToothCount } from "@/math/gearMath";

/**
 * Simplified Swiss lever pallet geometry (L1, ASM-0025). The pallets lock
 * on the escape wheel's tip circle at two points a span of (k + ½) pitches
 * apart, placed for tangential locking: the pallet arbor lies where the
 * tangents to the tip circle at the two locking points meet. Tooth and
 * pallet faces, drop and recoil are not modeled.
 */

/** Angle subtended at the escape wheel's axis by the two locking points. */
export function spanAngle(escapeTeeth: number, spanTeeth: number): Angle {
  assertValidToothCount(escapeTeeth);
  return radians((spanTeeth * 2 * Math.PI) / escapeTeeth);
}

/**
 * Two beats per tooth (ASM-0021) means each pallet releases the wheel by
 * half a pitch, which needs the locking points (k + ½) pitches apart.
 */
export function isHalfToothSpan(spanTeeth: number): boolean {
  if (!Number.isFinite(spanTeeth) || spanTeeth <= 0) return false;
  const fraction = spanTeeth - Math.floor(spanTeeth);
  return Math.abs(fraction - 0.5) <= 1e-9;
}

/**
 * Escape-to-pallet axis distance for tangential locking: the tangents at
 * points ±φ/2 either side of the line of centres meet at R / cos(φ/2).
 * Null when the span is not between 0 and 180°.
 */
export function tangentialCentreDistance(tipRadius: Length, span: Angle): Length | null {
  if (!(span > 0 && span < Math.PI) || !(tipRadius > 0)) return null;
  return metres(tipRadius / Math.cos(span / 2));
}

/** The two locking points on the tip circle, either side of the line from the escape axis toward the pallet axis. */
export function lockingPoints(escapeAxis: Vec2, palletAxis: Vec2, tipRadius: Length, span: Angle): [Vec2, Vec2] {
  const towardPallet = Math.atan2(palletAxis.y - escapeAxis.y, palletAxis.x - escapeAxis.x);
  const at = (a: number): Vec2 => ({ x: metres(escapeAxis.x + tipRadius * Math.cos(a)), y: metres(escapeAxis.y + tipRadius * Math.sin(a)) });
  return [at(towardPallet - span / 2), at(towardPallet + span / 2)];
}

/** Lever rotation during impulse: the total swing between bankings less lock and run (ASM-0025). */
export function impulseAngle(leverAngle: Angle, lockAngle: Angle, runAngle: Angle): Angle {
  return radians(leverAngle - lockAngle - runAngle);
}

/**
 * Wheel-angle budget for one beat (ASM-0036, SRC-0036): two beats per
 * tooth (ASM-0021) means each beat's tooth width, pallet width and drop
 * together span half the tooth pitch, π/escapeTeeth.
 */
export function wheelAngleBudgetPerBeat(escapeTeeth: number): Angle {
  assertValidToothCount(escapeTeeth);
  return radians(Math.PI / escapeTeeth);
}

/**
 * Linear clearance a declared angular drop gives at the escape wheel's tip
 * circle (ASM-0036, SRC-0036): arc length = radius × angle. Null when the
 * tip radius is not positive.
 */
export function dropClearance(tipRadius: Length, dropAngle: Angle): Length | null {
  return tipRadius > 0 ? metres(tipRadius * dropAngle) : null;
}

/** Balance lift per unit of lever swing: the fork-to-roller ratio implied by the two declared angles. */
export function forkRatio(balanceLift: Angle, leverAngle: Angle): number | null {
  return leverAngle > 0 && balanceLift > 0 ? balanceLift / leverAngle : null;
}
