import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { GearMeshId } from "./gearMesh";

export type ShaftId = EntityId<"shaft">;

/**
 * How a shaft's axis is located. The axis position itself is never
 * stored: it is derived by src/kinematics/solvePlacement.ts, so there is
 * one authoritative source for it.
 *
 * - FIXED: at explicit movement coordinates.
 * - MESH_POLAR: at the ideal centre distance of `meshId` (REF-ENG §5.2)
 *   from `referenceShaftId`, in direction `angle` (from +X,
 *   counter-clockwise). Editing tooth counts or module moves the shaft
 *   because the user declared this constraint. Nothing is moved
 *   silently.
 */
export type ShaftPlacement =
  | { kind: "FIXED"; position: Vec2 }
  | { kind: "MESH_POLAR"; referenceShaftId: ShaftId; meshId: GearMeshId; angle: Angle };

export type ShaftEnd = "LOWER" | "UPPER";

/**
 * A shaft (arbor). All axes are parallel and perpendicular to the
 * mainplate, i.e. the viewport Z axis (ASM-0006).
 */
export interface Shaft {
  readonly id: ShaftId;
  readonly type: "Shaft";
  name: string;
  placement: ShaftPlacement;
}

export function createShaft(name: string, placement: ShaftPlacement): Shaft {
  return { id: createId("shaft"), type: "Shaft", name, placement };
}

export function fixedAt(x: Length, y: Length): ShaftPlacement {
  return { kind: "FIXED", position: { x, y } };
}
