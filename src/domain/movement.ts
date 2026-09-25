import type { AngularVelocity } from "@/units/angularVelocity";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { Gear, GearId } from "./gear";
import type { Shaft, ShaftId } from "./shaft";
import type { GearMesh, GearMeshId } from "./gearMesh";
import type { ValidationLevel } from "@/reference/validationLevels";

export type MovementId = EntityId<"movement">;

/**
 * The authoritative mechanical model of a watch movement (or, for
 * Milestone 1, a minimal gear sandbox). Three.js and the UI read from
 * this model; they never mutate mechanical state directly.
 */
export interface Movement {
  readonly id: MovementId;
  name: string;
  /** Explicitly labels demo/teaching content so it is never mistaken for a production caliber (see docs/PRODUCT_SPEC.md). */
  isTeachingDemo: boolean;
  shafts: Record<ShaftId, Shaft>;
  gears: Record<GearId, Gear>;
  gearMeshes: Record<GearMeshId, GearMesh>;
  /** The externally driven shaft, e.g. the mainspring/barrel arbor in a full movement, or the input gear in the sandbox. */
  drivingShaftId: ShaftId | null;
  drivingAngularVelocity: AngularVelocity;
  /**
   * The level this design's model targets (REFERENCE_ENGINEERING.md §15).
   * Set explicitly by the author; never raised automatically.
   */
  declaredValidationLevel: ValidationLevel;
}

export function createMovement(
  name: string,
  isTeachingDemo: boolean,
  declaredValidationLevel: ValidationLevel = "L2_KINEMATIC",
): Movement {
  return {
    id: createId("movement"),
    name,
    isTeachingDemo,
    declaredValidationLevel,
    shafts: {},
    gears: {},
    gearMeshes: {},
    drivingShaftId: null,
    drivingAngularVelocity: 0 as AngularVelocity,
  };
}

export function addShaft(movement: Movement, shaft: Shaft): Movement {
  return { ...movement, shafts: { ...movement.shafts, [shaft.id]: shaft } };
}

export function addGear(movement: Movement, gear: Gear): Movement {
  return { ...movement, gears: { ...movement.gears, [gear.id]: gear } };
}

export function addGearMesh(movement: Movement, mesh: GearMesh): Movement {
  return { ...movement, gearMeshes: { ...movement.gearMeshes, [mesh.id]: mesh } };
}

export function updateGear(
  movement: Movement,
  gearId: GearId,
  patch: Partial<Pick<Gear, "toothCount" | "module" | "thickness" | "pressureAngle" | "name">>,
): Movement {
  const existing = movement.gears[gearId];
  if (existing === undefined) {
    throw new Error(`Unknown gear id: ${gearId}`);
  }
  return {
    ...movement,
    gears: { ...movement.gears, [gearId]: { ...existing, ...patch } },
  };
}

export function setDrivingShaft(
  movement: Movement,
  shaftId: ShaftId,
  angularVelocity: AngularVelocity,
): Movement {
  return { ...movement, drivingShaftId: shaftId, drivingAngularVelocity: angularVelocity };
}
