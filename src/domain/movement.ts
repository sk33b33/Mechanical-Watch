import type { AngularVelocity } from "@/units/angularVelocity";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { Gear, GearId } from "./gear";
import type { Shaft, ShaftId } from "./shaft";
import type { GearMesh, GearMeshId } from "./gearMesh";
import type { Frame, FrameId } from "./frame";
import type { Jewel, JewelId } from "./jewel";
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
  /** Mainplate and bridges. A movement with no frames is a free-floating gear sandbox. */
  frames: Record<FrameId, Frame>;
  jewels: Record<JewelId, Jewel>;
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
    frames: {},
    jewels: {},
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

export function addFrame(movement: Movement, frame: Frame): Movement {
  return { ...movement, frames: { ...movement.frames, [frame.id]: frame } };
}

export function addJewel(movement: Movement, jewel: Jewel): Movement {
  return { ...movement, jewels: { ...movement.jewels, [jewel.id]: jewel } };
}

export function updateFrame(
  movement: Movement,
  frameId: FrameId,
  patch: Partial<Omit<Frame, "id" | "type">>,
): Movement {
  const existing = movement.frames[frameId];
  if (existing === undefined) {
    throw new Error(`Unknown frame id: ${frameId}`);
  }
  return { ...movement, frames: { ...movement.frames, [frameId]: { ...existing, ...patch } } };
}

export function updateJewel(
  movement: Movement,
  jewelId: JewelId,
  patch: Partial<Omit<Jewel, "id" | "type">>,
): Movement {
  const existing = movement.jewels[jewelId];
  if (existing === undefined) {
    throw new Error(`Unknown jewel id: ${jewelId}`);
  }
  return { ...movement, jewels: { ...movement.jewels, [jewelId]: { ...existing, ...patch } } };
}

export function updateGear(
  movement: Movement,
  gearId: GearId,
  patch: Partial<Omit<Gear, "id" | "type">>,
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

export function updateShaft(
  movement: Movement,
  shaftId: ShaftId,
  patch: Partial<Omit<Shaft, "id" | "type">>,
): Movement {
  const existing = movement.shafts[shaftId];
  if (existing === undefined) {
    throw new Error(`Unknown shaft id: ${shaftId}`);
  }
  return { ...movement, shafts: { ...movement.shafts, [shaftId]: { ...existing, ...patch } } };
}

export function setDrivingShaft(
  movement: Movement,
  shaftId: ShaftId,
  angularVelocity: AngularVelocity,
): Movement {
  return { ...movement, drivingShaftId: shaftId, drivingAngularVelocity: angularVelocity };
}
