import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type MoonPhaseId = EntityId<"moonPhase">;

/**
 * How many moon images are affixed to the disc, 180 degrees apart for
 * DOUBLE (ASM-0047, SRC-0045): the conventional modern layout, so a
 * half-turn of the disc is one lunation. SINGLE (one moon, a full turn
 * per lunation) is a legitimate structural choice but not itself
 * sourced as a common one here.
 */
export type MoonPhaseWindowCount = "SINGLE" | "DOUBLE";

/**
 * The moonphase disc: a flat disc fixed to, and turning continuously
 * with, its own driven arbor (`shaftId`) — ordinary gear-train
 * kinematics, no jumper/cam mechanism (ASM-0047, unlike the date/month
 * complications Phase 8 scopes next). Its current phase is read
 * directly from that arbor's own solved angle, the same cyclical-
 * reading pattern as `readHand` (src/kinematics/timeDisplay.ts): this
 * project tracks no absolute calendar date, so "today's real moon
 * phase" is not a claim this component makes.
 *
 * Mounted like the dial (ASM-0014): on the dial side, at `faceHeight`,
 * occupying [faceHeight, faceHeight + thickness]. Moon/star artwork is
 * not modeled, only the disc itself (same "visual only" scope as the
 * dial's hour markers, ASM-0020).
 */
export interface MoonPhase {
  readonly id: MoonPhaseId;
  readonly type: "MoonPhase";
  name: string;
  shaftId: ShaftId;
  diameter: Length;
  thickness: Length;
  faceHeight: Length;
  windowCount: MoonPhaseWindowCount;
}

export interface CreateMoonPhaseParams {
  name: string;
  shaftId: ShaftId;
  diameter: Length;
  thickness: Length;
  faceHeight: Length;
  windowCount: MoonPhaseWindowCount;
}

export function createMoonPhase(params: CreateMoonPhaseParams): MoonPhase {
  return { ...params, id: createId("moonPhase"), type: "MoonPhase" };
}

/** Moon images per disc revolution (ASM-0047, SRC-0045). */
export function windowsPerRevolution(windowCount: MoonPhaseWindowCount): number {
  return windowCount === "DOUBLE" ? 2 : 1;
}
