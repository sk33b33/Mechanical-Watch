import type { Length } from "@/units/length";
import type { Vec2 } from "@/math/vec2";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { FrameId } from "./frame";

export type ScrewId = EntityId<"screw">;

/**
 * A screw holding one frame (a `Mainplate` or `Bridge`) in place, modeled
 * as a plain through-hole of `diameter` punched through that frame at
 * `position` — the same "visual only, no manufacturing claim" treatment
 * already given other cosmetic/declared geometry (ASM-0004, ASM-0051):
 * no thread, no head, no countersink/counterbore, no clamping-torque or
 * thread-engagement data, since none of that is sourced here (ASM-0056).
 * A real mainplate screw also clamps a *second* frame or bridge foot
 * against it; this project does not model that second part of the joint
 * either — only the hole itself, in the one frame it is declared against.
 *
 * `position` is in the same movement-plan (x, y) coordinates as every
 * other plan-positioned entity (the same convention `DialWindow.centre`
 * uses) — not relative to the frame's own local origin, since a `Frame`
 * has no local origin of its own (its `outline` is already declared in
 * plan coordinates too).
 */
export interface Screw {
  readonly id: ScrewId;
  readonly type: "Screw";
  name: string;
  frameId: FrameId;
  position: Vec2;
  diameter: Length;
}

export interface CreateScrewParams {
  name: string;
  frameId: FrameId;
  position: Vec2;
  diameter: Length;
}

export function createScrew(params: CreateScrewParams): Screw {
  return { id: createId("screw"), type: "Screw", ...params };
}
