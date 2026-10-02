/**
 * Circular-arc root fillets: simpler, explicitly approximate stand-ins
 * for the true trochoidal fillet (ASM-0031). A real rack-generated
 * fillet is a trochoid, not a circular arc (see
 * src/math/trochoidFillet.ts for the attempt at that, and
 * reference/sources/SOURCES.yml SRC-0025 for why it stalled). Two
 * different constructions cover the two cases in
 * src/geometry/involuteGearOutline.ts:
 *
 * - `circularRootFillet`, where the root circle sits inside the base
 *   circle (undercut): the involute does not reach the root at all, so
 *   the fillet must bridge the whole gap, tangent to the root circle
 *   and to the involute flank's own base-circle tangent point.
 * - `cornerFillet`, otherwise: the involute already reaches the root
 *   on its own, so only the sharp corner where it meets the
 *   (straight-line-approximated) root needs rounding — a small circle
 *   tangent to the flank's actual local direction there and to the
 *   line toward the next tooth, the classical fillet-between-two-lines
 *   construction. (An earlier attempt tried to reuse
 *   `circularRootFillet`'s line for this by extending it past the base
 *   circle; that line is only tangent to the true involute curve
 *   exactly at the base circle; everywhere else the two diverge, so
 *   anything built on that extension did not actually touch the real
 *   flank — caught by rendering the outline, not by the unit tests,
 *   which checked the construction was internally consistent without
 *   checking it was consistent with the curve it was meant to meet.)
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface CircularFillet {
  /** Fillet circle centre (gear-local frame, origin at the shaft axis). */
  readonly centre: Point2D;
  /** Radius: exactly half the gap between the root and base circles — see the derivation below, there is no free choice once both tangencies are required. */
  readonly radius: number;
  /** Where the fillet touches the root circle. */
  readonly rootTangentPoint: Point2D;
  /** Where the fillet meets the flank: exactly the involute's own base-circle tangent point, so the join has no gap. */
  readonly flankTangentPoint: Point2D;
}

/**
 * Fillet circle tangent to the root circle (radius `rootRadius`,
 * centred on the shaft axis) and to the involute flank's own
 * base-circle tangent point, at `flankAngleAtBase` (the "+" flank
 * convention of `src/geometry/involuteGearOutline.ts`: angle measured
 * from the tooth centreline, increasing toward the flank).
 *
 * Returns `null` when `rootRadius >= baseRadius`: the involute already
 * reaches the root circle directly (use `cornerFillet` instead).
 *
 * Derivation: requiring the fillet to pass through the flank's base
 * circle tangent point, matching the flank's own tangent direction
 * there (no kink), forces its centre onto the radial line through that
 * point. Requiring it also to be tangent to the root circle then fixes
 * everything: the centre sits at radius `(rootRadius + baseRadius) / 2`
 * along that same angle, and the radius is `(baseRadius - rootRadius)
 * / 2` — both tangencies are met with no remaining freedom to pick a
 * different radius.
 */
export function circularRootFillet(rootRadius: number, baseRadius: number, flankAngleAtBase: number): CircularFillet | null {
  if (rootRadius >= baseRadius) return null;
  const radius = (baseRadius - rootRadius) / 2;
  const centreRadius = rootRadius + radius;
  const unit = { x: Math.cos(flankAngleAtBase), y: Math.sin(flankAngleAtBase) };
  return {
    centre: { x: centreRadius * unit.x, y: centreRadius * unit.y },
    radius,
    rootTangentPoint: { x: rootRadius * unit.x, y: rootRadius * unit.y },
    flankTangentPoint: { x: baseRadius * unit.x, y: baseRadius * unit.y },
  };
}

/** A point on the fillet arc, at angle `t` (radians) around the fillet circle's own centre. */
export function filletArcPoint(fillet: CircularFillet, t: number): Point2D {
  return { x: fillet.centre.x + fillet.radius * Math.cos(t), y: fillet.centre.y + fillet.radius * Math.sin(t) };
}

export interface CornerFillet {
  readonly centre: Point2D;
  readonly radius: number;
  /** Where the fillet touches the first edge (`dir1`), at distance `tangentDistance` from `corner` along it. */
  readonly tangent1: Point2D;
  /** Where the fillet touches the second edge (`dir2`), at distance `tangentDistance` from `corner` along it. */
  readonly tangent2: Point2D;
  readonly tangentDistance: number;
}

/**
 * The classical fillet between two rays sharing an endpoint: a circle
 * of `radius` tangent to both, cutting the corner at `corner`. `dir1`
 * and `dir2` are unit vectors pointing away from `corner` along each
 * edge. Used where the involute flank already reaches the root circle
 * on its own (non-undercut, ASM-0031): `corner` is that root point,
 * `dir1` the flank's own local direction there (tangent to the real
 * curve, not the generating line — see the module comment), `dir2`
 * toward the next tooth's matching root point (the straight line this
 * approximates the root arc as, REF-ENG §6).
 *
 * The two tangent points are equidistant from `corner` (a standard
 * property of this construction: both are points of tangency from the
 * same external point, the corner, to the same circle).
 */
export function cornerFillet(corner: Point2D, dir1: Point2D, dir2: Point2D, radius: number): CornerFillet {
  const bisectorRaw = { x: dir1.x + dir2.x, y: dir1.y + dir2.y };
  const bisectorLength = Math.hypot(bisectorRaw.x, bisectorRaw.y);
  const bisector = { x: bisectorRaw.x / bisectorLength, y: bisectorRaw.y / bisectorLength };
  const halfAngle = Math.acos(Math.min(1, Math.max(-1, dir1.x * bisector.x + dir1.y * bisector.y)));
  const centreDistance = radius / Math.sin(halfAngle);
  const tangentDistance = radius / Math.tan(halfAngle);
  const centre = { x: corner.x + centreDistance * bisector.x, y: corner.y + centreDistance * bisector.y };
  return {
    centre,
    radius,
    tangent1: { x: corner.x + tangentDistance * dir1.x, y: corner.y + tangentDistance * dir1.y },
    tangent2: { x: corner.x + tangentDistance * dir2.x, y: corner.y + tangentDistance * dir2.y },
    tangentDistance,
  };
}
