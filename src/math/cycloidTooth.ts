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
 * SRC-0027:
 *
 * - The dedendum is the hypocycloid traced by a "generating circle"
 *   rolling inside the gear's own pitch circle (`hypocycloidPoint`,
 *   SRC-0028). SRC-0026's generating circle diameter is the MESHING
 *   PINION's own pitch radius (`generatingCircleRadius`) — the same
 *   circle, rolled outside the wheel's pitch circle, also generates
 *   the wheel's addendum (conjugate action), which is why
 *   `cycloidalToothFactors` below is keyed by the same (mesh-aware)
 *   leaf count. When a gear has no smaller WATCH_SPECIFIC_PROFILE mesh
 *   partner, the generating circle's diameter equals half its OWN
 *   pitch diameter exactly, and the hypocycloid degenerates to a
 *   straight radial line (the Tusi couple, SRC-0028) — "clock
 *   toothing", ASM-0032's originally-shipped special case, now exactly
 *   the r=R/2 case of the one general construction, not a separate
 *   hardcoded straight line.
 * - The addendum is NOT the literal epicycloid: the standard's own
 *   practical tooth form approximates it as a circular arc, tabulated
 *   by profile style and leaf-count bracket — `cycloidalToothFactors`
 *   (ASM-0033).
 *
 * Both are keyed by `effectiveLeafCount` (src/geometry/
 * watchSpecificGearOutline.ts) rather than always the gear's own tooth
 * count — the real standard sizes both from the mesh pair.
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

/** SRC-0026's generating circle radius: half the diameter of the (mesh-aware) pinion's own pitch circle. */
export function generatingCircleRadius(leafCount: number, module: number): number {
  return (module * leafCount) / 4;
}

/**
 * A point on the hypocycloid traced by a circle of radius `r` rolling
 * without slipping inside a fixed circle of radius `R` (R ≥ r),
 * centred on the origin, for the rolling circle's own point that
 * starts, at theta=0, at (R, 0) (SRC-0028). `theta` is the rolling
 * circle centre's own angle of revolution about the origin — not the
 * rolling circle's spin.
 *
 * The degenerate case r = R/2 collapses this to the straight line
 * y=0, x=R·cos(theta) (the Tusi couple, SRC-0028) — algebraically,
 * (R−r)sinθ − r·sin((R−r)/r·θ) with r=R/2 reduces to (R/2)sinθ −
 * (R/2)sinθ ≡ 0. This is `generateWatchSpecificGearOutline`'s
 * "clock toothing" straight dedendum (ASM-0032), reached exactly when
 * `r` is `generatingCircleRadius` of this gear's own (mesh-aware)
 * effective leaf count, i.e. when the gear has no smaller
 * WATCH_SPECIFIC_PROFILE mesh partner.
 */
export function hypocycloidPoint(R: number, r: number, theta: number): Point2D {
  const k = (R - r) / r;
  return {
    x: (R - r) * Math.cos(theta) + r * Math.cos(k * theta),
    y: (R - r) * Math.sin(theta) - r * Math.sin(k * theta),
  };
}

/**
 * The smallest |theta| (signed the same as `sign`) at which the
 * hypocycloid (`hypocycloidPoint`) first reaches `targetRadius` from
 * the origin, starting from the theta=0 cusp at radius `R`. `sign`
 * selects which of the two mirror-symmetric directions to search — a
 * tooth's two flanks curve the same way but mirrored (see
 * `generateWatchSpecificGearOutline`). Radius is checked at `samples`
 * evenly-spaced steps across up to one full revolution (2π) and the
 * crossing is refined by bisection; returns `null` if the radius never
 * reaches `targetRadius` within that revolution — not expected for any
 * gear parameters this project validates (checked for ratios up to
 * 100:6 teeth), but left as an explicit, checked failure rather than a
 * silently wrong result. Also `null` for a `targetRadius` at or beyond
 * `R`: the curve starts there and only descends, so there is nothing
 * to search for.
 */
export function hypocycloidThetaAtRadius(R: number, r: number, targetRadius: number, sign: 1 | -1, samples = 2000): number | null {
  if (targetRadius >= R) return null;
  const step = ((2 * Math.PI) / samples) * sign;
  let previousTheta = 0;
  for (let i = 1; i <= samples; i += 1) {
    const theta = i * step;
    const p = hypocycloidPoint(R, r, theta);
    if (Math.hypot(p.x, p.y) <= targetRadius) {
      let lo = previousTheta;
      let hi = theta;
      for (let iter = 0; iter < 50; iter += 1) {
        const mid = (lo + hi) / 2;
        const midPoint = hypocycloidPoint(R, r, mid);
        if (Math.hypot(midPoint.x, midPoint.y) > targetRadius) lo = mid; else hi = mid;
      }
      return hi;
    }
    previousTheta = theta;
  }
  return null;
}
