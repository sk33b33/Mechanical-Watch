import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";
import type { MonthComplicationId } from "./monthComplication";

export type LeapYearComplicationId = EntityId<"leapYearComplication">;

/**
 * Four slots (one normal/normal/normal/leap cycle): a structural fact
 * about a four-year cycle, not a declared per-movement field, same
 * treatment as `MONTHS_PER_YEAR` (`src/kinematics/monthComplication.ts`,
 * ASM-0049).
 */
export const LEAP_YEAR_SLOT_COUNT = 4;

/** Position labels 0–3; position 3 is the leap year, by this entity's own convention (see below). */
export const LEAP_YEAR_LABELS = ["Year 1", "Year 2", "Year 3", "Year 4 (leap)"] as const;

/**
 * A four-year-cycle (leap-year) indicator wheel, driven entirely by its
 * referenced month complication's own December-to-January wrap — one
 * trigger per calendar year by construction (ASM-0050, Phase 8.4).
 * SRC-0044 (Omega SA, a granted patent): the real mechanism is
 * "controlled directly or indirectly by a rotatable assembly journalled
 * on the month star such assembly including a year cam and a Maltese
 * cross enabling it to effect one revolution every four years" — a
 * cam-plus-Geneva hybrid. This entity models only the Geneva-drive
 * component: the year cam, which would carry the real leap-year logic
 * (e.g. century exceptions), is not modeled, so this repeats a fixed
 * four-year cycle rather than a true Gregorian calendar.
 *
 * Unlike `DateComplication`'s own drive shaft, this mechanism has no
 * continuous arbor of its own: it advances by exactly one Geneva index
 * step (2π / `LEAP_YEAR_SLOT_COUNT`, the real, sourced Geneva-mechanism
 * fact, SRC-0047) each time its referenced month complication's own star
 * wraps from December back to January. The real mechanism's own
 * continuous, non-uniform pin/slot contact motion during that index
 * event is not simulated — only its net effect — though the real
 * closed-form kinematics for that motion (`src/kinematics/genevaDrive.ts`)
 * are implemented, tested and cited, and reported as reference figures
 * (YEAR-002).
 *
 * `wheelShaftId` is a separate, declared (FIXED-position) arbor, NOT
 * meshed with anything — same pattern as the date and month stars.
 * Position 0–3, an arbitrary reference like the date/month stars' own
 * zero position; position 3 is the leap year, by this entity's own
 * convention (SRC-0044's real mechanism does not specify which of its
 * four cam positions is which — any single position repeating every
 * fourth trigger is kinematically equivalent).
 */
export interface LeapYearComplication {
  readonly id: LeapYearComplicationId;
  readonly type: "LeapYearComplication";
  name: string;
  monthComplicationId: MonthComplicationId;
  wheelShaftId: ShaftId;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export interface CreateLeapYearComplicationParams {
  name: string;
  monthComplicationId: MonthComplicationId;
  wheelShaftId: ShaftId;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export function createLeapYearComplication(params: CreateLeapYearComplicationParams): LeapYearComplication {
  return { ...params, id: createId("leapYearComplication"), type: "LeapYearComplication" };
}

/** Arbors advanced only by the year-wrap jump mechanism, never by continuous gear-train propagation (KIN-001 exemption, same pattern as `monthStarShaftIds`). */
export function leapYearWheelShaftIds(leapYearComplications: Record<LeapYearComplicationId, LeapYearComplication>): Set<ShaftId> {
  return new Set(Object.values(leapYearComplications).map((y) => y.wheelShaftId));
}
