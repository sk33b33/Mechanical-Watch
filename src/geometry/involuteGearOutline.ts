import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { toMetres } from "@/units/length";
import { baseRadius, involuteAngle, involutePoint } from "@/math/involute";
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

/**
 * Full involute tooth profile (SRC-0024 §3-4, ASM-0030), in metres,
 * centred on the shaft axis. `gear.profileModel` must be
 * `INVOLUTE_PROFILE` and `gear.pressureAngle` must be set — callers
 * dispatch on that (see `src/geometry/gearGeometry.ts`); GEAR-103
 * validates it.
 *
 * Each tooth: a straight radial dedendum segment (not the true
 * trochoidal fillet a rack cutter would generate, ASM-0030) where the
 * root circle is inside the base circle, then the involute flank from
 * there to the tip, a short tip arc, and the mirrored flank back down.
 * Standard (unshifted) tooth thickness: zero backlash, half the pitch
 * angle at the pitch circle.
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
  const flankStartRadius = Math.max(base, rootRadius);

  const toothAngle = (2 * Math.PI) / gear.toothCount;
  const toothHalfAngleAtPitch = Math.PI / (2 * gear.toothCount);
  // Angular half-width of the tooth at the base circle — also the angle
  // of the straight radial dedendum segment below it.
  const baseAngleOffset = toothHalfAngleAtPitch + involuteAngle(pressureAngle);
  const halfAngleAt = (radius: number): number =>
    radius <= base ? baseAngleOffset : baseAngleOffset - involuteRollAngle(base, radius);

  const points: Point2D[] = [];
  for (let i = 0; i < gear.toothCount; i += 1) {
    const centreAngle = i * toothAngle;

    if (rootRadius < base - 1e-12) {
      points.push(polar(rootRadius, centreAngle - baseAngleOffset));
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
    if (rootRadius < base - 1e-12) {
      points.push(polar(rootRadius, centreAngle + baseAngleOffset));
    }
  }
  return points;
}
