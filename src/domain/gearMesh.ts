import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { GearId } from "./gear";

export type GearMeshId = EntityId<"gearMesh">;

/**
 * A meshing relationship between two gears. Centre distance and
 * direction are NOT stored here: they are derived from the driving/driven
 * gears' shaft positions and tooth geometry (see
 * src/kinematics/gearMeshGeometry.ts) so there is a single source of
 * truth for assembly geometry.
 */
export interface GearMesh {
  readonly id: GearMeshId;
  readonly type: "GearMesh";
  drivingGearId: GearId;
  drivenGearId: GearId;
}

export function createGearMesh(drivingGearId: GearId, drivenGearId: GearId): GearMesh {
  return {
    id: createId("gearMesh"),
    type: "GearMesh",
    drivingGearId,
    drivenGearId,
  };
}
