import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import type { Movement } from "@/domain/movement";
import { toMetres } from "@/units/length";
import {
  CYCLOID_TOOTH_PROPORTIONS,
  addendumArcThroughTwoPoints,
  cycloidalToothFactors,
  dedendumDepthFactor,
  generatingCircleRadius,
  hypocycloidPoint,
  hypocycloidThetaAtRadius,
  practicalAddendumFactor,
  toothWidthFactor,
} from "@/math/cycloidTooth";
import type { Point2D } from "./gearOutline";

export { CYCLOID_TOOTH_PROPORTIONS };

/** Samples along each addendum arc flank, and each dedendum hypocycloid flank. Rendering resolution, not an engineering value. */
const ADDENDUM_ARC_SAMPLES = 8;
const DEDENDUM_ARC_SAMPLES = 8;

function rotate(p: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** The gears this one meshes with, in either mesh role — a mesh isn't directional for tooth-form purposes. */
function meshPartners(movement: Movement, gear: Gear): Gear[] {
  const partners: Gear[] = [];
  for (const mesh of Object.values(movement.gearMeshes)) {
    const partnerId = mesh.drivingGearId === gear.id ? mesh.drivenGearId
      : mesh.drivenGearId === gear.id ? mesh.drivingGearId
        : null;
    if (partnerId === null) continue;
    const partner = movement.gears[partnerId];
    if (partner !== undefined) partners.push(partner);
  }
  return partners;
}

/**
 * The leaf count SRC-0026's standardized tables are keyed by for this
 * gear (ASM-0033): the smaller of its own tooth count and its
 * WATCH_SPECIFIC_PROFILE meshing partner's. SRC-0026's own
 * addendum-height equation (eq. 17) is a function of the pinion leaf
 * count and the gear ratio — "the tooth profiles depend on the pinion
 * counts" — so both gears of a mesh are cut with one standardized
 * cutter selection, keyed by the pinion (smaller-leaved) side; using
 * only the gear's own tooth count (as if every gear meshed an
 * identical twin) was ASM-0033's original, coarser simplification.
 *
 * Falls back to the gear's own tooth count when `movement` is not
 * supplied, the gear has no mesh, or none of its mesh partners share
 * this profile model (GEAR-003 already flags that mismatch
 * separately). A gear meshing more than one WATCH_SPECIFIC_PROFILE
 * partner (not expected in a simple going train) uses the smallest of
 * them, the same conservative, more-aggressive-profile direction a
 * single pinion partner would push toward.
 */
export function effectiveLeafCount(gear: Gear, movement?: Movement): number {
  if (movement === undefined) return gear.toothCount;
  const partners = meshPartners(movement, gear).filter((p) => p.profileModel === "WATCH_SPECIFIC_PROFILE");
  if (partners.length === 0) return gear.toothCount;
  const smallestPartnerCount = Math.min(...partners.map((p) => p.toothCount));
  return Math.min(gear.toothCount, smallestPartnerCount);
}

/** Radius of the tip (addendum) circle, in metres (SRC-0026 eq. 21-22, ASM-0033). */
export function cycloidTipRadius(gear: Gear, movement?: Movement): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius + practicalAddendumFactor(effectiveLeafCount(gear, movement)) * toMetres(gear.module);
}

/** Radius of the root (dedendum) circle, in metres (SRC-0026, ASM-0032/0033). */
export function cycloidRootRadius(gear: Gear, movement?: Movement): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius - dedendumDepthFactor(effectiveLeafCount(gear, movement)) * toMetres(gear.module);
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
 * Points along the dedendum hypocycloid flank (ASM-0032), from the
 * pitch circle (idx 0, exactly `polar(pitchRadius, pitchEdgeAngle)`,
 * the hypocycloid's own theta=0 cusp) to the root circle (idx last).
 * `sign` selects which of the two mirror-symmetric directions the
 * curve bends in — the tooth's two flanks curve the same way but
 * mirrored, proven exactly by `hypocycloidPoint`'s own
 * x(−θ)=x(θ), y(−θ)=−y(θ) symmetry (src/math/cycloidTooth.test.ts).
 * Degenerates to the exact straight radial line "clock toothing"
 * already relied on when `generatingRadius` is half `pitchRadius`
 * (no smaller WATCH_SPECIFIC_PROFILE mesh partner — ASM-0032).
 */
function dedendumFlankPoints(pitchRadius: number, generatingRadius: number, rootRadius: number, pitchEdgeAngle: number, sign: 1 | -1, samples: number): Point2D[] {
  const thetaRoot = hypocycloidThetaAtRadius(pitchRadius, generatingRadius, rootRadius, sign);
  if (thetaRoot === null) {
    throw new Error(
      `Cycloidal dedendum construction did not reach the root radius within one revolution `
      + `(pitch radius ${String(pitchRadius)} m, generating radius ${String(generatingRadius)} m, root radius ${String(rootRadius)} m)`,
    );
  }
  const points: Point2D[] = [];
  for (let s = 0; s <= samples; s += 1) {
    const theta = (thetaRoot * s) / samples;
    points.push(rotate(hypocycloidPoint(pitchRadius, generatingRadius, theta), pitchEdgeAngle));
  }
  return points;
}

/**
 * Full cycloidal tooth profile for a WATCH_SPECIFIC_PROFILE gear
 * (SRC-0026, ASM-0032, ASM-0033), in metres, centred on the shaft
 * axis. Does not use `gear.pressureAngle` — a cycloidal tooth has no
 * pressure angle (REF-ENG §6).
 *
 * When `movement` is supplied, the standardized proportions (addendum
 * style/radius, dedendum depth and shape, tooth width) are keyed by
 * `effectiveLeafCount` — this gear's actual meshing pinion partner's
 * leaf count where there is one — rather than always this gear's own
 * tooth count; see `effectiveLeafCount`'s own doc comment.
 *
 * Each tooth: a dedendum hypocycloid flank (`dedendumFlankPoints`,
 * ASM-0032) from the pitch circle down to the root circle, then a
 * circular-arc addendum (ASM-0033) from there to the tip apex on the
 * tooth's own centreline, and the mirrored arc back down the other
 * flank. Unmeshed (or meshing no smaller WATCH_SPECIFIC_PROFILE
 * partner), the dedendum is the exact straight radial line "clock
 * toothing" always meant — now reached as that construction's own
 * degenerate case, not a separately hardcoded shape. Unlike
 * `generateGearOutline` and `generateInvoluteGearOutline`, tooth and
 * space are NOT equal (SRC-0026): the tooth is narrower than half the
 * circular pitch.
 */
export function generateWatchSpecificGearOutline(gear: Gear, movement?: Movement): Point2D[] {
  const leafCount = effectiveLeafCount(gear, movement);
  if (leafCount < CYCLOID_TOOTH_PROPORTIONS.minimumToothCount) {
    const because = leafCount === gear.toothCount ? "" : ` (its own tooth count is ${String(gear.toothCount)}; the mesh pinion partner's governs)`;
    throw new Error(
      `Gear ${gear.id} is WATCH_SPECIFIC_PROFILE with an effective leaf count of ${String(leafCount)}${because}, `
      + `below SRC-0026's cited table range of ${String(CYCLOID_TOOTH_PROPORTIONS.minimumToothCount)}`,
    );
  }
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  const module = toMetres(gear.module);
  const tipRadius = cycloidTipRadius(gear, movement);
  const rootRadius = cycloidRootRadius(gear, movement);
  const addendumArcRadius = cycloidalToothFactors(leafCount).addendumArcRadiusFactor * module;
  const generatingRadius = generatingCircleRadius(leafCount, module);

  const toothAngle = (2 * Math.PI) / gear.toothCount;
  const toothWidthAtPitch = toothWidthFactor(leafCount) * module;
  const toothHalfAngleAtPitch = toothWidthAtPitch / 2 / pitchRadius;

  const points: Point2D[] = [];
  for (let i = 0; i < gear.toothCount; i += 1) {
    const centreAngle = i * toothAngle;
    const leadingPitchEdgeAngle = centreAngle - toothHalfAngleAtPitch;
    const trailingPitchEdgeAngle = centreAngle + toothHalfAngleAtPitch;
    const leadingPitchEdge = polar(pitchRadius, leadingPitchEdgeAngle);
    const trailingPitchEdge = polar(pitchRadius, trailingPitchEdgeAngle);
    const apex = polar(tipRadius, centreAngle);

    const leadingDedendum = dedendumFlankPoints(pitchRadius, generatingRadius, rootRadius, leadingPitchEdgeAngle, -1, DEDENDUM_ARC_SAMPLES);
    const trailingDedendum = dedendumFlankPoints(pitchRadius, generatingRadius, rootRadius, trailingPitchEdgeAngle, 1, DEDENDUM_ARC_SAMPLES);

    points.push(...leadingDedendum.slice().reverse()); // root -> pitch
    points.push(...addendumFlankPoints(leadingPitchEdge, apex, addendumArcRadius, ADDENDUM_ARC_SAMPLES).slice(1, -1));
    points.push(apex);
    points.push(...addendumFlankPoints(apex, trailingPitchEdge, addendumArcRadius, ADDENDUM_ARC_SAMPLES).slice(1, -1));
    points.push(...trailingDedendum); // pitch -> root
  }
  return points;
}
