import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import { meshCentreDistance, isCentreDistanceAchievable } from "@/math/gearMath";
import type { Movement } from "@/domain/movement";
import type { GearMesh } from "@/domain/gearMesh";
import type { Gear } from "@/domain/gear";

export interface GearMeshGeometry {
  drivingGear: Gear;
  drivenGear: Gear;
  /** Actual distance between the two shafts' axes, from assembly placement. */
  actualCentreDistance: Length;
  /** Distance implied purely by module and tooth counts. */
  idealCentreDistance: Length;
  isAchievable: boolean;
}

function distance(a: { x: Length; y: Length }, b: { x: Length; y: Length }): Length {
  return metres(Math.hypot(a.x - b.x, a.y - b.y));
}

export function computeGearMeshGeometry(movement: Movement, mesh: GearMesh): GearMeshGeometry {
  const drivingGear = movement.gears[mesh.drivingGearId];
  const drivenGear = movement.gears[mesh.drivenGearId];
  if (drivingGear === undefined || drivenGear === undefined) {
    throw new Error(`GearMesh ${mesh.id} references a missing gear`);
  }
  const drivingShaft = movement.shafts[drivingGear.shaftId];
  const drivenShaft = movement.shafts[drivenGear.shaftId];
  if (drivingShaft === undefined || drivenShaft === undefined) {
    throw new Error(`GearMesh ${mesh.id} references a missing shaft`);
  }

  const actualCentreDistance = distance(drivingShaft.position, drivenShaft.position);
  const ideal = meshCentreDistance(drivingGear.module, drivingGear.toothCount, drivenGear.toothCount);

  return {
    drivingGear,
    drivenGear,
    actualCentreDistance,
    idealCentreDistance: ideal,
    isAchievable: isCentreDistanceAchievable(
      drivingGear.module,
      drivingGear.toothCount,
      drivenGear.toothCount,
      actualCentreDistance,
    ),
  };
}
