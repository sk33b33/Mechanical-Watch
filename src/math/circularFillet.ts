/**
 * A circular-arc root fillet: a simpler, explicitly approximate
 * stand-in for the true trochoidal fillet (ASM-0031). A real
 * rack-generated fillet is a trochoid, not a circular arc (see
 * src/math/trochoidFillet.ts for the attempt at that, and
 * reference/sources/SOURCES.yml SRC-0025 for why it stalled); this is
 * used only where the involute flank does not already reach the root
 * circle on its own (REF-ENG §6, the undercut case).
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
 * reaches the root circle directly, so no bridging fillet is needed
 * here (a future enhancement could still round that sharp corner).
 *
 * Derivation: requiring the fillet to pass through the flank's base
 * circle tangent point, matching the flank's own tangent direction
 * there (no kink), forces its centre onto the radial line through that
 * point. Requiring it also to be tangent to the root circle then fixes
 * everything: the centre sits at radius `(rootRadius + baseRadius) / 2`
 * along that same angle, and the radius is `(baseRadius - rootRadius)
 * / 2` — both tangencies are met with no remaining freedom to pick a
 * different radius (a fillet that matched the flank's own cutter
 * corner radius exactly would generally fail one of the two
 * tangencies).
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
