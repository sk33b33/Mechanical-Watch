import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";
import type { MonthComplicationId } from "./monthComplication";

export type SeasonComplicationId = EntityId<"seasonComplication">;

/** Four quarters: a structural fact about the user's own chosen convention (calendar quarters), not a declared per-movement field. */
export const SEASON_SLOT_COUNT = 4;

/**
 * Named-season labels, Southern Hemisphere astronomical convention
 * (ASM-0057). Real season names (Spring, Summer, Autumn, Winter) are
 * hemisphere-dependent — Northern and Southern Hemisphere conventions
 * assign opposite seasons to the same quarter — so this project
 * initially used neutral "Quarter 1–4" labels rather than invent a
 * hemisphere. The user later asked directly for this specific mapping
 * (Q1 Summer, Q2 Autumn, Q3 Winter, Q4 Spring), which is the Southern
 * Hemisphere's own astronomical quarters (Q1 = January–March, mostly
 * within the Dec 21–Mar 20 summer quarter, and so on) — a declared
 * choice, not an invented default; the Northern Hemisphere reading of
 * the same quarters would be Winter/Spring/Summer/Autumn.
 */
export const SEASON_LABELS = ["Summer", "Autumn", "Winter", "Spring"] as const;

/** `SEASON_LABELS`, shortened for the wheel's own printed-ring texture (same "clogging a small disc" fix the other complication discs already use, ASM-0051). Two letters each, so they stay distinct (Summer and Spring both start with "S"). */
export const SEASON_SHORT_LABELS = ["SU", "AU", "WI", "SP"] as const;

/**
 * A quarter indicator, driven entirely by its referenced month
 * complication's own jump into January, April, July or October — one
 * trigger every three months by construction (ASM-0057). Raised
 * directly by the user ("use the month gear to add a season gear that
 * rotates after every 3 months"), and explicitly NOT the "season"
 * complication `docs/ROADMAP.md` 8.5 scoped out: that item is a genuine
 * equation-of-time/analemma complication (a bean-shaped cam encoding
 * real orbital-mechanics data, SRC unresolved) — a different mechanism
 * class this project still has no source for and still does not model.
 * This entity is a much simpler, purely calendar-driven quarter
 * indicator with no claim to track the real tropical year or solstices.
 *
 * Like `MonthComplication` and `LeapYearComplication`, this mechanism
 * has no continuous arbor of its own: `wheelShaftId` is a separate,
 * declared (FIXED-position) arbor, NOT meshed with anything. Unlike
 * `LeapYearComplication`, no sourced real mechanism (patent or
 * manufacturer description) exists for a quarter-indicator built this
 * way, so its own jump stays instantaneous rather than claiming a real
 * stroke shape to simulate (same "no sourced motion, stays
 * instantaneous" treatment `DateComplication`/`MonthComplication`
 * already have, ASM-0048/0049) — this is the conservative default,
 * not a declared Geneva-drive upgrade.
 *
 * Position 0–3, an arbitrary reference like the date/month stars' own
 * zero position. The quarter boundary itself (which month transitions
 * trigger it) is fixed at the Gregorian calendar-quarter convention —
 * January/April/July/October — the user's own explicit choice between
 * that and the March/June/September/December alternative offered.
 */
export interface SeasonComplication {
  readonly id: SeasonComplicationId;
  readonly type: "SeasonComplication";
  name: string;
  monthComplicationId: MonthComplicationId;
  wheelShaftId: ShaftId;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export interface CreateSeasonComplicationParams {
  name: string;
  monthComplicationId: MonthComplicationId;
  wheelShaftId: ShaftId;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export function createSeasonComplication(params: CreateSeasonComplicationParams): SeasonComplication {
  return { ...params, id: createId("seasonComplication"), type: "SeasonComplication" };
}

/** Arbors advanced only by the quarter-jump mechanism, never by continuous gear-train propagation (KIN-001 exemption, same pattern as `leapYearWheelShaftIds`). */
export function seasonWheelShaftIds(seasonComplications: Record<SeasonComplicationId, SeasonComplication>): Set<ShaftId> {
  return new Set(Object.values(seasonComplications).map((s) => s.wheelShaftId));
}
