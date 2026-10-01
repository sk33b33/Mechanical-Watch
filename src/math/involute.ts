import type { Angle } from "@/units/angle";

/** A plain 2D point in metres (unbranded — consumed directly by Three.js geometry). */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Involute spur-gear tooth geometry — SRC-0024 ("Elements of Metric Gear
 * Technology", SDP/SI, §2-4; reference/TRACEABILITY.md). A generic
 * machine-gear source, not a horological one (REF-ENG §6,
 * CLAUDE_REFERENCE_INSTRUCTIONS.md rule 10): it defines the involute
 * curve and the standard full-depth tooth-proportion convention, not
 * that any watch gear is manufactured to it (ASM-0030).
 */

/** SRC-0024 eq. 3-6: inv(α) = tan α − α, the involute function. */
export function involuteAngle(pressureAngle: Angle): number {
  return Math.tan(pressureAngle) - pressureAngle;
}

/** SRC-0024 Table 4-1 (row 6): base circle radius d_b/2 = r cos α. */
export function baseRadius(pitchRadius: number, pressureAngle: Angle): number {
  return pitchRadius * Math.cos(pressureAngle);
}

/**
 * SRC-0024 eq. 3-7: a point on the involute at radius `radius` (must be
 * ≥ `baseRad`), relative to the involute's own origin — where it departs
 * the base circle along the +x axis, roll angle 0. Rotate/reflect the
 * result to place a tooth flank; see `generateInvoluteGearOutline`.
 */
export function involutePoint(baseRad: number, radius: number): Point2D {
  if (radius < baseRad) {
    throw new RangeError(`Involute point radius ${String(radius)} is inside the base circle ${String(baseRad)}`);
  }
  const pressureAtRadius = Math.acos(baseRad / radius) as Angle;
  const rollAngle = involuteAngle(pressureAtRadius);
  return { x: radius * Math.cos(rollAngle), y: radius * Math.sin(rollAngle) };
}

/**
 * SRC-0024 eq. 4-1: the minimum tooth count a standard (unshifted),
 * full-depth gear needs to avoid undercutting, z_c = ⌈2 / sin²α⌉. The
 * source's own worked values (32 at 14.5°, 18 at 20°) are the ceiling of
 * the exact ratio, not the ratio itself — matched here.
 */
export function minimumToothCountForNoUndercut(pressureAngle: Angle): number {
  return Math.ceil(2 / Math.sin(pressureAngle) ** 2);
}
