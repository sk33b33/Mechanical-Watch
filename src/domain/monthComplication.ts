import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";
import type { DateComplicationId } from "./dateComplication";

export type MonthComplicationId = EntityId<"monthComplication">;

/**
 * A month indicator that both corrects its referenced date complication
 * for short months and advances once a month itself (ASM-0049, Phase
 * 8.3). SRC-0043 (ETA SA, a granted patent): the date disc "includ[es] a
 * second toothing (24), a correction drive wheel set (42) able to
 * cooperate with [it] to drive the date disc through an additional step
 * at the end of the months of less than thirty one days, and a month
 * star wheel (54) arranged to be actuated at the end of each month."
 *
 * Unlike `DateComplication`'s own drive shaft, this mechanism has no
 * continuous arbor of its own: it is driven entirely by the referenced
 * date complication's own jumps (`dateComplicationId`) — on the one jump
 * each month that lands on day 1, the month star also advances one step,
 * and the date star's own jump that night is enlarged just enough to
 * skip the days the current month does not have
 * (`monthEndCorrection`, `src/kinematics/monthComplication.ts`).
 *
 * `starShaftId` is a separate, declared (FIXED-position) arbor, NOT
 * meshed with anything — same pattern as the date star. Always 12
 * positions (`MONTHS_PER_YEAR`): not a declared field, a structural fact
 * about the Gregorian calendar this project assumes, not a per-movement
 * design choice.
 *
 * February is fixed at 28 days (`GREGORIAN_MONTH_LENGTHS`): `LeapYearComplication`
 * (Phase 8.4, ASM-0050) tracks the 4-year cycle as an indicator wheel
 * only — it is not wired back into this correction schedule, so February
 * never becomes 29 days here. A real annual calendar in this same sense
 * (ETA's own mechanism included) still needs one manual correction a
 * year, after February — this is not a gap this item closes, consistent
 * with how real annual-calendar watches work.
 *
 * The viewport draws a small declutch wheel near the star, in its own
 * idle/disengaged position (ASM-0054) — unlike `DateComplication`, which
 * has a continuously-driven arbor to hang a cam on (ASM-0053), this
 * mechanism has no continuous member at all, so the wheel is never
 * animated; it is a declared visual cue that the star is linked to
 * something, not a contact-geometry simulation of SRC-0043's own
 * declutching drive wheel set.
 */
export interface MonthComplication {
  readonly id: MonthComplicationId;
  readonly type: "MonthComplication";
  name: string;
  dateComplicationId: DateComplicationId;
  starShaftId: ShaftId;
  starTipDiameter: Length;
  starThickness: Length;
  starZCentre: Length;
}

export interface CreateMonthComplicationParams {
  name: string;
  dateComplicationId: DateComplicationId;
  starShaftId: ShaftId;
  starTipDiameter: Length;
  starThickness: Length;
  starZCentre: Length;
}

export function createMonthComplication(params: CreateMonthComplicationParams): MonthComplication {
  return { ...params, id: createId("monthComplication"), type: "MonthComplication" };
}

/** Arbors advanced only by the month-jump mechanism, never by continuous gear-train propagation (KIN-001 exemption, same pattern as `dateStarShaftIds`). */
export function monthStarShaftIds(monthComplications: Record<MonthComplicationId, MonthComplication>): Set<ShaftId> {
  return new Set(Object.values(monthComplications).map((m) => m.starShaftId));
}
