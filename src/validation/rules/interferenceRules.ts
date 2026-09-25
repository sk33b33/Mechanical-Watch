import { toMetres } from "@/units/length";
import { distance } from "@/math/vec2";
import type { EntityId } from "@/domain/ids";
import { gearPitchDiameter } from "@/domain/gear";
import { visualTipRadius } from "@/geometry/gearOutline";
import { NUMERICAL_PARAMETERS } from "@/reference/numericalParameters";
import type { ValidationIssue } from "../validationIssue";
import { hasValidGearParameters, issue, type Rule } from "./context";

/**
 * ASSY-002 between unmeshed gears on different shafts. Pitch-circle
 * overlap is an error within the pitch model. Overlap of only the
 * visualized tips is an L0 warning, since tip geometry isn't modeled
 * (ASM-0005).
 */
export const interferenceRules: Rule = ({ movement, placement }) => {
  const issues: ValidationIssue[] = [];
  const meshedPairs = new Set(
    Object.values(movement.gearMeshes).map((mesh) => [mesh.drivingGearId, mesh.drivenGearId].sort().join("::")),
  );
  const gears = Object.values(movement.gears).filter(hasValidGearParameters);

  for (let i = 0; i < gears.length; i += 1) {
    for (let j = i + 1; j < gears.length; j += 1) {
      const gearA = gears[i];
      const gearB = gears[j];
      if (gearA === undefined || gearB === undefined) continue;
      if (gearA.shaftId === gearB.shaftId) continue;
      if (meshedPairs.has([gearA.id, gearB.id].sort().join("::"))) continue;
      const a = placement.shaftPositions.get(gearA.shaftId);
      const b = placement.shaftPositions.get(gearB.shaftId);
      if (a === undefined || b === undefined) continue;

      const d = distance(a, b);
      const pitchReach = (toMetres(gearPitchDiameter(gearA)) + toMetres(gearPitchDiameter(gearB))) / 2;
      const pair: EntityId[] = [gearA.id, gearB.id];
      if (d < pitchReach - NUMERICAL_PARAMETERS.centreDistanceToleranceMetres) {
        issues.push(
          issue("ASSY-002", "pitch-overlap", "error", "L1_GEOMETRIC", pair,
            `${gearA.name} and ${gearB.name} are not meshed but their pitch circles overlap.`,
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
  return issues;
};
