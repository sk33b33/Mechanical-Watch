import type { Gear } from "@/domain/gear";
import { gearPitchDiameter } from "@/domain/gear";
import { toMetres } from "@/units/length";

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Generates a 2D outline for a gear wheel, in metres, centred on the
 * shaft axis.
 *
 * APPROXIMATION: this traces trapezoidal teeth using standard addendum
 * (module) / dedendum (1.25 * module) proportions. It is NOT a true
 * involute tooth profile — no pressure-angle-correct flank curve,
 * undercut or backlash is modeled. It is sufficient for visualising
 * tooth count, pitch diameter and meshing, but must not be presented as
 * manufacturable tooth geometry (see docs/MASTER_BUILD_PROMPT.md
 * "Engineering honesty").
 */
export function generateGearOutline(gear: Gear): Point2D[] {
  const pitchRadius = toMetres(gearPitchDiameter(gear)) / 2;
  const module = toMetres(gear.module);
  const addendumRadius = pitchRadius + module;
  const dedendumRadius = pitchRadius - 1.25 * module;
  const rootRadius = Math.max(dedendumRadius, pitchRadius * 0.5);

  const toothAngle = (2 * Math.PI) / gear.toothCount;
  const toothTipFraction = 0.35;
  const toothRootFraction = 0.55;

  const points: Point2D[] = [];
  for (let i = 0; i < gear.toothCount; i += 1) {
    const centreAngle = i * toothAngle;
    const halfTip = (toothAngle * toothTipFraction) / 2;
    const halfRoot = (toothAngle * toothRootFraction) / 2;

    const angles = [
      centreAngle - halfRoot,
      centreAngle - halfTip,
      centreAngle + halfTip,
      centreAngle + halfRoot,
    ];
    const radii = [rootRadius, addendumRadius, addendumRadius, rootRadius];

    for (let j = 0; j < angles.length; j += 1) {
      const angle = angles[j] ?? centreAngle;
      const radius = radii[j] ?? rootRadius;
      points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }
  }

  return points;
}
