import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";

export type DateComplicationId = EntityId<"dateComplication">;

/**
 * A simple instantaneous date mechanism (ASM-0048, Phase 8.2): a star
 * wheel that sits still except for one discrete jump per revolution of a
 * continuously-driven arbor — the genuinely new kinematic concept Phase
 * 8 scoped (`docs/ROADMAP.md`), distinct from the ordinary continuous
 * gear-train propagation used everywhere else in this project (including
 * MoonPhase, ASM-0047, which needs none of this).
 *
 * `driveShaftId` is an ordinary, already-built, continuously-driven arbor
 * (e.g. a 24-hour wheel geared 2:1 from the hour wheel, SRC-0042) — built
 * with the normal +Arbor/+Gear/mesh tools, nothing special about it.
 * `starShaftId` is a separate, declared (FIXED-position) arbor, NOT
 * meshed with anything: it advances only when this mechanism jumps it,
 * once per full revolution of the drive shaft, by exactly one step
 * (2π / starToothCount). No jumper-spring energy storage, no finger/cam
 * contact geometry and no backward (quick-correction) behaviour are
 * modeled — only the net kinematic effect SRC-0042 describes: "the
 * calendar mobile 1 to be advanced by one step" per drive-shaft
 * revolution, with "a concave portion... preventing the latter from
 * moving by more than one step." Reversing the drive shaft (e.g. setting
 * the hands backward through the trigger point) does not un-advance the
 * star: real jump mechanisms are one-way (a ratchet/jumper-spring
 * action), so only forward crossings count (`crossesRevolution`,
 * `src/kinematics/dateComplication.ts`).
 *
 * `starToothCount` is the number of discrete positions (31 for a date,
 * SRC-0042's own worked example — "a calendar mobile 1... bearing the
 * numerals 0 to 31... with an inner toothing 1a of thirty-one teeth");
 * any positive integer is accepted structurally, since the same star-
 * and-jump kinematics would describe a day-of-week star too, even though
 * this project's Phase 8 scope is the date specifically.
 */
export interface DateComplication {
  readonly id: DateComplicationId;
  readonly type: "DateComplication";
  name: string;
  driveShaftId: ShaftId;
  starShaftId: ShaftId;
  starToothCount: number;
  starTipDiameter: Length;
  starThickness: Length;
  starZCentre: Length;
}

export interface CreateDateComplicationParams {
  name: string;
  driveShaftId: ShaftId;
  starShaftId: ShaftId;
  starToothCount: number;
  starTipDiameter: Length;
  starThickness: Length;
  starZCentre: Length;
}

export function createDateComplication(params: CreateDateComplicationParams): DateComplication {
  return { ...params, id: createId("dateComplication"), type: "DateComplication" };
}

/** Arbors advanced only by a jump mechanism, never by continuous gear-train propagation (KIN-001 exemption, same pattern as `oscillatingShaftIds`). */
export function dateStarShaftIds(dateComplications: Record<DateComplicationId, DateComplication>): Set<ShaftId> {
  return new Set(Object.values(dateComplications).map((d) => d.starShaftId));
}
