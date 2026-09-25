import type { Length } from "@/units/length";
import { meshCentreDistance, isCentreDistanceAchievable } from "@/math/gearMath";
import { distance } from "@/math/vec2";
import type { Movement } from "@/domain/movement";
import type { GearMesh } from "@/domain/gearMesh";
import type { Gear } from "@/domain/gear";
import type { PlacementSolution } from "./solvePlacement";

export interface GearMeshGeometry {
  drivingGear: Gear;
  drivenGear: Gear;
  /** Distance between the two solved shaft axes. */
  actualCentreDistance: Length;
  /** Distance implied purely by module and tooth counts (REF-ENG §5.2). */
  idealCentreDistance: Length;
  isAchievable: boolean;
}

/**
 * Compares a mesh's placed and ideal centre distance. Returns null if
 * either shaft could not be placed. Callers must pass gears with valid
 * parameters.
 */
export function computeGearMeshGeometry(
  movement: Movement,
  mesh: GearMesh,
  placement: PlacementSolution,
): GearMeshGeometry | null {
  const drivingGear = movement.gears[mesh.drivingGearId];
  const drivenGear = movement.gears[mesh.drivenGearId];
  if (drivingGear === undefined || drivenGear === undefined) {
    throw new Error(`GearMesh ${mesh.id} references a missing gear`);
  }
  const a = placement.shaftPositions.get(drivingGear.shaftId);
  const b = placement.shaftPositions.get(drivenGear.shaftId);
  if (a === undefined || b === undefined) {
    return null;
  }

  const actualCentreDistance = distance(a, b);
  return {
    drivingGear,
    drivenGear,
    actualCentreDistance,
    idealCentreDistance: meshCentreDistance(drivingGear.module, drivingGear.toothCount, drivenGear.toothCount),
    isAchievable: isCentreDistanceAchievable(
      drivingGear.module,
      drivingGear.toothCount,
      drivenGear.toothCount,
      actualCentreDistance,
    ),
  };
}
