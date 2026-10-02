import type { AssumptionId } from "@/reference/assumptions";

/** A plain 2D point in metres (unbranded — consumed directly by Three.js geometry). */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Cycloidal horological tooth form, SRC-0026 (practitioner derivation of
 * British Standard 978 Part 2 / Swiss NIHS 26702, neither of which was
 * itself accessed — see reference/sources/SOURCES.yml), corroborated by
 * SRC-0027. Two conventions, both explicitly scoped to a single gear's
 * own tooth count rather than its actual meshing partner (ASM-0032,
 * ASM-0033 — the real standard sizes both from the mesh pair):
 *
 * - "Clock toothing": the dedendum's generating circle diameter is
 *   fixed to half the gear's own pitch diameter, which degenerates the
 *   dedendum hypocycloid to a straight radial line — see
 *   `dedendumDepthFactor` and `generateWatchSpecificGearOutline` in
 *   src/geometry/watchSpecificGearOutline.ts.
 * - The standard's own practical tooth form approximates the addendum
 *   as a circular arc (not the literal epicycloid), tabulated by
 *   profile style and leaf-count bracket — `cycloidalToothFactors`.
 */

export type CycloidalProfileStyle = "ROUND" | "MEDIUM_OGIVAL" | "HIGH_OGIVAL";

export interface CycloidalToothFactors {
  /** Theoretical addendum-height factor (SRC-0026 eq. 17), in modules. */
  readonly addendumFactor: number;
  /** Addendum arc radius factor, in modules. */
  readonly addendumArcRadiusFactor: number;
}

export const CYCLOID_TOOTH_PROPORTIONS = {
  /** SRC-0026 eq. 21: the practical addendum height is 95% of the theoretical factor (clearance). */
  practicalClearanceFactor: 0.95,
  /** SRC-0026: fixed bottom clearance below the dedendum's own generating construction, in modules. */
  dedendumBottomClearanceInModules: 0.4,
  /** SRC-0026: tooth (not space) width at the pitch circle, in modules, by leaf-count bracket. */
  toothWidthInModules: { low: 1.05, high: 1.25 },
  /** SRC-0026: below this, the cited tooth-form table has no entries (GEAR-104). */
  minimumToothCount: 6,
  assumption: "ASM-0033" satisfies AssumptionId,
} as const;

/** SRC-0026 "Recommended profiles": the tooth-form style by the gear's own leaf count. */
export function recommendedProfileStyle(toothCount: number): CycloidalProfileStyle {
  if (toothCount <= 7) return "HIGH_OGIVAL";
  if (toothCount <= 9) return "MEDIUM_OGIVAL";
  return "ROUND";
}

const TOOTH_FORM_TABLE: Record<CycloidalProfileStyle, { low: CycloidalToothFactors; high: CycloidalToothFactors }> = {
  ROUND: {
    low: { addendumFactor: 0.525, addendumArcRadiusFactor: 0.525 },
    high: { addendumFactor: 0.625, addendumArcRadiusFactor: 0.625 },
  },
  MEDIUM_OGIVAL: {
    low: { addendumFactor: 0.670, addendumArcRadiusFactor: 0.700 },
    high: { addendumFactor: 0.805, addendumArcRadiusFactor: 0.840 },
  },
  HIGH_OGIVAL: {
    low: { addendumFactor: 0.855, addendumArcRadiusFactor: 1.050 },
    high: { addendumFactor: 1.050, addendumArcRadiusFactor: 1.250 },
  },
};

/** SRC-0026's standardized addendum table, by this gear's own recommended style and leaf-count bracket (6-10 / 11+). */
export function cycloidalToothFactors(toothCount: number): CycloidalToothFactors {
  const bracket = toothCount <= 10 ? "low" : "high";
  return TOOTH_FORM_TABLE[recommendedProfileStyle(toothCount)][bracket];
}

/** SRC-0026 eq. 21-22: the practical (clearance-reduced) addendum height factor, in modules. */
export function practicalAddendumFactor(toothCount: number): number {
  return cycloidalToothFactors(toothCount).addendumFactor * CYCLOID_TOOTH_PROPORTIONS.practicalClearanceFactor;
}

/**
 * SRC-0026: dedendum depth factor, in modules — the (practical)
 * addendum factor of whatever this gear meshes, plus 0.4 modules fixed
 * clearance. Uses this gear's OWN practical addendum factor (ASM-0033):
 * exact only when it meshes an identical twin of itself.
 */
export function dedendumDepthFactor(toothCount: number): number {
  return practicalAddendumFactor(toothCount) + CYCLOID_TOOTH_PROPORTIONS.dedendumBottomClearanceInModules;
}

/** SRC-0026: tooth width (arc length) at the pitch circle, in modules, by this gear's own leaf-count bracket. */
export function toothWidthFactor(toothCount: number): number {
  return toothCount <= 10 ? CYCLOID_TOOTH_PROPORTIONS.toothWidthInModules.low : CYCLOID_TOOTH_PROPORTIONS.toothWidthInModules.high;
}

export interface AddendumArc {
  readonly centre: Point2D;
  readonly radius: number;
}

/**
 * The circle of `radius` through both `p1` and `p2`, picking whichever
 * of the two solutions has its centre nearer the origin — the branch
 * whose far arc bulges away from the origin, the convex, outward
 * tooth-tip construction (SRC-0026 step 5: "set the compass to the
 * calculated addendum radius... to get the arc to pass through the
 * apex and the point where the dedendum ends on the pitch circle").
 * Returns `null` if no such circle exists (the points are farther
 * apart than the diameter, 2·radius).
 */
export function addendumArcThroughTwoPoints(p1: Point2D, p2: Point2D, radius: number): AddendumArc | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > 2 * radius) return null;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const h = Math.sqrt(Math.max(0, radius * radius - (d / 2) ** 2));
  const ux = dx / d;
  const uy = dy / d;
  const c1 = { x: mid.x - h * uy, y: mid.y + h * ux };
  const c2 = { x: mid.x + h * uy, y: mid.y - h * ux };
  const centre = Math.hypot(c1.x, c1.y) <= Math.hypot(c2.x, c2.y) ? c1 : c2;
  return { centre, radius };
}
