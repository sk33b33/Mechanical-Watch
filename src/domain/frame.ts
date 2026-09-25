import type { Length } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";

export type FrameId = EntityId<"frame">;

export type FrameKind = "MAINPLATE" | "BRIDGE";

/** Plan-view outline in movement coordinates. */
export type Outline =
  | { kind: "CIRCLE"; centre: Vec2; radius: Length }
  | { kind: "POLYGON"; points: Vec2[] };

/**
 * A mainplate or bridge, modeled as a flat slab of uniform thickness
 * spanning [zBottom, zBottom + thickness] (ASM-0010). z increases from
 * the mainplate toward the bridges.
 */
export interface Frame {
  readonly id: FrameId;
  readonly type: "Frame";
  kind: FrameKind;
  name: string;
  outline: Outline;
  zBottom: Length;
  thickness: Length;
}

export interface CreateFrameParams {
  kind: FrameKind;
  name: string;
  outline: Outline;
  zBottom: Length;
  thickness: Length;
}

export function createFrame(params: CreateFrameParams): Frame {
  return { id: createId("frame"), type: "Frame", ...params };
}
