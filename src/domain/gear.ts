import type { Length } from "@/units/length";
import { metres } from "@/units/length";
import type { Angle } from "@/units/angle";
import { pitchDiameter } from "@/math/gearMath";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type GearId = EntityId<"gear">;

/**
 * Tooth-profile scope, per reference/REFERENCE_ENGINEERING.md §6. A gear
 * is never silently promoted between these. Only PITCH_MODEL is
 * implemented.
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
  };
}

export function gearPitchDiameter(gear: Gear): Length {
  return pitchDiameter(gear.module, gear.toothCount);
}
