import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { FrameId } from "./frame";
import type { ShaftEnd, ShaftId } from "./shaft";

export type JewelId = EntityId<"jewel">;

export type BearingKind = "HOLE_JEWEL" | "PLAIN_HOLE";

/**
 * A bearing in a frame that supports one end of a shaft (REF-ENG §12).
 * It has no position of its own: it sits on its shaft's solved axis, so
 * the two bearings of a shaft are coaxial by construction (ASM-0006).
 * `boreDiameter` is null when unknown. It is never defaulted.
 */
export interface Jewel {
  readonly id: JewelId;
  readonly type: "Jewel";
  name: string;
  kind: BearingKind;
  frameId: FrameId;
  shaftId: ShaftId;
  end: ShaftEnd;
  boreDiameter: Length | null;
}

export interface CreateJewelParams {
  name: string;
  kind: BearingKind;
  frameId: FrameId;
  shaftId: ShaftId;
  end: ShaftEnd;
  boreDiameter?: Length | null;
}

export function createJewel(params: CreateJewelParams): Jewel {
  return {
    id: createId("jewel"),
    type: "Jewel",
    name: params.name,
    kind: params.kind,
    frameId: params.frameId,
    shaftId: params.shaftId,
    end: params.end,
    boreDiameter: params.boreDiameter ?? null,
  };
}
