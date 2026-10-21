import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { Angle } from "@/units/angle";
import { pitchDiameter } from "@/math/gearMath";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type GearId = EntityId<"gear">;

/** The fewest teeth a spoked gear needs for its gaps to fit between hub and rim (ASM-0077, GEAR-105): a pitch radius of about 1.4mm at the teaching module. */
export const GEAR_SPOKE_MIN_TOOTH_COUNT = 24;

/**
 * Tooth-profile scope, per reference/REFERENCE_ENGINEERING.md §6. A gear
 * is never silently promoted between these. PITCH_MODEL, INVOLUTE_PROFILE
 * and WATCH_SPECIFIC_PROFILE are implemented (src/geometry); MANUFACTURING_
 * VALIDATED_PROFILE is not.
 */
export type GearProfileModel =
  | "PITCH_MODEL"
  | "INVOLUTE_PROFILE"
  | "WATCH_SPECIFIC_PROFILE"
  | "MANUFACTURING_VALIDATED_PROFILE";

/**
 * A single gear wheel, mounted on a shaft. Geometry (pitch diameter, tooth
 * shape) is always derived from these parameters — never stored
 * redundantly.
 */
export interface Gear {
  readonly id: GearId;
  readonly type: "Gear";
  name: string;
  toothCount: number;
  module: Length;
  profileModel: GearProfileModel;
  /**
   * `null` means not modeled/unknown. A PITCH_MODEL gear has no tooth
   * flank, so no pressure angle is assumed for it.
   */
  pressureAngle: Angle | null;
  thickness: Length;
  /**
   * Axial position of the gear's mid-plane in movement coordinates. The
   * gear occupies [zCentre - thickness/2, zCentre + thickness/2].
   */
  zCentre: Length;
  shaftId: ShaftId;
  /**
   * Drawn as an open five-spoke wheel — hub, spokes and gaps inside a solid tooth rim — instead of a
   * solid disc (ASM-0077, visual only: tooth form, pitch diameter and every kinematic result are
   * unchanged). Needs at least `GEAR_SPOKE_MIN_TOOTH_COUNT` teeth to leave room for gaps (GEAR-105).
   */
  spoked: boolean;
}

export interface CreateGearParams {
  name: string;
  toothCount: number;
  module: Length;
  thickness: Length;
  shaftId: ShaftId;
  /** Defaults to the coordinate origin (z = 0), a coordinate choice rather than a dimension. */
  zCentre?: Length;
  profileModel?: GearProfileModel;
  pressureAngle?: Angle | null;
  spoked?: boolean;
}

export function createGear(params: CreateGearParams): Gear {
  return {
    id: createId("gear"),
    type: "Gear",
    name: params.name,
    toothCount: params.toothCount,
    module: params.module,
    thickness: params.thickness,
    zCentre: params.zCentre ?? metres(0),
    shaftId: params.shaftId,
    profileModel: params.profileModel ?? "PITCH_MODEL",
    pressureAngle: params.pressureAngle ?? null,
    spoked: params.spoked ?? false,
  };
}

export function gearPitchDiameter(gear: Gear): Length {
  return pitchDiameter(gear.module, gear.toothCount);
}
