import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { toMetres } from "@/units/length";
import type { AssumptionId } from "@/reference/assumptions";

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Visualization-only tooth proportions (ASM-0005). These are generic
 * basic-rack-style proportions with trapezoidal flanks, NOT an involute
 * or horological profile, and carry no provenance for watch gears. They
 * exist so a PITCH_MODEL gear can be seen; they must never be used to
 * claim tooth engagement or manufacturability (ASM-0004).
 */
export const GEAR_VISUALIZATION_PROPORTIONS = {
  addendumInModules: 1.0,
  dedendumInModules: 1.25,
  /** Visual floor on the root circle so very small tooth counts still draw a solid hub. */
  minRootRadiusFractionOfPitch: 0.5,
  toothTipFractionOfPitchAngle: 0.35,
  toothRootFractionOfPitchAngle: 0.55,
  boreRadiusInModules: 1.5,
  /** Keeps the bore inside the root circle at very small tooth counts. */
  maxBoreRadiusFractionOfPitch: 0.25,
  assumption: "ASM-0005" satisfies AssumptionId,
} as const;

/** Radius of the visualized tip circle, in metres (ASM-0005, visual only). */
export function visualTipRadius(gear: Gear): number {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  return pitchRadius + GEAR_VISUALIZATION_PROPORTIONS.addendumInModules * toMetres(gear.module);
}

/**
 * 2D outline for a gear wheel, in metres, centred on the shaft axis.
 * Visual (L0) approximation — see GEAR_VISUALIZATION_PROPORTIONS.
 */
export function generateGearOutline(gear: Gear): Point2D[] {
  const p = GEAR_VISUALIZATION_PROPORTIONS;
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  const module = toMetres(gear.module);
  const tipRadius = visualTipRadius(gear);
  const rootRadius = Math.max(
    pitchRadius - p.dedendumInModules * module,
    pitchRadius * p.minRootRadiusFractionOfPitch,
  );

  const toothAngle = (2 * Math.PI) / gear.toothCount;
  const halfTip = (toothAngle * p.toothTipFractionOfPitchAngle) / 2;
  const halfRoot = (toothAngle * p.toothRootFractionOfPitchAngle) / 2;

  const points: Point2D[] = [];
  for (let i = 0; i < gear.toothCount; i += 1) {
    const centreAngle = i * toothAngle;
    const profile: [number, number][] = [
      [centreAngle - halfRoot, rootRadius],
      [centreAngle - halfTip, tipRadius],
      [centreAngle + halfTip, tipRadius],
      [centreAngle + halfRoot, rootRadius],
    ];
    for (const [angle, radius] of profile) {
      points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }
  }

  return points;
}
