import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { GearMeshId } from "./gearMesh";
import type { FrameId } from "./frame";

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
 * - COAXIAL: on the same axis as `referenceShaftId`, but free to turn at
 *   its own speed (e.g. a cannon pinion or hour wheel on the centre arbor).
 */
export type ShaftPlacement =
  | { kind: "FIXED"; position: Vec2 }
  | { kind: "MESH_POLAR"; referenceShaftId: ShaftId; meshId: GearMeshId; angle: Angle }
  | { kind: "COAXIAL"; referenceShaftId: ShaftId };

/**
 * How a rotating body is held (REF-ENG §12).
 * - PIVOTED: between a lower and an upper bearing (BRG rules apply).
 * - STUD: turns on a stud fixed to a frame (e.g. a minute wheel).
 * - CARRIED: rides on another shaft it is coaxial with (e.g. an hour wheel).
 */
export type ShaftSupport =
  | { kind: "PIVOTED" }
  | { kind: "STUD"; frameId: FrameId }
  | { kind: "CARRIED" };

export type ShaftEnd = "LOWER" | "UPPER";

/** The dial hand this shaft carries, if any. Defines its nominal rate on a 12-hour dial (ASM-0014). */
export type HandFunction = "HOURS" | "MINUTES" | "SECONDS";

/**
 * A shaft (arbor) or other rotating body. All axes are parallel and
 * perpendicular to the mainplate, i.e. the viewport Z axis (ASM-0006).
 * Pivot diameters and the shoulder span (axial distance between the two
 * pivot shoulders) are null when unknown and are never defaulted
 * (REF-ENG §12).
 */
export interface Shaft {
  readonly id: ShaftId;
  readonly type: "Shaft";
  name: string;
  placement: ShaftPlacement;
  support: ShaftSupport;
  hand: HandFunction | null;
  pivotDiameter: Record<ShaftEnd, Length | null>;
  shoulderSpan: Length | null;
}

export function createShaft(name: string, placement: ShaftPlacement, support: ShaftSupport = { kind: "PIVOTED" }): Shaft {
  return {
    id: createId("shaft"),
    type: "Shaft",
    name,
    placement,
    support,
    hand: null,
    pivotDiameter: { LOWER: null, UPPER: null },
    shoulderSpan: null,
  };
}

export function fixedAt(x: Length, y: Length): ShaftPlacement {
  return { kind: "FIXED", position: { x, y } };
}
