import { toMetres } from "@/units/length";
import { distance } from "@/math/vec2";
import type { EntityId } from "@/domain/ids";
import { gearPitchDiameter, type Gear } from "@/domain/gear";
import { visualTipRadius } from "@/geometry/gearOutline";
import {
  arborZRange,
  frameZRange,
  gearZRange,
  isCompleteFrame,
  outlineOverlapsCircle,
  zOverlaps,
} from "@/assembly/assemblyGeometry";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { ValidationIssue } from "../validationIssue";
import { hasValidGearParameters, issue, type Rule } from "./context";

function pitchRadius(gear: Gear): number {
  return toMetres(gearPitchDiameter(gear)) / 2;
}

function hasValidAxialParameters(gear: Gear): boolean {
  return Number.isFinite(gear.zCentre) && Number.isFinite(gear.thickness) && gear.thickness > 0;
}

/** GEAR-102: a gear needs a positive thickness and a finite axial position. */
export const gearAxialRules: Rule = ({ movement }) =>
  Object.values(movement.gears)
    .filter((gear) => !hasValidAxialParameters(gear))
    .map((gear) =>
      issue("GEAR-102", "axial", "error", "L1_GEOMETRIC", [gear.id],
        `${gear.name}: thickness must be a positive length and axial position must be finite.`, []),
    );

/**
 * ASSY-002 in three dimensions. Pitch-circle overlap is an error within
 * the pitch model. Overlap of only the visualized tips is an L0 warning
 * (ASM-0005). Frames are flat slabs with no recesses or sinks
 * (ASM-0010), so a wheel passing through one is reported even where a
 * real design might recess the plate.
 */
export const interferenceRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
  const meshedPairs = new Set(
    Object.values(movement.gearMeshes).map((mesh) => [mesh.drivingGearId, mesh.drivenGearId].sort().join("::")),
  );
  const gears = Object.values(movement.gears).filter((g) => hasValidGearParameters(g) && hasValidAxialParameters(g));

  for (let i = 0; i < gears.length; i += 1) {
    for (let j = i + 1; j < gears.length; j += 1) {
      const gearA = gears[i];
      const gearB = gears[j];
      if (gearA === undefined || gearB === undefined) continue;
      if (!zOverlaps(gearZRange(gearA), gearZRange(gearB))) continue;
      const pair: EntityId[] = [gearA.id, gearB.id];

      if (gearA.shaftId === gearB.shaftId) {
        issues.push(
          issue("ASSY-002", "same-arbor", "error", "L1_GEOMETRIC", pair,
            `${gearA.name} and ${gearB.name} occupy the same axial space on one arbor.`, []),
        );
        continue;
      }
      if (meshedPairs.has([gearA.id, gearB.id].sort().join("::"))) continue;
      const a = placement.shaftPositions.get(gearA.shaftId);
      const b = placement.shaftPositions.get(gearB.shaftId);
      if (a === undefined || b === undefined) continue;

      const d = distance(a, b);
      if (d < pitchRadius(gearA) + pitchRadius(gearB) - NUMERICAL_PARAMETERS.centreDistanceToleranceMetres) {
        issues.push(
          issue("ASSY-002", "pitch-overlap", "error", "L1_GEOMETRIC", pair,
            `${gearA.name} and ${gearB.name} are not meshed but their pitch circles overlap at the same height.`,
            ["REF-ENG §5.6"]),
        );
      } else if (d < visualTipRadius(gearA) + visualTipRadius(gearB)) {
        issues.push(
          issue("ASSY-002", "visual-tip-overlap", "warning", "L0_VISUAL", pair,
            `${gearA.name} and ${gearB.name}: visualized tooth tips overlap. Tip geometry is a visual approximation, so real clearance is unknown.`,
            ["ASM-0005"]),
        );
      }
    }
  }

  for (const gear of gears) {
    const axis = placement.shaftPositions.get(gear.shaftId);
    if (axis === undefined) continue;
    const zRange = gearZRange(gear);

    for (const frame of Object.values(movement.frames)) {
      if (!isCompleteFrame(frame) || !zOverlaps(zRange, frameZRange(frame))) continue;
      if (outlineOverlapsCircle(frame.outline, axis, pitchRadius(gear))) {
        issues.push(
          issue("ASSY-002", "gear-frame", "error", "L1_GEOMETRIC", [gear.id, frame.id],
            `${gear.name} passes through ${frame.name}. Recesses and sinks are not modeled.`, ["ASM-0010"]),
        );
      } else if (outlineOverlapsCircle(frame.outline, axis, visualTipRadius(gear))) {
        issues.push(
          issue("ASSY-002", "gear-frame-visual", "warning", "L0_VISUAL", [gear.id, frame.id],
            `${gear.name}: visualized tooth tips reach into ${frame.name}. Real clearance is unknown.`,
            ["ASM-0005", "ASM-0010"]),
        );
      }
    }

    for (const shaft of Object.values(movement.shafts)) {
      if (shaft.id === gear.shaftId) continue;
      const otherAxis = placement.shaftPositions.get(shaft.id);
      const arbor = arborZRange(movement, shaft.id);
      if (otherAxis === undefined || arbor === null || !zOverlaps(zRange, arbor)) continue;
      // A coaxial body (e.g. a cannon pinion on its arbor) shares the axis by design, not by collision.
      if (distance(axis, otherAxis) <= NUMERICAL_PARAMETERS.centreDistanceToleranceMetres) continue;
      // The arbor is treated as its bare axis line. That is a lower bound,
      // since arbor diameters are not modeled.
      if (distance(axis, otherAxis) < pitchRadius(gear)) {
        issues.push(
          issue("ASSY-002", "gear-arbor", "error", "L1_GEOMETRIC", [gear.id, shaft.id],
            `${gear.name} crosses the arbor of ${shaft.name}.`, []),
        );
      }
    }
  }
  return issues;
};
