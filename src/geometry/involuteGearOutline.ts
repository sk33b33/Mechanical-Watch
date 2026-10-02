import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { toMetres } from "@/units/length";
import { baseRadius, involuteAngle, involutePoint } from "@/math/involute";
import { circularRootFillet, cornerFillet, filletArcPoint } from "@/math/circularFillet";
import type { AssumptionId } from "@/reference/assumptions";
import type { Point2D } from "./gearOutline";

/**
 * Standard full-depth metric involute proportions (SRC-0024, ASM-0030).
 * A generic machine-gear convention — not validated for any horological
 * manufacture (REF-ENG §6).
 */
export const INVOLUTE_PROPORTIONS = {
  addendumInModules: 1.0,
  dedendumInModules: 1.25,
  /** Samples per flank between the dedendum/base circle and the tip. Rendering resolution, not an engineering value. */
  flankSamples: 6,
  /** Samples across the tooth tip arc, between the two flanks' tip points. */
  tipArcSamples: 3,
  /** Numerical floor so a very low tooth count still draws a solid hub (ASM-0008), not an engineering limit. */
  minRootRadiusFractionOfPitch: 0.3,
  /** Samples along the root fillet arc. */
  filletSamples: 8,
  /** Standard cutter corner radius (SRC-0024 Fig. 1-1), used for the root fillet on a non-undercut tooth (ASM-0031). */
  rootFilletRadiusInModules: 0.38,
  assumption: "ASM-0030" satisfies AssumptionId,
} as const;

/** Radius of the tip (addendum) circle, in metres (SRC-0024 Table 4-1: h_a = m). */
export function involuteTipRadius(gear: Gear): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius + INVOLUTE_PROPORTIONS.addendumInModules * toMetres(gear.module);
}

/** Radius of the root (dedendum) circle, in metres (SRC-0024 Table 4-1: h_f = 1.25m), floored for very low tooth counts. */
export function involuteRootRadius(gear: Gear): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  const dedendum = INVOLUTE_PROPORTIONS.dedendumInModules * toMetres(gear.module);
  return Math.max(pitchRadius - dedendum, pitchRadius * INVOLUTE_PROPORTIONS.minRootRadiusFractionOfPitch);
}

function polar(radius: number, angle: number): Point2D {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function involuteRollAngle(base: number, radius: number): number {
  const p = involutePoint(base, radius);
  return Math.atan2(p.y, p.x);
}

function normalize(v: Point2D): Point2D {
  const len = Math.hypot(v.x, v.y);
  return { x: v.x / len, y: v.y / len };
}

function rotate(p: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/**
 * Points along the circular root fillet for an UNDERCUT tooth
 * (ASM-0031), from the root circle to where it meets the flank
 * (inclusive of both ends — callers drop whichever end duplicates an
 * adjacent point).
 *
 * Built in a local frame where the tooth centreline is angle 0 (so the
 * "−" flank is simply the "+" flank reflected across that centreline),
 * then rotated into place by `centreAngle` — reflecting in the global
 * frame directly would mirror across the x-axis instead of the
 * tooth's own centreline for every tooth but the first.
 */
function filletArcPoints(rootRadius: number, base: number, baseAngleOffset: number, centreAngle: number, mirror: boolean, samples: number): Point2D[] {
  const fillet = circularRootFillet(rootRadius, base, baseAngleOffset);
  if (fillet === null) return [];
  const cos = Math.cos(centreAngle);
  const sin = Math.sin(centreAngle);
  const points: Point2D[] = [];
  for (let s = 0; s <= samples; s += 1) {
    const t = baseAngleOffset + Math.PI * (1 + s / samples);
    const local = filletArcPoint(fillet, t);
    const p = mirror ? { x: local.x, y: -local.y } : local;
    points.push({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });
  }
  return points;
}

/**
 * Arc points for the small corner fillet that rounds where a
 * NON-undercut flank meets the root land (ASM-0031): the involute
 * already reaches the root on its own, so there is no gap to bridge,
 * only a sharp corner to round, using `cornerFillet` (the flank's own
 * local tangent direction there, and the straight line this
 * approximates the root land as, toward the neighbouring tooth's
 * matching root point, REF-ENG §6).
 *
 * Built in the "+" (ascending) flank's own local frame (tooth
 * centreline at angle 0), same reasoning as `filletArcPoints` above;
 * the "−" (descending) corner is this construction's mirror image
 * (reflect y), proven equal by substitution rather than re-derived.
 * `leading` selects which corner of the tooth this is: `true` for the
 * "+" flank's root corner (drawn before the ascending flank, in
 * land→flank order so it continues into the flank), `false` for the
 * "−" flank's (drawn after the descending flank, in flank→land order).
 *
 * Tangent to the flank's local direction and to the land line, not to
 * the root circle itself (unlike `circularRootFillet`'s undercut
 * case): like any chord of a circle, the straight land line it rounds
 * already dips inside the nominal root radius between its endpoints,
 * and this arc inherits a (smaller, bounded by the fillet radius)
 * version of that same dip — confirmed by rendering and checked in
 * `involuteGearOutline.test.ts`, not a bug to fix, since fixing it
 * would mean abandoning the tangent-to-the-real-flank-direction
 * property that was the whole point of this construction (see the
 * module comment in `circularFillet.ts`).
 */
function cornerFilletArcPoints(
  rootRadius: number,
  rootHalfAngle: number,
  toothAngle: number,
  halfAngleAt: (radius: number) => number,
  filletRadius: number,
  centreAngle: number,
  leading: boolean,
  samples: number,
): { points: Point2D[]; flankTangentRadius: number } {
  const eps = rootRadius * 1e-6;
  const corner = polar(rootRadius, -rootHalfAngle);
  const nearTip = polar(rootRadius + eps, -halfAngleAt(rootRadius + eps));
  const dir1 = normalize({ x: nearTip.x - corner.x, y: nearTip.y - corner.y });
  const neighbour = polar(rootRadius, rootHalfAngle - toothAngle);
  const dir2 = normalize({ x: neighbour.x - corner.x, y: neighbour.y - corner.y });
  const fillet = cornerFillet(corner, dir1, dir2, filletRadius);
  const flankTangentRadius = Math.hypot(fillet.tangent1.x, fillet.tangent1.y);

  const angle1 = Math.atan2(fillet.tangent1.y - fillet.centre.y, fillet.tangent1.x - fillet.centre.x);
  const angle2 = Math.atan2(fillet.tangent2.y - fillet.centre.y, fillet.tangent2.x - fillet.centre.x);
  let delta = angle2 - angle1;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;

  const local: Point2D[] = [];
  for (let s = 0; s <= samples; s += 1) {
    const t = angle1 + (delta * s) / samples;
    local.push({ x: fillet.centre.x + fillet.radius * Math.cos(t), y: fillet.centre.y + fillet.radius * Math.sin(t) });
  }
  // local[] runs tangent1 (flank side) -> tangent2 (land side), in the "+" flank's own local frame.
  const points = leading
    ? local.slice().reverse().map((p) => rotate(p, centreAngle))
    : local.map((p) => rotate({ x: p.x, y: -p.y }, centreAngle));
  return { points, flankTangentRadius };
}

/**
 * Full involute tooth profile (SRC-0024 §3-4, ASM-0030), in metres,
 * centred on the shaft axis. `gear.profileModel` must be
 * `INVOLUTE_PROFILE` and `gear.pressureAngle` must be set — callers
 * dispatch on that (see `src/geometry/gearGeometry.ts`); GEAR-103
 * validates it.
 *
 * Each tooth: a circular root fillet arc (not the true trochoidal
 * fillet a rack cutter would generate, ASM-0031) where the root circle
 * is inside the base circle, then the involute flank from there to the
 * tip, a short tip arc, and the mirrored flank back down. Standard
 * (unshifted) tooth thickness: zero backlash, half the pitch angle at
 * the pitch circle.
 */
export function generateInvoluteGearOutline(gear: Gear): Point2D[] {
  const pressureAngle = gear.pressureAngle;
  if (pressureAngle === null) {
    throw new Error(`Gear ${gear.id} is INVOLUTE_PROFILE but has no pressure angle`);
  }
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  const base = baseRadius(pitchRadius, pressureAngle);
  const tipRadius = involuteTipRadius(gear);
  const rootRadius = involuteRootRadius(gear);

  const toothAngle = (2 * Math.PI) / gear.toothCount;
  const toothHalfAngleAtPitch = Math.PI / (2 * gear.toothCount);
  // Angular half-width of the tooth at the base circle.
  const baseAngleOffset = toothHalfAngleAtPitch + involuteAngle(pressureAngle);
  const halfAngleAt = (radius: number): number =>
    radius <= base ? baseAngleOffset : baseAngleOffset - involuteRollAngle(base, radius);

  // Undercut (root inside base): the fillet must bridge the whole gap,
  // which forces its radius (no freedom to use the standard cutter
  // corner radius and still meet the flank with no kink, ASM-0031).
  // Otherwise the flank already reaches the root on its own, so only
  // the corner where it meets the root land needs rounding, with the
  // standard cutter corner radius (`cornerFilletArcPoints`).
  const undercut = rootRadius < base - 1e-12;
  const cornerFilletRadius = INVOLUTE_PROPORTIONS.rootFilletRadiusInModules * toMetres(gear.module);
  const rootHalfAngle = halfAngleAt(rootRadius);

  const flankStartRadius = undercut
    ? base
    : cornerFilletArcPoints(rootRadius, rootHalfAngle, toothAngle, halfAngleAt, cornerFilletRadius, 0, true, 1).flankTangentRadius;

  const points: Point2D[] = [];
  for (let i = 0; i < gear.toothCount; i += 1) {
    const centreAngle = i * toothAngle;

    if (undercut) {
      const arc = filletArcPoints(rootRadius, base, baseAngleOffset, centreAngle, true, INVOLUTE_PROPORTIONS.filletSamples);
      points.push(...arc.slice(0, -1));
    } else {
      const { points: arc } = cornerFilletArcPoints(rootRadius, rootHalfAngle, toothAngle, halfAngleAt, cornerFilletRadius, centreAngle, true, INVOLUTE_PROPORTIONS.filletSamples);
      points.push(...arc.slice(0, -1));
    }
    for (let s = 0; s < INVOLUTE_PROPORTIONS.flankSamples; s += 1) {
      const r = flankStartRadius + ((tipRadius - flankStartRadius) * s) / (INVOLUTE_PROPORTIONS.flankSamples - 1);
      points.push(polar(r, centreAngle - halfAngleAt(r)));
    }
    const tipHalfAngle = halfAngleAt(tipRadius);
    for (let s = 1; s < INVOLUTE_PROPORTIONS.tipArcSamples - 1; s += 1) {
      const angle = centreAngle - tipHalfAngle + ((2 * tipHalfAngle) * s) / (INVOLUTE_PROPORTIONS.tipArcSamples - 1);
      points.push(polar(tipRadius, angle));
    }
    for (let s = INVOLUTE_PROPORTIONS.flankSamples - 1; s >= 0; s -= 1) {
      const r = flankStartRadius + ((tipRadius - flankStartRadius) * s) / (INVOLUTE_PROPORTIONS.flankSamples - 1);
      points.push(polar(r, centreAngle + halfAngleAt(r)));
    }
    if (undercut) {
      const arc = filletArcPoints(rootRadius, base, baseAngleOffset, centreAngle, false, INVOLUTE_PROPORTIONS.filletSamples);
      points.push(...arc.slice(0, -1).reverse());
    } else {
      // Natural order from cornerFilletArcPoints (leading=false) is
      // already flank -> land; drop the flank-side point (index 0),
      // which duplicates the descending flank loop's last point above.
      const { points: arc } = cornerFilletArcPoints(rootRadius, rootHalfAngle, toothAngle, halfAngleAt, cornerFilletRadius, centreAngle, false, INVOLUTE_PROPORTIONS.filletSamples);
      points.push(...arc.slice(1));
    }
  }
  return points;
}
