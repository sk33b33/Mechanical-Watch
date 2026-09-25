import type { Length } from "@/units/length";
import type { Angle } from "@/units/angle";
import { degrees } from "@/units/angle";
import { pitchDiameter } from "@/math/gearMath";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type GearId = EntityId<"gear">;

/** Standard involute pressure angle used unless a gear overrides it. */
export const DEFAULT_PRESSURE_ANGLE: Angle = degrees(20);

/**
 * A single gear wheel, mounted on a shaft. Geometry (pitch diameter, tooth
 * shape) is always derived from these parameters — never stored
 * redundantly — per docs/MASTER_BUILD_PROMPT.md "Single source of truth".
 */
export interface Gear {
  readonly id: GearId;
  readonly type: "Gear";
  name: string;
  toothCount: number;
  module: Length;
  pressureAngle: Angle;
  thickness: Length;
  shaftId: ShaftId;
}

export interface CreateGearParams {
  name: string;
  toothCount: number;
  module: Length;
  thickness: Length;
  shaftId: ShaftId;
  pressureAngle?: Angle;
}

export function createGear(params: CreateGearParams): Gear {
  return {
    id: createId("gear"),
    type: "Gear",
    name: params.name,
    toothCount: params.toothCount,
    module: params.module,
    thickness: params.thickness,
    shaftId: params.shaftId,
    pressureAngle: params.pressureAngle ?? DEFAULT_PRESSURE_ANGLE,
  };
}

export function gearPitchDiameter(gear: Gear): Length {
  return pitchDiameter(gear.module, gear.toothCount);
}
