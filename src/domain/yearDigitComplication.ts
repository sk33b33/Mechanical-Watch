import type { Length } from "@/units/length";
import type { EntityId } from "./ids";
import { createId } from "./ids";
import type { ShaftId } from "./shaft";
import type { MonthComplicationId } from "./monthComplication";

export type YearDigitComplicationId = EntityId<"yearDigitComplication">;

/**
 * Which decimal digit of a 4-digit year a `YearDigitComplication` shows.
 * Ordered least-to-most significant, the order carry propagates in
 * (`digitsToAdvance`, `src/kinematics/yearDigitComplication.ts`).
 */
export const YEAR_DIGIT_PLACES = ["ONES", "TENS", "HUNDREDS", "THOUSANDS"] as const;
export type YearDigitPlace = (typeof YEAR_DIGIT_PLACES)[number];

/** 0-9: a structural fact about decimal digits, not a declared per-movement field. */
export const YEAR_DIGIT_SLOT_COUNT = 10;

/** Position labels 0-9, shared by every digit wheel regardless of its own `digitPlace`. */
export const YEAR_DIGIT_LABELS = Array.from({ length: YEAR_DIGIT_SLOT_COUNT }, (_, i) => String(i));

/**
 * A "drum clock" year display (Phase 8.12): four digit wheels — ones,
 * tens, hundreds, thousands — each a jump-driven wheel in exactly the
 * same architectural shape as `LeapYearComplication`/`SeasonComplication`
 * (a declared FIXED-position arbor, not meshed with anything, advanced
 * only by a jump, never by continuous gear-train propagation), all four
 * referencing the same `MonthComplication` and all four triggered by its
 * December-to-January wrap — one trigger per calendar year, the same
 * event `LeapYearComplication`'s own Geneva wheel already fires on.
 *
 * Raised directly by the user ("add a drum clock for the current
 * year"). No sourced real mechanism (patent or manufacturer
 * description) for a wristwatch "year" complication built from decimal
 * digit-roller wheels has been found, so — like `SeasonComplication`
 * (ASM-0057) — this models only the net kinematic effect the user
 * described, declared rather than invented, and the jump stays
 * instantaneous (no claimed stroke shape to simulate, unlike the
 * leap-year wheel's own sourced Geneva drive, SRC-0047).
 *
 * The genuinely new kinematics this item needed: carry propagation.
 * Every wrap advances the ones wheel by one step; a tens (or hundreds,
 * or thousands) wheel advances in the SAME event only if every digit
 * place below it was sitting at 9 before the step — ordinary decimal
 * carry, the same rule a mechanical odometer or a real "big date"
 * mechanism's own tens-digit jump already follows, worked out here from
 * first principles (`digitsToAdvance`,
 * `src/kinematics/yearDigitComplication.ts`) since no equivalent already
 * existed in this project (every earlier jump-driven wheel — date,
 * month star, leap year, season — only ever has one wheel to advance
 * per trigger).
 *
 * There is no sourced way for a watch to know the real calendar year on
 * its own, so — matching how `DateComplication` always starts at day 1
 * and `MonthComplication` always starts at January — `startDigit` is
 * each wheel's own independently declared starting digit (e.g. the "2"
 * in 2024's thousands place), set once like a real digit wheel would be
 * set by hand, not derived from a single shared "year" field (which
 * would need a new kind of cross-entity consistency check this project
 * does not otherwise have).
 *
 * `wheelShaftId` is a separate, declared (FIXED-position) arbor, NOT
 * meshed with anything, same pattern as the other four jump-driven
 * complications.
 */
export interface YearDigitComplication {
  readonly id: YearDigitComplicationId;
  readonly type: "YearDigitComplication";
  name: string;
  monthComplicationId: MonthComplicationId;
  digitPlace: YearDigitPlace;
  wheelShaftId: ShaftId;
  /** This wheel's own declared starting digit (0-9), independent of the other three wheels. */
  startDigit: number;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export interface CreateYearDigitComplicationParams {
  name: string;
  monthComplicationId: MonthComplicationId;
  digitPlace: YearDigitPlace;
  wheelShaftId: ShaftId;
  startDigit: number;
  wheelTipDiameter: Length;
  wheelThickness: Length;
  wheelZCentre: Length;
}

export function createYearDigitComplication(params: CreateYearDigitComplicationParams): YearDigitComplication {
  return { ...params, id: createId("yearDigitComplication"), type: "YearDigitComplication" };
}

/** Arbors advanced only by the year-digit jump mechanism, never by continuous gear-train propagation (KIN-001 exemption, same pattern as `seasonWheelShaftIds`). */
export function yearDigitWheelShaftIds(complications: Record<YearDigitComplicationId, YearDigitComplication>): Set<ShaftId> {
  return new Set(Object.values(complications).map((y) => y.wheelShaftId));
}
