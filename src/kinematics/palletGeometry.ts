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

/**
 * Linear clearance a declared guard-point freedom gives at the bank
 * (ASM-0043, SRC-0036 "The Safety Action"): arc length = radius × angle,
 * the same formula as `dropClearance` applied to the guard point's own
 * radius from the pallet centre, not the escape wheel's tip circle. Null
 * when the guard-point radius is not positive.
 */
export function guardPointClearance(guardPointRadius: Length, guardPointFreedom: Angle): Length | null {
  return guardPointRadius > 0 ? metres(guardPointRadius * guardPointFreedom) : null;
}

/**
 * Escape-tooth width (wheel-side), the remainder of the per-beat wheel-angle
 * budget after the pallet's own width and drop (ASM-0037, SRC-0036: "12°
 * for width of tooth, pallet and drop; drop is to be 1½°, the tooth is to
 * be ¾ the width of the pallet, making a tooth of a width of 4½° and a
 * pallet of 6°" — i.e. budget = toothWidth + palletWidth + drop). Can be
 * zero or negative for an over-budget declaration; validity is ESC-106's
 * job, not this function's.
 */
export function toothWidthAngle(escapeTeeth: number, palletWidthAngle: Angle, dropAngle: Angle): Angle {
  return radians(wheelAngleBudgetPerBeat(escapeTeeth) - palletWidthAngle - dropAngle);
}

/** Balance lift per unit of lever swing: the fork-to-roller ratio implied by the two declared angles. */
export function forkRatio(balanceLift: Angle, leverAngle: Angle): number | null {
  return leverAngle > 0 && balanceLift > 0 ? balanceLift / leverAngle : null;
}

/**
 * The fork's real acting length (pallet centre to the ruby-pin contact),
 * derived from the declared impulse radius via Playtner's own stated law
 * (ASM-0041, SRC-0036 "The Fork and Roller Action": "the angles are in
 * the inverse ratio to the radii. In other words, the shorter the
 * radius, the greater is the angle" — i.e. impulse angle × impulse
 * radius ≈ lever angle × fork acting length, treating the brief contact
 * as a shared linear displacement at the point of contact). `ratio` is
 * the already-computed `forkRatio` (balance lift ÷ lever angle); null
 * when the ratio is null (ESC-105's own lever/lift preconditions) or the
 * impulse radius is not positive.
 */
export function forkActingLength(impulseRadius: Length, ratio: number | null): Length | null {
  return ratio !== null && impulseRadius > 0 ? metres(impulseRadius * ratio) : null;
}

/**
 * The ruby pin's suggested width, derived from the fork's total angular
 * motion (ASM-0042, SRC-0036 "The Fork and Roller Action": "we would
 * choose a ruby pin of a width equal to half the angular motion of the
 * fork"). A cited convention, not a strict formula — unlike
 * `toothWidthAngle`, this is not load-bearing for any other derived
 * quantity, so there is no corresponding hard constraint to check it
 * against (ESC-110 reports it as info only).
 */
export function suggestedRubyPinWidth(leverAngle: Angle): Angle {
  return radians(leverAngle / 2);
}

/**
 * The escape tooth's own locking face, derived from the declared pallet
 * draw (ASM-0039, SRC-0036 "The Draw"): "it is certainly necessary that
 * the point of the tooth alone should touch the pallet. From this it
 * follows that the angle on the teeth must be greater than on the
 * pallets... for practical reasons, from a manufacturing standpoint, the
 * angle on the tooth is made just twice the amount". Both angles are the
 * face's inclination from the same reference, the radial line between the
 * escape axis and the locking point (Playtner: "the locking planes...
 * are inclined 12° from EB, and FB", EB/FB being radii from the escape
 * center). Not a strict formula — "we could make it a little less or a
 * little more" — so this is a conventional derivation, not a necessity;
 * validity against Playtner's own cited practical range (20°-28°) is
 * ESC-108's job, not this function's.
 */
export function toothDrawAngle(palletDrawAngle: Angle): Angle {
  return radians(2 * palletDrawAngle);
}

/**
 * Angle, at the balance centre, between the line to the pallet centre and
 * the line to the point where a ray from the pallet centre — leaning
 * `rayAngle` off the pallet-to-balance centre line — first crosses the
 * circle of `ringRadius` around the balance centre. Found exactly, the
 * same way as `rayCircleInward` (`src/geometry/assemblyGeometry3d.ts`):
 * solve the ray/circle quadratic for the nearest forward crossing, then
 * the law of cosines in the pallet-centre/balance-centre/crossing-point
 * triangle gives the angle at the balance centre unambiguously (the law
 * of sines alone would leave which of the two crossings it describes
 * ambiguous). Used by `crescentHalfAngle` for the guard point's own
 * freedom-extreme ray (ASM-0044, SRC-0036 "The Crescent": "g g represents
 * the path of the guard pin... and is drawn at the intersection of VA
 * with the roller"). Null when the ray misses the circle entirely, the
 * nearest crossing lies behind the pallet centre, or any input is
 * non-positive.
 */
export function ringCrossingAngle(centreDistance: Length, rayAngle: Angle, ringRadius: Length): Angle | null {
  if (!(centreDistance > 0) || !(ringRadius > 0) || !(rayAngle > 0 && rayAngle < Math.PI)) return null;
  const cosRay = Math.cos(rayAngle);
  const discriminant = ringRadius * ringRadius - centreDistance * centreDistance * Math.sin(rayAngle) * Math.sin(rayAngle);
  if (discriminant < 0) return null;
  const sqrtDiscriminant = Math.sqrt(discriminant);
  // The smaller (nearest) non-negative root; falls back to the larger root when the nearer
  // crossing is behind the pallet centre (only possible when the ring is bigger than the
  // pallet-to-balance distance itself — not a real escapement layout, but handled for correctness).
  const t = centreDistance * cosRay - sqrtDiscriminant >= 0
    ? centreDistance * cosRay - sqrtDiscriminant
    : centreDistance * cosRay + sqrtDiscriminant;
  if (t < 0) return null;
  const cosAtBalance = (centreDistance * centreDistance + ringRadius * ringRadius - t * t) / (2 * centreDistance * ringRadius);
  if (!(cosAtBalance >= -1 && cosAtBalance <= 1)) return null;
  return radians(Math.acos(cosAtBalance));
}

/**
 * Angle, at the balance centre, between the line to the pallet centre and
 * the line to a point whose distance from each centre is already known —
 * the ruby pin, at the fork's acting length from the pallet centre and the
 * impulse radius from the balance centre (law of cosines; all three sides
 * of the pallet-centre/balance-centre/ruby-pin triangle are already-known
 * lengths). This is the direction SRC-0036 calls A′A2: "a line drawn from
 * the balance center through that of the ruby pin, and therefore also
 * passes through the center of the crescent." Null when the three lengths
 * cannot form a triangle (the fork acting length is too long or short for
 * the pallet-to-balance distance and impulse radius to reach) or any input
 * is non-positive.
 */
export function rubyPinAngleAtBalance(centreDistance: Length, forkLength: Length, impulseRadius: Length): Angle | null {
  if (!(centreDistance > 0) || !(forkLength > 0) || !(impulseRadius > 0)) return null;
  const cosAngle = (centreDistance * centreDistance + impulseRadius * impulseRadius - forkLength * forkLength) / (2 * centreDistance * impulseRadius);
  if (!(cosAngle >= -1 && cosAngle <= 1)) return null;
  return radians(Math.acos(cosAngle));
}

/**
 * Half the single roller's crescent angular opening (ASM-0044, SRC-0036
 * "The Crescent"): the angle, at the balance centre, between the ruby-pin
 * reference direction (A′A2, `rubyPinAngleAtBalance`) and the guard
 * point's own freedom-extreme direction (`ringCrossingAngle`, using the
 * fork's rest position — taken as half the lever angle off the pallet-to-
 * balance centre line, the convention Playtner's own Fig. 15 commentary
 * states: "with a total motion of the fork of 10½°... one-half... will be
 * performed on each side of the line of centers" — rotated further by the
 * guard-point freedom, matching his own "V A W is an angle of 1¼°, which
 * equals the freedom between the guard point and the roller"). The full
 * opening is double this value, mirrored to the other side of A′A2, per
 * Playtner's own construction ("will give us one-half the crescent, the
 * remaining half being transferred to the opposite side of the line
 * A′ A2"). Null when either angle is not derivable (the entered lengths
 * and the actual pallet-to-balance distance do not form a consistent
 * geometry) or the lever angle/guard freedom are not positive.
 */
export function crescentHalfAngle(
  centreDistance: Length,
  leverAngle: Angle,
  guardPointFreedom: Angle,
  forkLength: Length,
  impulseRadius: Length,
  rollerRadius: Length,
): Angle | null {
  if (!(leverAngle > 0) || !(guardPointFreedom > 0)) return null;
  const rubyPinAngle = rubyPinAngleAtBalance(centreDistance, forkLength, impulseRadius);
  const guardAngle = ringCrossingAngle(centreDistance, radians(leverAngle / 2 + guardPointFreedom), rollerRadius);
  if (rubyPinAngle === null || guardAngle === null) return null;
  return radians(Math.abs(guardAngle - rubyPinAngle));
}
