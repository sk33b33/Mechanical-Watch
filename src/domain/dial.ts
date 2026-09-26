import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type DialId = EntityId<"dial">;

/**
 * The dial: a flat disc on the dial side of the movement (−Z, ASM-0014),
 * centred on an arbor's solved axis (normally the one carrying the hour
 * and minute hands). Its visible face is its −Z side at `faceHeight`; it
 * occupies [faceHeight, faceHeight + thickness].
 *
 * Feet, holes for the hand pipes and the seconds hand, and printing are
 * not modeled; the hour markers drawn on it are visual (ASM-0020).
 */
export interface Dial {
  readonly id: DialId;
  readonly type: "Dial";
  name: string;
  centreShaftId: ShaftId;
  diameter: Length;
  thickness: Length;
  faceHeight: Length;
}

export interface CreateDialParams {
  name: string;
  centreShaftId: ShaftId;
  diameter: Length;
  thickness: Length;
  faceHeight: Length;
}

export function createDial(params: CreateDialParams): Dial {
  return { ...params, id: createId("dial"), type: "Dial" };
}
