import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { toMetres } from "@/units/length";
import {
  CYCLOID_TOOTH_PROPORTIONS,
  addendumArcThroughTwoPoints,
  cycloidalToothFactors,
  dedendumDepthFactor,
  practicalAddendumFactor,
  toothWidthFactor,
} from "@/math/cycloidTooth";
import type { Point2D } from "./gearOutline";

export { CYCLOID_TOOTH_PROPORTIONS };

/** Samples along each addendum arc flank. Rendering resolution, not an engineering value. */
const ADDENDUM_ARC_SAMPLES = 8;

/** Radius of the tip (addendum) circle, in metres (SRC-0026 eq. 21-22, ASM-0033). */
export function cycloidTipRadius(gear: Gear): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius + practicalAddendumFactor(gear.toothCount) * toMetres(gear.module);
}

/** Radius of the root (dedendum) circle, in metres (SRC-0026, ASM-0032/0033). */
export function cycloidRootRadius(gear: Gear): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius - dedendumDepthFactor(gear.toothCount) * toMetres(gear.module);
}

function polar(radius: number, angle: number): Point2D {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** Points along the addendum arc from `from` to `to` (inclusive of both ends). */
function addendumFlankPoints(from: Point2D, to: Point2D, radius: number, samples: number): Point2D[] {
  const arc = addendumArcThroughTwoPoints(from, to, radius);
  if (arc === null) {
    return [from, to];
  }
  const angleFrom = Math.atan2(from.y - arc.centre.y, from.x - arc.centre.x);
  const angleTo = Math.atan2(to.y - arc.centre.y, to.x - arc.centre.x);
  let delta = angleTo - angleFrom;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  const points: Point2D[] = [];
  for (let s = 0; s <= samples; s += 1) {
    const t = angleFrom + (delta * s) / samples;
    points.push({ x: arc.centre.x + arc.radius * Math.cos(t), y: arc.centre.y + arc.radius * Math.sin(t) });
  }
  return points;
}

/**
 * Full cycloidal tooth profile for a WATCH_SPECIFIC_PROFILE gear
 * (SRC-0026, "clock toothing", ASM-0032, ASM-0033), in metres, centred
 * on the shaft axis. Does not use `gear.pressureAngle` — a cycloidal
 * tooth has no pressure angle (REF-ENG §6).
 *
 * Each tooth: a straight radial dedendum line (the degenerate
 * hypocycloid "clock toothing" gives for free, ASM-0032) from the root
 * circle to the pitch circle, then a circular-arc addendum (ASM-0033)
 * from there to the tip apex on the tooth's own centreline, and the
 * mirrored arc back down the other flank. Unlike `generateGearOutline`
 * and `generateInvoluteGearOutline`, tooth and space are NOT equal
 * (SRC-0026): the tooth is narrower than half the circular pitch.
 */
export function generateWatchSpecificGearOutline(gear: Gear): Point2D[] {
  if (gear.toothCount < CYCLOID_TOOTH_PROPORTIONS.minimumToothCount) {
    throw new Error(
      `Gear ${gear.id} is WATCH_SPECIFIC_PROFILE with ${String(gear.toothCount)} teeth, `
      + `below SRC-0026's cited table range of ${String(CYCLOID_TOOTH_PROPORTIONS.minimumToothCount)}`,
    );
  }
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  const module = toMetres(gear.module);
  const tipRadius = cycloidTipRadius(gear);
  const rootRadius = cycloidRootRadius(gear);
  const addendumArcRadius = cycloidalToothFactors(gear.toothCount).addendumArcRadiusFactor * module;

  const toothAngle = (2 * Math.PI) / gear.toothCount;
  const toothWidthAtPitch = toothWidthFactor(gear.toothCount) * module;
  const toothHalfAngleAtPitch = toothWidthAtPitch / 2 / pitchRadius;

  const points: Point2D[] = [];
  for (let i = 0; i < gear.toothCount; i += 1) {
    const centreAngle = i * toothAngle;

    const leadingPitchEdge = polar(pitchRadius, centreAngle - toothHalfAngleAtPitch);
    const trailingPitchEdge = polar(pitchRadius, centreAngle + toothHalfAngleAtPitch);
    const leadingRoot = polar(rootRadius, centreAngle - toothHalfAngleAtPitch);
    const trailingRoot = polar(rootRadius, centreAngle + toothHalfAngleAtPitch);
    const apex = polar(tipRadius, centreAngle);

    points.push(leadingRoot, leadingPitchEdge);
    points.push(...addendumFlankPoints(leadingPitchEdge, apex, addendumArcRadius, ADDENDUM_ARC_SAMPLES).slice(1, -1));
    points.push(apex);
    points.push(...addendumFlankPoints(apex, trailingPitchEdge, addendumArcRadius, ADDENDUM_ARC_SAMPLES).slice(1, -1));
    points.push(trailingPitchEdge, trailingRoot);
  }
  return points;
}
